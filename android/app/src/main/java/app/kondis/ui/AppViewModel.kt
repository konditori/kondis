package app.kondis.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.settings.AppSettings
import app.kondis.data.settings.SettingsRepository
import app.kondis.recording.RecordingManager
import app.kondis.recording.RecordingState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class AppViewModel
    @Inject
    constructor(
        settingsRepository: SettingsRepository,
        recordingManager: RecordingManager,
    ) : ViewModel() {
        val settings: StateFlow<AppSettings> =
            settingsRepository.settings.stateIn(
                viewModelScope,
                SharingStarted.WhileSubscribed(5_000),
                AppSettings(),
            )

        val recording: StateFlow<RecordingState> = recordingManager.state
    }
