package app.kondis.data.settings

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.kondis.BuildConfig
import app.kondis.data.remote.KondisApiFactory
import app.kondis.model.UnitSystem
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

private val Context.settingsDataStore by preferencesDataStore(name = "settings")

data class AppSettings(
    val serverUrl: String = BuildConfig.DEFAULT_API_URL,
    val unitSystem: UnitSystem = UnitSystem.Metric,
)

@Singleton
class SettingsRepository
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
    ) {
        val settings: Flow<AppSettings> =
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
                        serverUrl = preferences[SERVER_URL] ?: BuildConfig.DEFAULT_API_URL,
                        unitSystem =
                            preferences[UNIT_SYSTEM]
                                ?.let { value -> UnitSystem.entries.firstOrNull { it.name == value } }
                                ?: UnitSystem.Metric,
                    )
                }

        suspend fun setServerUrl(url: String) {
            val normalized = KondisApiFactory.normalizeBaseUrl(url)
            context.settingsDataStore.edit { it[SERVER_URL] = normalized }
        }

        suspend fun setUnitSystem(unitSystem: UnitSystem) {
            context.settingsDataStore.edit { it[UNIT_SYSTEM] = unitSystem.name }
        }

        private companion object {
            val SERVER_URL = stringPreferencesKey("server_url")
            val UNIT_SYSTEM = stringPreferencesKey("unit_system")
        }
    }
