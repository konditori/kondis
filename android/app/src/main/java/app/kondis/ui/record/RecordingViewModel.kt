package app.kondis.ui.record

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.model.defaultWorkoutTitle
import app.kondis.recording.GpxWriter
import app.kondis.recording.EmptyRecordingException
import app.kondis.recording.LiveTrackingRepository
import app.kondis.recording.RecordingManager
import app.kondis.recording.RecordingMode
import app.kondis.recording.RecordingService
import app.kondis.recording.RecordingState
import app.kondis.recording.TrackPoint
import app.kondis.recording.toTrackPoint
import app.kondis.ui.feed.userMessage
import app.kondis.ui.i18n.tr
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import javax.inject.Inject

data class RecordingUiState(
    val recording: RecordingState = RecordingState(),
    val sport: String = "run",
    val title: String = "",
    val uploading: Boolean = false,
    val savedActivityId: String? = null,
    val gpsFix: TrackPoint? = null,
)

@HiltViewModel
class RecordingViewModel
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val manager: RecordingManager,
        private val gpxWriter: GpxWriter,
        private val activityRepository: ActivityRepository,
        private val liveTracking: LiveTrackingRepository,
    ) : ViewModel() {
        private val sport = MutableStateFlow("run")
        private val title = MutableStateFlow("")
        private val uploading = MutableStateFlow(false)
        private val savedActivityId = MutableStateFlow<String?>(null)
        private val gpsFix = MutableStateFlow<TrackPoint?>(null)
        private val locationManager = context.getSystemService(LocationManager::class.java)
        private var warmingGps = false
        private val gpsListener = LocationListener { location -> gpsFix.value = location.toTrackPoint() }
        val state: StateFlow<RecordingUiState> =
            combine(
                combine(manager.state, gpsFix) { recording, fix -> recording to fix },
                sport,
                title,
                uploading,
                savedActivityId,
            ) { recordingWithFix, selectedSport, activityTitle, isUploading, activityId ->
                RecordingUiState(
                    recording = recordingWithFix.first,
                    sport = selectedSport,
                    title = activityTitle,
                    uploading = isUploading,
                    savedActivityId = activityId,
                    gpsFix = recordingWithFix.second,
                )
            }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), RecordingUiState())

        fun setSport(value: String) {
            if (manager.state.value.mode == RecordingMode.Idle) sport.value = value
        }

        /** Begins acquiring a fix while the record screen is open, before a workout starts. */
        fun warmUpGps() {
            if (warmingGps || manager.state.value.mode != RecordingMode.Idle) return
            if (
                ActivityCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
            try {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1_000L,
                    1f,
                    gpsListener,
                    Looper.getMainLooper(),
                )
                warmingGps = true
            } catch (_: IllegalArgumentException) {
                // The recording service will surface an actionable error if the user starts a workout.
            } catch (_: SecurityException) {
                // Permission may have been revoked between the check and this request.
            }
        }

        fun start() {
            stopGpsWarmup()
            sendServiceAction(RecordingService.ACTION_START, foreground = true, sport = sport.value)
        }

        fun pause() = sendServiceAction(RecordingService.ACTION_PAUSE)

        fun resume() = sendServiceAction(RecordingService.ACTION_RESUME)

        fun finish() {
            val snapshot = manager.beginSaving() ?: return
            title.value = defaultWorkoutTitle(sport.value, snapshot.startedAt ?: Instant.now())
            uploading.value = false
            savedActivityId.value = null
            viewModelScope.launch { runCatching { liveTracking.updateState("ended", snapshot) } }
            sendServiceAction(RecordingService.ACTION_STOP)
        }

        fun setTitle(value: String) {
            if (!uploading.value) title.value = value.take(200)
        }

        fun saveReview() {
            if (manager.state.value.mode != RecordingMode.Saving || uploading.value) return
            val snapshot = manager.state.value
            uploading.value = true
            viewModelScope.launch {
                runCatching {
                    val directory = File(context.filesDir, "recordings").apply { mkdirs() }
                    val timestamp = snapshot.startedAt ?: Instant.now()
                    val file = File(directory, "kondis-${timestamp.toEpochMilli()}.gpx")
                    gpxWriter.write(file, snapshot, sport.value, title.value)
                    activityRepository.queueRecordedWorkout(file, snapshot, sport.value, title.value)
                }.onSuccess {
                    uploading.value = false
                    manager.saved()
                    savedActivityId.value = it
                }.onFailure { error ->
                    uploading.value = false
                    val message =
                        if (error is EmptyRecordingException) {
                            context.tr("no_gps_trace")
                        } else {
                            error.userMessage()
                        }
                    manager.fail("$message. The GPX remains saved on this device.")
                }
            }
        }

        fun reset() {
            uploading.value = false
            title.value = ""
            savedActivityId.value = null
            manager.reset()
        }

        fun consumeSavedActivity() {
            savedActivityId.value = null
        }

        fun discard() {
            viewModelScope.launch { runCatching { liveTracking.discard() } }
            sendServiceAction(RecordingService.ACTION_STOP)
            manager.reset()
        }

        fun shareLive() {
            viewModelScope.launch { runCatching { liveTracking.share() } }
        }

        private fun sendServiceAction(
            action: String,
            foreground: Boolean = false,
            sport: String? = null,
        ) {
            val intent =
                Intent(context, RecordingService::class.java)
                    .setAction(action)
                    .apply { sport?.let { putExtra(RecordingService.EXTRA_SPORT, it) } }
            if (foreground) ContextCompat.startForegroundService(context, intent) else context.startService(intent)
        }

        private fun stopGpsWarmup() {
            if (!warmingGps) return
            locationManager.removeUpdates(gpsListener)
            warmingGps = false
        }

        override fun onCleared() {
            stopGpsWarmup()
        }
    }
