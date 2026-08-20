package app.kondis.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.kondis.model.Activity
import app.kondis.model.BestEffortSummary
import app.kondis.ui.i18n.tr

@Composable
fun MedalIcon(tint: Color, modifier: Modifier = Modifier, contentDescription: String? = null) {
    Canvas(modifier = modifier.then(contentDescription?.let { Modifier.semantics { this.contentDescription = it } } ?: Modifier)) {
        val scale = minOf(size.width / 24f, size.height / 24f)
        val offsetX = (size.width - 24f * scale) / 2f
        val offsetY = (size.height - 24f * scale) / 2f
        val stroke = Stroke(width = 1.9f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        withTransform({ translate(offsetX, offsetY); scale(scale, scale, pivot = Offset.Zero) }) {
            val ribbon = Path().apply {
                moveTo(7.21f, 15f); lineTo(2.66f, 7.14f); quadraticTo(2f, 6f, 4.3f, 4f)
                lineTo(19.7f, 4f); quadraticTo(22f, 6f, 21.34f, 7.14f); lineTo(16.79f, 15f)
            }
            drawPath(ribbon, tint, style = stroke)
            drawLine(tint, Offset(11f, 12f), Offset(5.12f, 2.2f), strokeWidth = stroke.width, cap = stroke.cap)
            drawLine(tint, Offset(13f, 12f), Offset(18.88f, 2.2f), strokeWidth = stroke.width, cap = stroke.cap)
            drawCircle(tint, radius = 6f, center = Offset(12f, 16f), style = stroke)
            drawLine(tint, Offset(12f, 18f), Offset(12f, 14f), strokeWidth = stroke.width, cap = stroke.cap)
            val notch = Path().apply { moveTo(9.5f, 16f); lineTo(12f, 14f); lineTo(14.5f, 16f) }
            drawPath(notch, tint, style = stroke)
        }
    }
}

@Composable
internal fun AchievementBadge(effort: BestEffortSummary) {
    Box(modifier = Modifier.size(width = 22.dp, height = 24.dp), contentAlignment = Alignment.Center) {
        MedalIcon(
            tint = achievementColor(achievementRank(effort)),
            contentDescription =
                tr(
                    "achievement_badge_description",
                    bestEffortLabel(effort.type),
                    rankDescription(achievementRank(effort)),
                ),
            modifier = Modifier.size(24.dp),
        )
    }
}

@Composable
internal fun AchievementMedal(rank: Int, showRank: Boolean) {
    Box(contentAlignment = Alignment.Center) {
        MedalIcon(tint = achievementColor(rank), modifier = Modifier.size(width = 34.dp, height = 38.dp))
        if (showRank) {
            Text(if (rank == 1) "PR" else rank.toString(), style = MaterialTheme.typography.labelSmall, color = achievementColor(rank), fontWeight = FontWeight.Bold)
        }
    }
}

internal fun achievementRank(effort: BestEffortSummary): Int = if (effort.overallRank in 1..3) effort.overallRank else effort.yearRank

internal fun distinctAchievementEfforts(efforts: List<BestEffortSummary>): List<BestEffortSummary> = efforts.sortedBy(::achievementRank).distinctBy(::achievementRank).take(3)

internal fun shouldShowAchievementCount(count: Int, efforts: List<BestEffortSummary>): Boolean {
    if (count <= 1) return false
    val ranks = distinctAchievementEfforts(efforts).mapTo(mutableSetOf(), ::achievementRank)
    if (count == 2 && ranks.containsAll(listOf(2, 3))) return false
    if (count == 3 && ranks.containsAll(listOf(1, 2, 3))) return false
    return true
}

internal fun Activity.personalRecord(): BestEffortSummary? = topBestEfforts
    ?.filter { it.overallRank in 1..3 }
    ?.let { records ->
        val powerRecords = records.filter { it.type.startsWith("power_") }
        (if (powerRecords.isNotEmpty()) powerRecords else records).maxWithOrNull(
            compareBy<BestEffortSummary> { powerDuration(it.type) }
                .thenBy { bestEffortDistance(it.type) }
                .thenByDescending { -it.overallRank },
        )
    }

internal fun achievementText(effort: BestEffortSummary): String {
    val ordinal = when (effort.overallRank) { 2 -> "2nd "; 3 -> "3rd "; else -> "" }
    return when (effort.type) {
        "longest_ride" -> "Your ${ordinal}longest ride!"
        "biggest_climb" -> "Your ${ordinal}biggest climb!"
        else -> if (effort.type.startsWith("power_")) {
            "Your ${ordinal}highest power output for ${powerDurationLabel(effort.type)} ever!"
        } else {
            val verb = if (effort.type == "elevation_gain") "best" else "fastest"
            "Your $ordinal$verb ${bestEffortLabel(effort.type)}!"
        }
    }
}

internal fun bestEffortLabel(type: String): String = mapOf(
    "400m" to "400 m", "1k" to "1K", "half_mile" to "1/2 mile", "1_mile" to "1 mile", "2_miles" to "2 miles",
    "5k" to "5K", "10k" to "10K", "15k" to "15K", "half_marathon" to "Half marathon", "marathon" to "Marathon",
    "longest_ride" to "Longest ride", "biggest_climb" to "Biggest climb", "elevation_gain" to "Elevation gain",
    "power_5s" to "5 sec power", "power_15s" to "15 sec power", "power_30s" to "30 sec power", "power_1m" to "1 min power",
    "power_2m" to "2 min power", "power_3m" to "3 min power", "power_5m" to "5 min power", "power_8m" to "8 min power",
    "power_10m" to "10 min power", "power_15m" to "15 min power", "power_20m" to "20 min power", "power_30m" to "30 min power",
    "power_45m" to "45 min power", "power_1h" to "1 hour power", "power_2h" to "2 hour power",
)[type] ?: type

private fun bestEffortDistance(type: String): Double = mapOf(
    "400m" to 400.0, "1k" to 1_000.0, "half_mile" to 804.672, "1_mile" to 1_609.344, "2_miles" to 3_218.688,
    "5k" to 5_000.0, "10k" to 10_000.0, "15k" to 15_000.0, "half_marathon" to 21_097.5, "marathon" to 42_195.0,
    "longest_ride" to Double.POSITIVE_INFINITY,
)[type] ?: 0.0

private fun powerDuration(type: String): Int = Regex("^power_(\\d+)(s|m|h)$").matchEntire(type)?.let {
    it.groupValues[1].toInt() * when (it.groupValues[2]) { "h" -> 3600; "m" -> 60; else -> 1 }
} ?: 0

private fun powerDurationLabel(type: String): String = Regex("^power_(\\d+)(s|m|h)$").matchEntire(type)?.let {
    val amount = it.groupValues[1]
    val unit = when (it.groupValues[2]) { "h" -> "hour"; "m" -> "minute"; else -> "second" }
    "$amount $unit${if (amount == "1") "" else "s"}"
} ?: bestEffortLabel(type).removeSuffix(" power")

internal fun rankDescription(rank: Int): String = if (rank == 1) "personal record for the year" else "number $rank for the year"

internal fun achievementColor(rank: Int) = when (rank) { 2 -> Color(0xFF7B8583); 3 -> Color(0xFFBE6739); else -> Color(0xFFEFAA00) }
