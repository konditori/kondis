package app.kondis.recording

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RecordingModeTest {
    @Test
    fun activeRecordingModesStayOnRecordingRoute() {
        assertTrue(RecordingMode.Recording.isActive)
        assertTrue(RecordingMode.Paused.isActive)
        assertTrue(RecordingMode.Saving.isActive)
    }

    @Test
    fun inactiveModesCanLeaveRecordingRoute() {
        assertFalse(RecordingMode.Idle.isActive)
        assertFalse(RecordingMode.Saved.isActive)
        assertFalse(RecordingMode.Error.isActive)
    }
}
