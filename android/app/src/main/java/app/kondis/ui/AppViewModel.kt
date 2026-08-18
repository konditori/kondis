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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

@HiltViewModel
class AppViewModel
    @Inject
    constructor(
        private val settingsRepository: SettingsRepository,
        private val apiFactory: KondisApiFactory,
        recordingManager: RecordingManager,
    ) : ViewModel() {
        private val _loginError = MutableStateFlow<String?>(null)

        val loginError: StateFlow<String?> = _loginError

        val settings: StateFlow<AppSettings> =
            settingsRepository.settings.stateIn(
                viewModelScope,
                SharingStarted.WhileSubscribed(5_000),
                AppSettings(),
            )

        val recording: StateFlow<RecordingState> = recordingManager.state

        init {
            viewModelScope.launch {
                val settings = settingsRepository.settings.first()
                val token = settings.accessToken ?: return@launch
                runCatching {
                    apiFactory.create(settings.serverUrl, token).me()
                }.onFailure { error ->
                    if (error is HttpException && error.code() in setOf(401, 403, 404)) {
                        settingsRepository.setAccessToken(null)
                    }
                }.onSuccess { user -> settingsRepository.setAccountId(user.id) }
            }
        }

        fun login(
            serverUrl: String,
            email: String,
            password: String,
        ) = viewModelScope.launch {
            _loginError.value = null
            runCatching {
                settingsRepository.setServerUrl(serverUrl)
                val settings = settingsRepository.settings.first()
                apiFactory.create(settings.serverUrl).login(LoginRequest(email.trim(), password))
            }.onSuccess { response ->
                settingsRepository.setSession(response.accessToken, response.user.id)
            }.onFailure { error ->
                _loginError.value = error.message ?: "Unable to sign in"
            }
        }
    }
