package app.kondis.data.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.kondis.data.auth.SecureSessionStore
import app.kondis.data.remote.KondisApiFactory
import app.kondis.model.UnitSystem
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.settingsDataStore by preferencesDataStore(name = "settings")

data class AppSettings(
    val serverUrl: String = "",
    val unitSystem: UnitSystem = UnitSystem.Metric,
    val accessToken: String? = null,
    val accountId: String? = null,
) {
    val accountKey: String? get() = accountId?.let { "$serverUrl|$it" }
}

/**
 * Non-sensitive settings (server URL, unit system, account id) live in a plaintext Preferences
 * DataStore, unchanged from before. The Kondis session token now lives in
 * [SecureSessionStore]'s encrypted storage instead, alongside any external OAuth/OIDC session (see
 * [app.kondis.data.auth.ExternalAuthManager]) — both are exempt from Android backup/device
 * transfer, unlike this DataStore file.
 */
@Singleton
class SettingsRepository
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val secureSessionStore: SecureSessionStore,
    ) {
        private val nonSensitiveSettings: Flow<AppSettings> =
            context.settingsDataStore.data
                .catch { error ->
                    if (error is IOException) {
                        emit(
                            androidx.datastore.preferences.core
                                .emptyPreferences(),
                        )
                    } else {
                        throw error
                    }
                }.map { preferences ->
                    AppSettings(
                        serverUrl = preferences[SERVER_URL].orEmpty(),
                        unitSystem =
                            preferences[UNIT_SYSTEM]
                                ?.let { value -> UnitSystem.entries.firstOrNull { it.name == value } }
                                ?: UnitSystem.Metric,
                        accountId = preferences[ACCOUNT_ID],
                    )
                }

        val settings: Flow<AppSettings> =
            combine(nonSensitiveSettings, secureSessionStore.kondisToken) { settings, token ->
                settings.copy(accessToken = token)
            }

        suspend fun setServerUrl(url: String) {
            val normalized = KondisApiFactory.normalizeBaseUrl(url)
            var changed = false
            context.settingsDataStore.edit { preferences ->
                if (preferences[SERVER_URL] != null && preferences[SERVER_URL] != normalized) {
                    preferences.remove(ACCOUNT_ID)
                    changed = true
                }
                preferences[SERVER_URL] = normalized
            }
            if (changed) secureSessionStore.clearAll()
        }

        suspend fun setUnitSystem(unitSystem: UnitSystem) {
            context.settingsDataStore.edit { it[UNIT_SYSTEM] = unitSystem.name }
        }

        /** Clears or replaces only the Kondis session; leaves any external OAuth session untouched. */
        suspend fun setAccessToken(token: String?) {
            secureSessionStore.setKondisToken(token)
            if (token == null) {
                context.settingsDataStore.edit { it.remove(ACCOUNT_ID) }
            }
        }

        suspend fun setSession(
            token: String,
            accountId: String,
        ) {
            secureSessionStore.setKondisToken(token)
            context.settingsDataStore.edit { it[ACCOUNT_ID] = accountId }
        }

        suspend fun setAccountId(accountId: String) {
            context.settingsDataStore.edit { it[ACCOUNT_ID] = accountId }
        }

        private companion object {
            val SERVER_URL = stringPreferencesKey("server_url")
            val UNIT_SYSTEM = stringPreferencesKey("unit_system")
            val ACCOUNT_ID = stringPreferencesKey("account_id")
        }
    }
