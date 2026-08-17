package app.kondis.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kondis.model.Activity
import app.kondis.model.ActivityImage
import app.kondis.model.BestEffortSummary
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed

@Composable
fun ActivityCard(
    activity: Activity,
    units: UnitSystem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onLoadImage: suspend (String) -> Bitmap? = { null },
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
                    if (activity.tags.isNotEmpty()) {
                        Text(
                            activity.tags.joinToString(" · ") { it.replace('_', ' ').replaceFirstChar { character -> character.titlecase() } },
                            modifier = Modifier.padding(top = 4.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    val achievements = activity.topBestEfforts.orEmpty()
                    if (achievements.isNotEmpty()) {
                        Row(
                            modifier = Modifier.padding(top = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            achievements
                                .distinctBy { achievementRank(it) }
                                .take(3)
                                .forEach { effort ->
                                    AchievementBadge(effort)
                                }
                            Text(
                                achievements.size.toString(),
                                modifier = Modifier.padding(start = 2.dp),
                                fontSize = 13.sp,
                                lineHeight = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
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
            activity.personalRecord()?.let { effort ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant,
                            ).padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    AchievementMedal(effort.overallRank, showRank = true)
                    Text(
                        achievementText(effort),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    )
                }
            }
            ActivityCardVisualPager(activity, onLoadImage)
        }
    }
}

@Composable
private fun ActivityCardVisualPager(
    activity: Activity,
    onLoadImage: suspend (String) -> Bitmap?,
) {
    val hasMap =
        activity.track
            ?.coordinates
            ?.size
            ?.let { it > 1 } == true
    val pageCount = (if (hasMap) 1 else 0) + activity.images.size
    if (pageCount == 0) return

    val pagerState = rememberPagerState(pageCount = { pageCount })
    HorizontalPager(
        state = pagerState,
        modifier = Modifier.fillMaxWidth().height(190.dp),
        contentPadding = PaddingValues(horizontal = 0.dp),
        pageSpacing = 8.dp,
    ) { page ->
        if (hasMap && page == 0) {
            activity.track.let { track ->
                StaticRoutePreview(
                    track = track,
                    modifier = Modifier.fillMaxWidth().height(190.dp),
                )
            }
        } else {
            ActivityImageSlide(
                image = activity.images[page - if (hasMap) 1 else 0],
                onLoadImage = onLoadImage,
                modifier = Modifier.fillMaxWidth().height(190.dp),
            )
        }
    }
    if (pageCount > 1) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            repeat(pageCount) { page ->
                Surface(
                    modifier =
                        Modifier
                            .padding(horizontal = 3.dp)
                            .size(if (page == pagerState.currentPage) 18.dp else 6.dp, 6.dp),
                    shape = RoundedCornerShape(3.dp),
                    color =
                        if (page == pagerState.currentPage) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.outlineVariant
                        },
                ) {}
            }
        }
    }
}

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
        modifier =
            modifier.then(
                if (roundedCorners) Modifier.clip(RoundedCornerShape(12.dp)) else Modifier,
            ),
    ) {
        bitmap?.let {
            Image(
                bitmap = it.asImageBitmap(),
                contentDescription = image.caption ?: "Activity photo",
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale,
            )
        }
        image.caption?.takeIf(String::isNotBlank)?.let { caption ->
            Text(
                text = caption,
                modifier =
                    Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.65f))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                color = MaterialTheme.colorScheme.onPrimary,
            )
        }
    }
}

@Composable
private fun AchievementBadge(effort: BestEffortSummary) {
    Box(
        modifier = Modifier.size(width = 22.dp, height = 24.dp),
        contentAlignment = Alignment.Center,
    ) {
        MedalIcon(
            tint = achievementColor(achievementRank(effort)),
            contentDescription = "${bestEffortLabel(effort.type)}: ${rankDescription(achievementRank(effort))}",
            modifier = Modifier.fillMaxSize(),
        )
    }
}

private fun achievementRank(effort: BestEffortSummary): Int =
    if (effort.overallRank in 1..3) effort.overallRank else effort.yearRank

@Composable
fun MedalIcon(
    tint: Color,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    Canvas(
        modifier =
            modifier.then(
                contentDescription?.let {
                    Modifier.semantics { this.contentDescription = it }
                } ?: Modifier,
            ),
    ) {
        val scale = minOf(size.width / 24f, size.height / 24f)
        val offsetX = (size.width - 24f * scale) / 2f
        val offsetY = (size.height - 24f * scale) / 2f
        val stroke = Stroke(width = 1.9f, cap = StrokeCap.Round, join = StrokeJoin.Round)

        withTransform({
            translate(offsetX, offsetY)
            scale(scale, scale)
        }) {
            val ribbon =
                Path().apply {
                    moveTo(7.21f, 15f)
                    lineTo(2.66f, 7.14f)
                    quadraticTo(2f, 6f, 4.3f, 4f)
                    lineTo(19.7f, 4f)
                    quadraticTo(22f, 6f, 21.34f, 7.14f)
                    lineTo(16.79f, 15f)
                }
            drawPath(ribbon, tint, style = stroke)
            drawLine(tint, Offset(11f, 12f), Offset(5.12f, 2.2f), strokeWidth = stroke.width, cap = stroke.cap)
            drawLine(tint, Offset(13f, 12f), Offset(18.88f, 2.2f), strokeWidth = stroke.width, cap = stroke.cap)
            drawCircle(tint, radius = 6f, center = Offset(12f, 16f), style = stroke)
            drawLine(tint, Offset(12f, 18f), Offset(12f, 14f), strokeWidth = stroke.width, cap = stroke.cap)
            val notch =
                Path().apply {
                    moveTo(9.5f, 16f)
                    lineTo(12f, 14f)
                    lineTo(14.5f, 16f)
                }
            drawPath(notch, tint, style = stroke)
        }
    }
}

@Composable
private fun AchievementMedal(
    rank: Int,
    showRank: Boolean,
) {
    Box(contentAlignment = Alignment.Center) {
        MedalIcon(
            tint = achievementColor(rank),
            modifier = Modifier.size(width = 34.dp, height = 38.dp),
        )
        if (showRank) {
            Text(
                if (rank == 1) "PR" else rank.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = achievementColor(rank),
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            )
        }
    }
}

private fun Activity.personalRecord(): BestEffortSummary? =
    topBestEfforts
        ?.filter { effort -> effort.overallRank in 1..3 }
        ?.let { records ->
            val powerRecords = records.filter { effort -> effort.type.startsWith("power_") }
            (if (powerRecords.isNotEmpty()) powerRecords else records)
                .maxWithOrNull(
                    compareBy<BestEffortSummary> { powerDuration(it.type) }
                        .thenBy { bestEffortDistance(it.type) }
                        .thenByDescending { -it.overallRank },
                )
        }

private fun achievementText(effort: BestEffortSummary): String {
    val ordinal =
        when (effort.overallRank) {
            2 -> "2nd "
            3 -> "3rd "
            else -> ""
        }
    return when (effort.type) {
        "longest_ride" -> {
            "Your ${ordinal}longest ride!"
        }

        "biggest_climb" -> {
            "Your ${ordinal}biggest climb!"
        }

        else -> {
            if (effort.type.startsWith("power_")) {
                val duration = powerDurationLabel(effort.type)
                "Your ${ordinal}highest power output for $duration ever!"
            } else {
                val verb = if (effort.type == "elevation_gain") "best" else "fastest"
                "Your $ordinal$verb ${bestEffortLabel(effort.type)}!"
            }
        }
    }
}

private fun bestEffortLabel(type: String): String =
    mapOf(
        "400m" to "400 m",
        "1k" to "1K",
        "half_mile" to "1/2 mile",
        "1_mile" to "1 mile",
        "2_miles" to "2 miles",
        "5k" to "5K",
        "10k" to "10K",
        "15k" to "15K",
        "half_marathon" to "Half marathon",
        "marathon" to "Marathon",
        "longest_ride" to "Longest ride",
        "biggest_climb" to "Biggest climb",
        "elevation_gain" to "Elevation gain",
        "power_5s" to "5 sec power",
        "power_15s" to "15 sec power",
        "power_30s" to "30 sec power",
        "power_1m" to "1 min power",
        "power_2m" to "2 min power",
        "power_3m" to "3 min power",
        "power_5m" to "5 min power",
        "power_8m" to "8 min power",
        "power_10m" to "10 min power",
        "power_15m" to "15 min power",
        "power_20m" to "20 min power",
        "power_30m" to "30 min power",
        "power_45m" to "45 min power",
        "power_1h" to "1 hour power",
        "power_2h" to "2 hour power",
    )[type] ?: type

private fun bestEffortDistance(type: String): Double =
    mapOf(
        "400m" to 400.0,
        "1k" to 1_000.0,
        "half_mile" to 804.672,
        "1_mile" to 1_609.344,
        "2_miles" to 3_218.688,
        "5k" to 5_000.0,
        "10k" to 10_000.0,
        "15k" to 15_000.0,
        "half_marathon" to 21_097.5,
        "marathon" to 42_195.0,
        "longest_ride" to Double.POSITIVE_INFINITY,
    )[type] ?: 0.0

private fun powerDuration(type: String): Int =
    Regex("^power_(\\d+)(s|m|h)$").matchEntire(type)?.let { match ->
        val amount = match.groupValues[1].toInt()
        amount *
            when (match.groupValues[2]) {
                "h" -> 3600
                "m" -> 60
                else -> 1
            }
    } ?: 0

private fun powerDurationLabel(type: String): String =
    Regex("^power_(\\d+)(s|m|h)$").matchEntire(type)?.let { match ->
        val amount = match.groupValues[1]
        val unit =
            when (match.groupValues[2]) {
                "h" -> "hour"
                "m" -> "minute"
                else -> "second"
            }
        "$amount $unit${if (amount == "1") "" else "s"}"
    } ?: bestEffortLabel(type).removeSuffix(" power")

private fun rankDescription(rank: Int): String =
    if (rank ==
        1
    ) {
        "personal record for the year"
    } else {
        "number $rank for the year"
    }

private fun achievementColor(rank: Int) =
    when (rank) {
        2 -> {
            Color(0xFF7B8583)
        }

        3 -> {
            Color(0xFFBE6739)
        }

        else -> {
            Color(0xFFEFAA00)
        }
    }

private fun achievementBackground(rank: Int) =
    when (rank) {
        2 -> {
            androidx.compose.ui.graphics
                .Color(0xFFEDF0EF)
        }

        3 -> {
            androidx.compose.ui.graphics
                .Color(0xFFFAE8DC)
        }

        else -> {
            androidx.compose.ui.graphics
                .Color(0xFFFFF2D5)
        }
    }

@Composable
fun ActivityStat(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(value, style = MaterialTheme.typography.titleMedium)
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

fun sportIcon(sport: String): ImageVector =
    when {
        sport.contains("ride") || sport == "velomobile" || sport == "handcycle" -> {
            Icons.AutoMirrored.Rounded.DirectionsBike
        }

        sport.contains("run") -> {
            Icons.AutoMirrored.Rounded.DirectionsRun
        }

        sport == "walk" || sport == "hike" || sport == "snowshoe" -> {
            Icons.Rounded.Hiking
        }

        sport.contains("ski") || sport == "snowboard" -> {
            Icons.Rounded.DownhillSkiing
        }

        sport == "swim" -> {
            Icons.Rounded.Pool
        }

        sport in
            setOf(
                "kayaking",
                "canoeing",
                "rowing",
                "sail",
                "surfing",
                "stand_up_paddling",
            )
        -> {
            Icons.Rounded.Kayaking
        }

        sport in setOf("weight_training", "crossfit", "high_intensity_interval_training") -> {
            Icons.Rounded.FitnessCenter
        }

        sport == "rock_climbing" -> {
            Icons.Rounded.Landscape
        }

        else -> {
            Icons.Rounded.Sports
        }
    }
