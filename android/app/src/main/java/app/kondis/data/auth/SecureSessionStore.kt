package app.kondis.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holds every secret tied to the app's single active session: the Kondis bearer token and, when
 * signed in through a perimeter OAuth/OIDC gateway, the external authorization state. Backed by
 * [EncryptedSharedPreferences] rather than the plaintext DataStore used for non-sensitive settings,
 * so these values are unreadable if a device backup or root exfiltrates app storage. The
 * `shared_prefs` domain is not covered by `backup_rules.xml`/`data_extraction_rules.xml`'s
 * allow-listed `database`/`datastore` paths, so this file is also never included in Android backups
 * or device-to-device transfer.
 *
 * The app supports exactly one signed-in server at a time (matching [app.kondis.data.settings.SettingsRepository]),
 * so these are single slots rather than keyed by server URL; callers must clear them whenever the
 * configured server URL changes.
 */
@Singleton
class SecureSessionStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs: SharedPreferences by lazy { createEncryptedPrefs(context) }

        /** Reactively emits the Kondis session token so [app.kondis.data.settings.SettingsRepository] can expose it. */
        val kondisToken: Flow<String?> =
            callbackFlow {
                trySend(prefs.getString(KEY_KONDIS_TOKEN, null))
                val listener =
                    SharedPreferences.OnSharedPreferenceChangeListener { changed, key ->
                        if (key == KEY_KONDIS_TOKEN) trySend(changed.getString(KEY_KONDIS_TOKEN, null))
                    }
                prefs.registerOnSharedPreferenceChangeListener(listener)
                awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
            }.distinctUntilChanged()

        suspend fun setKondisToken(token: String?) = put(KEY_KONDIS_TOKEN, token)

        /** The serialized AppAuth `AuthState` (access/refresh tokens, expiry, issuer configuration). */
        suspend fun externalAuthState(): String? = get(KEY_EXTERNAL_AUTH_STATE)

        suspend fun setExternalAuthState(stateJson: String?) = put(KEY_EXTERNAL_AUTH_STATE, stateJson)

        /** The serialized AppAuth `AuthorizationRequest` for a browser sign-in that has not completed yet. */
        suspend fun pendingAuthorizationRequest(): String? = get(KEY_PENDING_AUTHORIZATION_REQUEST)

        suspend fun setPendingAuthorizationRequest(requestJson: String?) =
            put(KEY_PENDING_AUTHORIZATION_REQUEST, requestJson)

        /** Clears the Kondis session only; used when just the Kondis-issued token is invalid or expired. */
        suspend fun clearKondisToken() = setKondisToken(null)

        /** Clears everything tied to the external OAuth/OIDC session, without touching the Kondis token. */
        suspend fun clearExternalAuth() =
            withContext(Dispatchers.IO) {
                prefs.edit {
                    remove(KEY_EXTERNAL_AUTH_STATE)
                    remove(KEY_PENDING_AUTHORIZATION_REQUEST)
                }
            }

        /** Clears the entire session, used when switching servers or signing out completely. */
        suspend fun clearAll() =
            withContext(Dispatchers.IO) {
                prefs.edit { clear() }
            }

        private suspend fun get(key: String): String? = withContext(Dispatchers.IO) { prefs.getString(key, null) }

        private suspend fun put(
            key: String,
            value: String?,
        ) = withContext(Dispatchers.IO) {
            prefs.edit { if (value == null) remove(key) else putString(key, value) }
        }

        private companion object {
            const val KEY_KONDIS_TOKEN = "kondis_token"
            const val KEY_EXTERNAL_AUTH_STATE = "external_auth_state"
            const val KEY_PENDING_AUTHORIZATION_REQUEST = "pending_authorization_request"

            // androidx.security:security-crypto has no non-deprecated replacement as of 1.1.0; this
            // is still the documented way to get an encrypted SharedPreferences file.
            @Suppress("DEPRECATION")
            fun createEncryptedPrefs(context: Context): SharedPreferences {
                val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
                return EncryptedSharedPreferences.create(
                    context,
                    "kondis_secure_session",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
                )
            }
        }
    }
