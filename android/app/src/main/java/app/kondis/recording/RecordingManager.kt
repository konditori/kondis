package app.kondis.recording

import android.location.Location
import java.time.Duration
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

@Singleton
class RecordingManager @Inject constructor() {
    private val mutableState = MutableStateFlow(RecordingState())
    val state: StateFlow<RecordingState> = mutableState.asStateFlow()

    private var activeSince: Instant? = null
    private var elapsedBeforeActive = 0L

    fun start() {
        if (mutableState.value.mode != RecordingMode.Idle && mutableState.value.mode != RecordingMode.Saved) return
        val now = Instant.now()
        activeSince = now
        elapsedBeforeActive = 0
        mutableState.value = RecordingState(mode = RecordingMode.Recording, startedAt = now)
    }

    fun pause() {
        if (mutableState.value.mode != RecordingMode.Recording) return
        updateElapsed()
        elapsedBeforeActive = mutableState.value.elapsedSeconds
        activeSince = null
        mutableState.update { it.copy(mode = RecordingMode.Paused) }
    }

    fun resume() {
        if (mutableState.value.mode != RecordingMode.Paused) return
        activeSince = Instant.now()
        mutableState.update { it.copy(mode = RecordingMode.Recording) }
    }

    fun tick() {
        if (mutableState.value.mode == RecordingMode.Recording) updateElapsed()
    }

    fun addLocation(location: Location) {
        if (mutableState.value.mode != RecordingMode.Recording || location.accuracy > 50f) return
        val point = location.toTrackPoint()
        mutableState.update { current ->
            val previous = current.points.lastOrNull()
            val segment = previous?.let { distanceMeters(it, point) } ?: 0.0
            // Ignore GPS teleports and stationary jitter.
            val plausibleSegment = segment.takeIf { it in 1.5..250.0 } ?: 0.0
            current.copy(
                distanceMeters = current.distanceMeters + plausibleSegment,
                points = current.points + point,
            )
        }
    }

    fun beginSaving(): RecordingState? {
        val current = mutableState.value
        if (current.mode != RecordingMode.Recording && current.mode != RecordingMode.Paused) return null
        updateElapsed()
        val snapshot = mutableState.value.copy(mode = RecordingMode.Saving)
        mutableState.value = snapshot
        activeSince = null
        return snapshot
    }

    fun saved() {
        mutableState.update { it.copy(mode = RecordingMode.Saved) }
    }

    fun fail(message: String) {
        mutableState.update { it.copy(mode = RecordingMode.Error, errorMessage = message) }
    }

    fun reset() {
        activeSince = null
        elapsedBeforeActive = 0
        mutableState.value = RecordingState()
    }

    private fun updateElapsed() {
        val since = activeSince ?: return
        val activeElapsed = Duration.between(since, Instant.now()).seconds.coerceAtLeast(0)
        mutableState.update { it.copy(elapsedSeconds = elapsedBeforeActive + activeElapsed) }
    }
}

