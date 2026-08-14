package app.kondis.ui.record

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.recording.GpxWriter
import app.kondis.recording.RecordingManager
import app.kondis.recording.RecordingMode
import app.kondis.recording.RecordingService
import app.kondis.recording.RecordingState
import app.kondis.ui.feed.userMessage
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
)

@HiltViewModel
class RecordingViewModel
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val manager: RecordingManager,
        private val gpxWriter: GpxWriter,
        private val activityRepository: ActivityRepository,
    ) : ViewModel() {
        private val sport = MutableStateFlow("run")
        val state: StateFlow<RecordingUiState> =
            combine(manager.state, sport) { recording, selectedSport ->
                RecordingUiState(recording, selectedSport)
            }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), RecordingUiState())

        fun setSport(value: String) {
            if (manager.state.value.mode == RecordingMode.Idle) sport.value = value
        }

        fun start() = sendServiceAction(RecordingService.ACTION_START, foreground = true)

        fun pause() = sendServiceAction(RecordingService.ACTION_PAUSE)

        fun resume() = sendServiceAction(RecordingService.ACTION_RESUME)

        fun finish() {
            val snapshot = manager.beginSaving() ?: return
            sendServiceAction(RecordingService.ACTION_STOP)
            viewModelScope.launch {
                runCatching {
                    val directory = File(context.filesDir, "recordings").apply { mkdirs() }
                    val timestamp = snapshot.startedAt ?: Instant.now()
                    val file = File(directory, "kondis-${timestamp.toEpochMilli()}.gpx")
                    gpxWriter.write(file, snapshot, sport.value)
                    activityRepository.uploadGpx(file)
                    file.delete()
                }.onSuccess {
                    manager.saved()
                }.onFailure { error ->
                    manager.fail("${error.userMessage()}. The GPX remains saved on this device.")
                }
            }
        }

        fun reset() = manager.reset()

        fun discard() {
            sendServiceAction(RecordingService.ACTION_STOP)
            manager.reset()
        }

        private fun sendServiceAction(
            action: String,
            foreground: Boolean = false,
        ) {
            val intent = Intent(context, RecordingService::class.java).setAction(action)
            if (foreground) ContextCompat.startForegroundService(context, intent) else context.startService(intent)
        }
    }
