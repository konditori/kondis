package app.kondis.model

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlin.math.roundToInt

enum class UnitSystem { Metric, Imperial }

fun Activity.displayName(): String = name?.takeIf(String::isNotBlank) ?: sportLabel(sport)

fun sportLabel(sport: String): String =
    sport
        .replace('_', ' ')
        .split(' ')
        .joinToString(" ") { word -> word.replaceFirstChar { it.titlecase(Locale.getDefault()) } }
        .replace("E Bike", "E-bike")
        .replace("Hiit", "HIIT")

fun defaultWorkoutTitle(
    sport: String,
    startedAt: Instant,
): String {
    val hour = startedAt.atZone(ZoneId.systemDefault()).hour
    val timeOfDay =
        when (hour) {
            in 5..11 -> "Morning"
            in 12..16 -> "Afternoon"
            in 17..21 -> "Evening"
            else -> "Night"
        }
    val activity =
        when (sport.lowercase(Locale.ROOT)) {
            "run", "trail_run" -> "Run"
            "walk", "hike" -> "Walk"
            "ride", "virtual_ride", "ebike" -> "Ride"
            "swim" -> "Swim"
            else -> "Workout"
        }
    return "$timeOfDay $activity"
}

fun formatDistance(
    meters: Double?,
    units: UnitSystem,
): String {
    if (meters == null) return "—"
    val distance = if (units == UnitSystem.Metric) meters / 1_000 else meters / 1_609.344
    val value = (if (distance >= 10) "%.1f" else "%.2f").formatValue(distance)
    return "$value ${if (units == UnitSystem.Metric) "km" else "mi"}"
}

fun formatElevation(
    meters: Double?,
    units: UnitSystem,
): String =
    when {
        meters == null -> "—"
        units == UnitSystem.Metric -> "${meters.roundToInt()} m"
        else -> "${(meters * 3.28084).roundToInt()} ft"
    }

fun formatDuration(seconds: Double?): String {
    if (seconds == null) return "—"
    val duration = Duration.ofSeconds(seconds.roundToInt().coerceAtLeast(0).toLong())
    val hours = duration.toHours()
    val minutes = duration.toMinutesPart()
    val secs = duration.toSecondsPart()
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, secs) else "%d:%02d".format(minutes, secs)
}

fun formatPace(
    metersPerSecond: Double?,
    units: UnitSystem,
    swim: Boolean = false,
): String {
    if (metersPerSecond == null || metersPerSecond <= 0) return "—"
    val distance =
        when {
            swim && units == UnitSystem.Metric -> 100.0
            swim -> 91.44
            units == UnitSystem.Metric -> 1_000.0
            else -> 1_609.344
        }
    val seconds = (distance / metersPerSecond).roundToInt()
    val unit =
        when {
            swim && units == UnitSystem.Metric -> "100m"
            swim -> "100yd"
            units == UnitSystem.Metric -> "km"
            else -> "mi"
        }
    return "%d:%02d /%s".format(seconds / 60, seconds % 60, unit)
}

fun formatSpeed(
    metersPerSecond: Double?,
    units: UnitSystem,
): String {
    if (metersPerSecond == null) return "—"
    return if (units == UnitSystem.Metric) {
        "%.1f km/h".formatValue(metersPerSecond * 3.6)
    } else {
        "%.1f mph".formatValue(metersPerSecond * 2.236936)
    }
}

fun formatDateTime(instant: String): String =
    runCatching {
        DateTimeFormatter
            .ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withZone(ZoneId.systemDefault())
            .format(Instant.parse(instant))
    }.getOrDefault(instant)

private fun String.formatValue(value: Double): String = String.format(Locale.getDefault(), this, value)
