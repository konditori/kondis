package app.kondis.recording

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

class RecordingPersistenceTest {
    private val store = InMemoryRecordingPersistence()

    @Before
    fun clearBefore() = store.clear()

    @After
    fun clearAfter() = store.clear()

    @Test
    fun `active recording survives manager recreation`() {
        val first = RecordingManager(store)
        assertTrue(first.start())
        first.addPoint(
            TrackPoint(
                latitude = 57.7,
                longitude = 11.9,
                altitude = null,
                recordedAt = Instant.now(),
                accuracyMeters = 3f,
            ),
        )
        first.pause()

        val restored = RecordingManager(store).state.value

        assertEquals(RecordingMode.Paused, restored.mode)
        assertEquals(1, restored.points.size)
        assertEquals(57.7, restored.points.single().latitude, 0.0)
    }
}

private class InMemoryRecordingPersistence : RecordingPersistence {
    private var stored: RestoredRecording? = null

    override fun load(): RestoredRecording? = stored

    override fun save(
        state: RecordingState,
        activeSince: java.time.Instant?,
        elapsedBeforeActive: Long,
    ) {
        stored = RestoredRecording(state, activeSince, elapsedBeforeActive)
    }

    override fun clear() {
        stored = null
    }
}
