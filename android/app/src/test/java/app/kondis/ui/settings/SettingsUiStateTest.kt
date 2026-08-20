package app.kondis.ui.settings

import app.kondis.data.settings.AppSettings
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsUiStateTest {
    @Test
    fun `server is inactive when signed out`() {
        assertFalse(SettingsUiState(settings = AppSettings()).serverActive)
    }

    @Test
    fun `server is active with a Kondis session`() {
        assertTrue(SettingsUiState(settings = AppSettings(accessToken = "token")).serverActive)
    }

    @Test
    fun `server is active when an account is selected`() {
        assertTrue(SettingsUiState(settings = AppSettings(accountId = "account")).serverActive)
    }
}
