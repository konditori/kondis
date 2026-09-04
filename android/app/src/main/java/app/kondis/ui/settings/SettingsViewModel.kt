package app.kondis.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.data.auth.ExternalAuthManager
import app.kondis.data.settings.AppSettings
import app.kondis.data.settings.SettingsRepository
import app.kondis.model.UnitSystem
import app.kondis.ui.feed.userMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val settings: AppSettings = AppSettings(),
    val serverUrlDraft: String = AppSettings().serverUrl,
    val checking: Boolean = false,
    val message: String? = null,
) {
    val serverActive: Boolean get() = settings.accessToken != null || settings.accountId != null
}

@HiltViewModel
class SettingsViewModel
    @Inject
    constructor(
        private val settingsRepository: SettingsRepository,
        private val activityRepository: ActivityRepository,
        private val externalAuthManager: ExternalAuthManager,
    ) : ViewModel() {
        private val draft = MutableStateFlow<String?>(null)
        private val checking = MutableStateFlow(false)
        private val message = MutableStateFlow<String?>(null)

        val state: StateFlow<SettingsUiState> =
            combine(
                settingsRepository.settings,
                draft,
                checking,
                message,
            ) { settings, draft, checking, message ->
                SettingsUiState(settings, draft ?: settings.serverUrl, checking, message)
            }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SettingsUiState())

        fun setServerUrlDraft(value: String) {
            draft.value = value
            message.value = null
        }

        fun setUnits(units: UnitSystem) {
            viewModelScope.launch { settingsRepository.setUnitSystem(units) }
        }

        fun signOut() {
            viewModelScope.launch {
                runCatching { activityRepository.logout() }
                settingsRepository.setAccessToken(null)
                externalAuthManager.signOut()
            }
        }

        fun saveAndTest() {
            if (checking.value) return
            viewModelScope.launch {
                checking.value = true
                message.value = null
                runCatching {
                    settingsRepository.setServerUrl(state.value.serverUrlDraft)
                    draft.value = null
                    activityRepository.checkConnection()
                }.onSuccess {
                    message.value = "Connected successfully"
                }.onFailure { error ->
                    message.value = error.userMessage()
                }
                checking.value = false
            }
        }
    }
