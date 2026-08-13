package app.kondis.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsBike
import androidx.compose.material.icons.automirrored.rounded.DirectionsRun
import androidx.compose.material.icons.rounded.DownhillSkiing
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Hiking
import androidx.compose.material.icons.rounded.Kayaking
import androidx.compose.material.icons.rounded.Landscape
import androidx.compose.material.icons.rounded.Pool
import androidx.compose.material.icons.rounded.Sports
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import app.kondis.model.Activity
import app.kondis.model.Track
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.model.formatElevation
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed

@Composable
fun ActivityCard(
    activity: Activity,
    units: UnitSystem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                horizontalArrangement = Arrangement.spacedBy(13.dp),
            ) {
                Box(
                    modifier = Modifier.size(44.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = sportIcon(activity.sport),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(activity.displayName(), style = MaterialTheme.typography.titleMedium)
                    Text(
                        formatDateTime(activity.startedAt),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        val metrics = activity.metrics
                        ActivityStat("Distance", formatDistance(metrics?.distance, units))
                        ActivityStat("Time", formatDuration(metrics?.movingTime ?: metrics?.elapsedTime))
                        ActivityStat(
                            if (activity.sport.contains("run") || activity.sport == "walk") "Pace" else "Speed",
                            if (activity.sport.contains("run") || activity.sport == "walk") {
                                formatPace(metrics?.avgSpeed, units)
                            } else {
                                formatSpeed(metrics?.avgSpeed, units)
                            },
                        )
                    }
                }
            }
            activity.track?.takeIf { it.coordinates.size > 1 }?.let { track ->
                RoutePreview(track = track, modifier = Modifier.fillMaxWidth().height(170.dp))
            }
        }
    }
}

@Composable
fun ActivityStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(value, style = MaterialTheme.typography.titleMedium)
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun RoutePreview(track: Track, modifier: Modifier = Modifier) {
    val routeColor = MaterialTheme.colorScheme.primary
    val finishColor = MaterialTheme.colorScheme.tertiary
    val background = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.38f)
    val grid = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
    Canvas(modifier = modifier.background(background)) {
        for (step in 1..5) {
            val x = size.width * step / 6f
            val y = size.height * step / 6f
            drawLine(grid, Offset(x, 0f), Offset(x, size.height), 1.dp.toPx())
            drawLine(grid, Offset(0f, y), Offset(size.width, y), 1.dp.toPx())
        }
        val valid = track.coordinates.filter { it.size >= 2 }
        if (valid.size < 2) return@Canvas
        val minLongitude = valid.minOf { it[0] }
        val maxLongitude = valid.maxOf { it[0] }
        val minLatitude = valid.minOf { it[1] }
        val maxLatitude = valid.maxOf { it[1] }
        val longitudeRange = (maxLongitude - minLongitude).takeIf { it > 0 } ?: 1.0
        val latitudeRange = (maxLatitude - minLatitude).takeIf { it > 0 } ?: 1.0
        val padding = 20.dp.toPx()
        val path = Path()
        valid.forEachIndexed { index, coordinate ->
            val x = padding + ((coordinate[0] - minLongitude) / longitudeRange).toFloat() * (size.width - padding * 2)
            val y = size.height - padding - ((coordinate[1] - minLatitude) / latitudeRange).toFloat() * (size.height - padding * 2)
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, routeColor, style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round))
        val first = valid.first()
        val last = valid.last()
        fun offset(point: List<Double>) = Offset(
            padding + ((point[0] - minLongitude) / longitudeRange).toFloat() * (size.width - padding * 2),
            size.height - padding - ((point[1] - minLatitude) / latitudeRange).toFloat() * (size.height - padding * 2),
        )
        drawCircle(routeColor, 6.dp.toPx(), offset(first))
        drawCircle(finishColor, 6.dp.toPx(), offset(last))
    }
}

fun sportIcon(sport: String): ImageVector = when {
    sport.contains("ride") || sport == "velomobile" || sport == "handcycle" -> Icons.AutoMirrored.Rounded.DirectionsBike
    sport.contains("run") -> Icons.AutoMirrored.Rounded.DirectionsRun
    sport == "walk" || sport == "hike" || sport == "snowshoe" -> Icons.Rounded.Hiking
    sport.contains("ski") || sport == "snowboard" -> Icons.Rounded.DownhillSkiing
    sport == "swim" -> Icons.Rounded.Pool
    sport in setOf("kayaking", "canoeing", "rowing", "sail", "surfing", "stand_up_paddling") -> Icons.Rounded.Kayaking
    sport in setOf("weight_training", "crossfit", "high_intensity_interval_training") -> Icons.Rounded.FitnessCenter
    sport == "rock_climbing" -> Icons.Rounded.Landscape
    else -> Icons.Rounded.Sports
}
