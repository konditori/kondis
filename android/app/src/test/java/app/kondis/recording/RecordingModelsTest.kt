package app.kondis.recording

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class RecordingModelsTest {
    @Test
    fun `haversine distance is stable for short workout segments`() {
        val time = Instant.parse("2026-08-13T06:00:00Z")
        val start = TrackPoint(57.7000, 11.9000, null, time, 3f)
        val end = TrackPoint(57.7010, 11.9000, null, time.plusSeconds(30), 3f)

        assertEquals(111.2, distanceMeters(start, end), 0.5)
    }
}
