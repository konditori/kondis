package app.kondis.recording

import android.location.Location
import java.time.Instant
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

enum class RecordingMode { Idle, Recording, Paused, Saving, Saved, Error }

data class TrackPoint(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double?,
    val recordedAt: Instant,
    val accuracyMeters: Float,
)

data class RecordingState(
    val mode: RecordingMode = RecordingMode.Idle,
    val startedAt: Instant? = null,
    val elapsedSeconds: Long = 0,
    val distanceMeters: Double = 0.0,
    val points: List<TrackPoint> = emptyList(),
    val errorMessage: String? = null,
) {
    val hasLocation: Boolean get() = points.isNotEmpty()
}

fun Location.toTrackPoint() =
    TrackPoint(
        latitude = latitude,
        longitude = longitude,
        altitude = if (hasAltitude()) altitude else null,
        recordedAt = Instant.ofEpochMilli(time),
        accuracyMeters = accuracy,
    )

fun distanceMeters(
    from: TrackPoint,
    to: TrackPoint,
): Double {
    val earthRadius = 6_371_000.0
    val latitudeDelta = Math.toRadians(to.latitude - from.latitude)
    val longitudeDelta = Math.toRadians(to.longitude - from.longitude)
    val a =
        sin(latitudeDelta / 2) * sin(latitudeDelta / 2) +
            cos(Math.toRadians(from.latitude)) * cos(Math.toRadians(to.latitude)) *
            sin(longitudeDelta / 2) * sin(longitudeDelta / 2)
    return earthRadius * 2 * atan2(sqrt(a), sqrt(1 - a))
}
