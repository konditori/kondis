package app.kondis.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import app.kondis.model.ActivityImage
import app.kondis.ui.i18n.tr

@Composable
fun ActivityImageSlide(
    image: ActivityImage,
    onLoadImage: suspend (String) -> Bitmap?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    roundedCorners: Boolean = true,
) {
    val path = image.preview ?: image.original ?: image.thumbnail
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = path) {
        value = path?.let { runCatching { onLoadImage(it) }.getOrNull() }
    }
    Box(
        modifier = modifier.then(if (roundedCorners) Modifier.clip(RoundedCornerShape(12.dp)) else Modifier),
    ) {
        bitmap?.let {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = image.caption ?: tr("activity_photo"),
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale,
            )
        }
        image.caption?.takeIf(String::isNotBlank)?.let { caption ->
            Text(
                text = caption,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.65f))
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                color = MaterialTheme.colorScheme.onPrimary,
            )
        }
    }
}
