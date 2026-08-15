package app.kondis.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.remote.KondisApiFactory
import app.kondis.data.remote.LoginRequest
import app.kondis.data.settings.AppSettings
import app.kondis.data.settings.SettingsRepository
import app.kondis.recording.RecordingManager
import app.kondis.recording.RecordingState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppViewModel
    @Inject
    constructor(
        private val settingsRepository: SettingsRepository,
        private val apiFactory: KondisApiFactory,
        recordingManager: RecordingManager,
    ) : ViewModel() {
        val settings: StateFlow<AppSettings> =
            settingsRepository.settings.stateIn(
                viewModelScope,
                SharingStarted.WhileSubscribed(5_000),
                AppSettings(),
            )

        val recording: StateFlow<RecordingState> = recordingManager.state

        fun login(
            email: String,
            password: String,
        ) = viewModelScope.launch {
            val settings = settingsRepository.settings.first()
            val response = apiFactory.create(settings.serverUrl).login(LoginRequest(email, password))
            settingsRepository.setAccessToken(response.accessToken)
        }
    }
