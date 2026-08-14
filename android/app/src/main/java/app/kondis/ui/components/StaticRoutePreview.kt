package app.kondis.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.createBitmap
import app.kondis.model.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.Cache
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.tan

@Composable
fun StaticRoutePreview(
    track: Track,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current.applicationContext
    val density = LocalDensity.current.density
    var size by remember { mutableStateOf(IntSize.Zero) }
    var bitmap by remember(track) { mutableStateOf<Bitmap?>(null) }

    LaunchedEffect(track, size, density) {
        if (size.width <= 0 || size.height <= 0) return@LaunchedEffect
        bitmap = StaticOsmRenderer.render(context, track, size, density)
    }

    Box(
        modifier =
            modifier
                .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.38f))
                .onSizeChanged { size = it },
    ) {
        bitmap?.let {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = "Activity route map",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.FillBounds,
            )
        }
        Text(
            text = "© OpenStreetMap",
            modifier = Modifier.align(Alignment.BottomEnd).padding(3.dp),
            color = androidx.compose.ui.graphics.Color.DarkGray,
            fontSize = 9.sp,
        )
    }
}

private object StaticOsmRenderer {
    private const val TILE_SIZE = 256
    private const val MAX_LATITUDE = 85.05112878
    private val RENDER_SLOTS = Semaphore(2)
    private val TILE_MEMORY_CACHE =
        object : LruCache<String, Bitmap>(32 * 1024) {
            override fun sizeOf(
                key: String,
                value: Bitmap,
            ): Int = value.byteCount / 1024
        }

    @Volatile private var httpClient: OkHttpClient? = null

    suspend fun render(
        context: Context,
        track: Track,
        size: IntSize,
        density: Float,
    ): Bitmap =
        RENDER_SLOTS.withPermit {
            withContext(Dispatchers.IO) {
                val coordinates =
                    track.coordinates
                        .asSequence()
                        .filter { it.size >= 2 && it[0].isFinite() && it[1].isFinite() }
                        .map { Coordinate(it[0].coerceIn(-180.0, 180.0), it[1].coerceIn(-MAX_LATITUDE, MAX_LATITUDE)) }
                        .toList()
                        .downsampleCoordinates(600)
                if (coordinates.size < 2) return@withContext emptyMap(size)

                val viewport = viewportFor(coordinates, size, (24f * density).toDouble())
                val output = emptyMap(size)
                val canvas = Canvas(output)
                val firstTileX = floor(viewport.left / TILE_SIZE).toInt()
                val lastTileX = floor((viewport.left + size.width - 1) / TILE_SIZE).toInt()
                val firstTileY = floor(viewport.top / TILE_SIZE).toInt()
                val lastTileY = floor((viewport.top + size.height - 1) / TILE_SIZE).toInt()
                val tileCount = 1 shl viewport.zoom

                for (tileY in firstTileY..lastTileY) {
                    if (tileY !in 0 until tileCount) continue
                    for (tileX in firstTileX..lastTileX) {
                        currentCoroutineContext().ensureActive()
                        val wrappedX = ((tileX % tileCount) + tileCount) % tileCount
                        loadTile(context, viewport.zoom, wrappedX, tileY)?.let { tile ->
                            canvas.drawBitmap(
                                tile,
                                (tileX * TILE_SIZE - viewport.left).toFloat(),
                                (tileY * TILE_SIZE - viewport.top).toFloat(),
                                null,
                            )
                        }
                    }
                }

                drawRoute(canvas, coordinates, viewport, density)
                output
            }
        }

    private fun emptyMap(size: IntSize): Bitmap =
        createBitmap(
            size.width.coerceAtLeast(1),
            size.height.coerceAtLeast(1),
        ).apply { eraseColor(Color.rgb(225, 236, 226)) }

    private fun viewportFor(
        coordinates: List<Coordinate>,
        size: IntSize,
        padding: Double,
    ): Viewport {
        var selectedZoom = 1
        for (zoom in 18 downTo 1) {
            val projected = coordinates.map { project(it, zoom) }
            val width = projected.maxOf { it.x } - projected.minOf { it.x }
            val height = projected.maxOf { it.y } - projected.minOf { it.y }
            if (width <= size.width - padding * 2 && height <= size.height - padding * 2) {
                selectedZoom = zoom
                break
            }
        }
        val projected = coordinates.map { project(it, selectedZoom) }
        val centerX = (projected.minOf { it.x } + projected.maxOf { it.x }) / 2
        val centerY = (projected.minOf { it.y } + projected.maxOf { it.y }) / 2
        return Viewport(selectedZoom, centerX - size.width / 2.0, centerY - size.height / 2.0)
    }

    private fun drawRoute(
        canvas: Canvas,
        coordinates: List<Coordinate>,
        viewport: Viewport,
        density: Float,
    ) {
        val path = Path()
        coordinates.forEachIndexed { index, coordinate ->
            val point = project(coordinate, viewport.zoom)
            val x = (point.x - viewport.left).toFloat()
            val y = (point.y - viewport.top).toFloat()
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        val outline =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                style = Paint.Style.STROKE
                strokeWidth = 7f * density
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }
        val route =
            Paint(outline).apply {
                color = Color.rgb(22, 101, 52)
                strokeWidth = 4f * density
            }
        canvas.drawPath(path, outline)
        canvas.drawPath(path, route)
    }

    private fun project(
        coordinate: Coordinate,
        zoom: Int,
    ): PixelPoint {
        val worldSize = TILE_SIZE * 2.0.pow(zoom)
        val latitudeRadians = coordinate.latitude * PI / 180.0
        return PixelPoint(
            x = (coordinate.longitude + 180.0) / 360.0 * worldSize,
            y = (1.0 - ln(tan(latitudeRadians) + 1.0 / cos(latitudeRadians)) / PI) / 2.0 * worldSize,
        )
    }

    private fun loadTile(
        context: Context,
        zoom: Int,
        x: Int,
        y: Int,
    ): Bitmap? {
        val key = "$zoom/$x/$y"
        TILE_MEMORY_CACHE.get(key)?.let { return it }
        val request =
            Request
                .Builder()
                .url("https://tile.openstreetmap.org/$key.png")
                .header("User-Agent", "${context.packageName}/0.1")
                .build()
        return runCatching {
            client(context).newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@use null
                BitmapFactory.decodeStream(response.body.byteStream())?.also { TILE_MEMORY_CACHE.put(key, it) }
            }
        }.getOrNull()
    }

    private fun client(context: Context): OkHttpClient =
        httpClient ?: synchronized(this) {
            httpClient ?: OkHttpClient
                .Builder()
                .cache(Cache(File(context.cacheDir, "osm-static-tiles"), 32L * 1024 * 1024))
                .build()
                .also { httpClient = it }
        }
}

private fun List<Coordinate>.downsampleCoordinates(maxPoints: Int): List<Coordinate> {
    if (size <= maxPoints) return this
    val step = (size - 1).toDouble() / (maxPoints - 1)
    return List(maxPoints) { index -> this[(index * step).toInt()] }
}

private data class Coordinate(
    val longitude: Double,
    val latitude: Double,
)

private data class PixelPoint(
    val x: Double,
    val y: Double,
)

private data class Viewport(
    val zoom: Int,
    val left: Double,
    val top: Double,
)
