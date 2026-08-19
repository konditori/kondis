package app.kondis.ui

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.auth.AuthTabLaunch
import app.kondis.data.auth.AuthorizationOutcome
import app.kondis.data.auth.ExternalAuthManager
import app.kondis.data.auth.ServerCapability
import app.kondis.data.auth.ServerCapabilityProber
import app.kondis.data.remote.KondisApiFactory
import app.kondis.data.remote.LoginRequest
import app.kondis.data.settings.AppSettings
import app.kondis.data.settings.SettingsRepository
import app.kondis.recording.RecordingManager
import app.kondis.recording.RecordingState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import retrofit2.HttpException
import javax.inject.Inject

/**
 * Where the sign-in screen currently stands. A configured server is checked once (see
 * [AppViewModel.checkServer]) to detect whether it is reachable directly or sits behind a
 * perimeter OAuth/OIDC gateway, before any credentials are ever sent.
 */
sealed interface LoginStage {
    data object EnteringServer : LoginStage

    data object CheckingServer : LoginStage

    /** No gateway detected; sign in with a Kondis email and password. */
    data class DirectReady(
        val serverUrl: String,
    ) : LoginStage

    /** A standards-based OAuth/OIDC gateway protects this server; sign in through the browser first. */
    data class OAuthReady(
        val serverUrl: String,
        val capability: ServerCapability.ExternalOAuth,
    ) : LoginStage

    /** The browser sign-in succeeded; a Kondis email and password are still required. */
    data class OAuthSignedIn(
        val serverUrl: String,
    ) : LoginStage

    /** A gateway is present but this app cannot complete its login automatically. */
    data class UnsupportedGateway(
        val serverUrl: String,
        val reason: String,
    ) : LoginStage
}

@HiltViewModel
class AppViewModel
    @Inject
    constructor(
        private val settingsRepository: SettingsRepository,
        private val apiFactory: KondisApiFactory,
        private val capabilityProber: ServerCapabilityProber,
        private val externalAuthManager: ExternalAuthManager,
        recordingManager: RecordingManager,
    ) : ViewModel() {
        private val _loginError = MutableStateFlow<String?>(null)
        val loginError: StateFlow<String?> = _loginError

        private val _loginStage = MutableStateFlow<LoginStage>(LoginStage.EnteringServer)
        val loginStage: StateFlow<LoginStage> = _loginStage

        private val _browserLaunch = MutableSharedFlow<AuthTabLaunch>(extraBufferCapacity = 1)

        /**
         * Emits what to launch for the external browser sign-in step. Collected by `MainActivity`,
         * which owns the Auth Tab activity-result launcher (it must be registered on an
         * `ActivityResultCaller`, which a `@Composable` function is not).
         */
        val browserLaunch: SharedFlow<AuthTabLaunch> = _browserLaunch.asSharedFlow()

        /** True once the perimeter OAuth/OIDC session expired or was revoked and must be redone. */
        val reauthorizationRequired: StateFlow<Boolean> = externalAuthManager.reauthorizationRequired

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
                    apiFactory.create(settings).me()
                }.onFailure { error ->
                    if (error is HttpException && error.code() in setOf(401, 403, 404)) {
                        settingsRepository.setAccessToken(null)
                    }
                }.onSuccess { user -> settingsRepository.setAccountId(user.id) }
            }
            viewModelScope.launch {
                externalAuthManager.reauthorizationRequired.collect { required ->
                    if (required) checkServer(settingsRepository.settings.first().serverUrl)
                }
            }
        }

        /** Probes [rawUrl] without sending any credentials, then advances [loginStage] accordingly. */
        fun checkServer(rawUrl: String) =
            viewModelScope.launch {
                _loginError.value = null
                _loginStage.value = LoginStage.CheckingServer
                runCatching {
                    settingsRepository.setServerUrl(rawUrl)
                    val serverUrl = settingsRepository.settings.first().serverUrl
                    serverUrl to capabilityProber.probe(serverUrl)
                }.onSuccess { (serverUrl, capability) ->
                    when (capability) {
                        is ServerCapability.Direct -> {
                            _loginStage.value = LoginStage.DirectReady(serverUrl)
                        }

                        is ServerCapability.ExternalOAuth -> {
                            val stage = LoginStage.OAuthReady(serverUrl, capability)
                            _loginStage.value = stage
                            launchExternalAuth(stage)
                        }

                        is ServerCapability.UnsupportedGateway -> {
                            _loginStage.value =
                                LoginStage.UnsupportedGateway(
                                    serverUrl,
                                    capability.reason,
                                )
                        }
                    }
                }.onFailure { error ->
                    _loginError.value = error.message ?: "Unable to reach the server"
                    _loginStage.value = LoginStage.EnteringServer
                }
            }

        /** Starts the browser sign-in step for the currently detected OAuth gateway, if any. */
        fun startExternalAuth() =
            viewModelScope.launch {
                val stage = _loginStage.value as? LoginStage.OAuthReady ?: return@launch
                launchExternalAuth(stage)
            }

        private suspend fun launchExternalAuth(stage: LoginStage.OAuthReady) {
            _loginError.value = null
            runCatching { externalAuthManager.prepareAuthorizationRequest(stage.capability) }
                .onSuccess { launch -> _browserLaunch.emit(launch) }
                .onFailure { error -> _loginError.value = error.message ?: "Unable to start browser sign-in" }
        }

        /** Call with the result from launching the [AuthTabLaunch] emitted on [browserLaunch]. */
        fun handleAuthTabResult(
            resultCode: Int,
            resultUri: Uri?,
        ) = viewModelScope.launch {
            applyOutcome(externalAuthManager.completeAuthorization(resultCode, resultUri))
        }

        private fun applyOutcome(outcome: AuthorizationOutcome) {
            val stage = _loginStage.value as? LoginStage.OAuthReady ?: return
            when (outcome) {
                is AuthorizationOutcome.Success -> _loginStage.value = LoginStage.OAuthSignedIn(stage.serverUrl)
                is AuthorizationOutcome.Failure -> _loginError.value = outcome.message
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
                apiFactory.create(settings).login(LoginRequest(email.trim(), password))
            }.onSuccess { response ->
                settingsRepository.setSession(response.accessToken, response.user.id)
                _loginStage.value = LoginStage.EnteringServer
            }.onFailure { error ->
                if (error is HttpException && error.code() in 300..399) {
                    _loginError.value =
                        "The server redirected the API login request. Check that the configured URL points to the Kondis API."
                } else {
                    _loginError.value = error.message ?: "Unable to sign in"
                }
            }
        }
    }
