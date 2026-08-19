package app.kondis.recording

import android.location.Location
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.time.Duration
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecordingManager
    @Inject
    constructor(
        private val store: RecordingPersistence,
    ) {
        private val restored = store.load()
        private val mutableState = MutableStateFlow(restored?.state ?: RecordingState())
        val state: StateFlow<RecordingState> = mutableState.asStateFlow()

        private var activeSince: Instant? = restored?.activeSince
        private var elapsedBeforeActive = restored?.elapsedBeforeActive ?: 0L

        fun start(): Boolean {
            if (mutableState.value.mode != RecordingMode.Idle && mutableState.value.mode != RecordingMode.Saved) {
                return false
            }
            val now = Instant.now()
            activeSince = now
            elapsedBeforeActive = 0
            mutableState.value = RecordingState(mode = RecordingMode.Recording, startedAt = now)
            persist()
            return true
        }

        fun pause() {
            if (mutableState.value.mode != RecordingMode.Recording) return
            updateElapsed()
            elapsedBeforeActive = mutableState.value.elapsedSeconds
            activeSince = null
            mutableState.update { it.copy(mode = RecordingMode.Paused) }
            persist()
        }

        fun resume() {
            if (mutableState.value.mode != RecordingMode.Paused) return
            activeSince = Instant.now()
            mutableState.update { it.copy(mode = RecordingMode.Recording) }
            persist()
        }

        fun tick() {
            if (mutableState.value.mode == RecordingMode.Recording) updateElapsed()
        }

        fun addLocation(location: Location) {
            if (mutableState.value.mode != RecordingMode.Recording || location.accuracy > 50f) return
            addPoint(location.toTrackPoint())
        }

        internal fun addPoint(point: TrackPoint) {
            if (mutableState.value.mode != RecordingMode.Recording || point.accuracyMeters > 50f) return
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
            persist()
        }

        fun beginSaving(): RecordingState? {
            val current = mutableState.value
            if (current.mode != RecordingMode.Recording && current.mode != RecordingMode.Paused) return null
            updateElapsed()
            val snapshot = mutableState.value.copy(mode = RecordingMode.Saving)
            mutableState.value = snapshot
            activeSince = null
            persist()
            return snapshot
        }

        fun saved() {
            mutableState.update { it.copy(mode = RecordingMode.Saved) }
            store.clear()
        }

        fun fail(message: String) {
            mutableState.update { it.copy(mode = RecordingMode.Error, errorMessage = message) }
            persist()
        }

        fun reset() {
            activeSince = null
            elapsedBeforeActive = 0
            mutableState.value = RecordingState()
            store.clear()
        }

        private fun updateElapsed() {
            val since = activeSince ?: return
            val activeElapsed = Duration.between(since, Instant.now()).seconds.coerceAtLeast(0)
            mutableState.update { it.copy(elapsedSeconds = elapsedBeforeActive + activeElapsed) }
        }

        private fun persist() = store.save(mutableState.value, activeSince, elapsedBeforeActive)
    }
