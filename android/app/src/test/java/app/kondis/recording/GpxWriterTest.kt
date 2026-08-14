package app.kondis.recording

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.time.Instant

class GpxWriterTest {
    @Test
    fun `writes standards-based track with timestamps and elevation`() {
        val destination = Files.createTempFile("kondis-", ".gpx").toFile()
        val start = Instant.parse("2026-08-13T06:00:00Z")
        val recording =
            RecordingState(
                mode = RecordingMode.Saving,
                startedAt = start,
                elapsedSeconds = 10,
                points =
                    listOf(
                        TrackPoint(57.7, 11.9, 14.25, start, 3f),
                        TrackPoint(57.7001, 11.9001, null, start.plusSeconds(10), 4f),
                    ),
            )

        GpxWriter().write(destination, recording, "trail_run")
        val xml = destination.readText()

        assertTrue(xml.contains("<gpx version=\"1.1\""))
        assertTrue(xml.contains("<trkpt lat=\"57.7\" lon=\"11.9\"><ele>14.25</ele>"))
        assertTrue(xml.contains("<time>2026-08-13T06:00:10Z</time>"))
        assertEquals(2, "<trkpt".toRegex().findAll(xml).count())
        destination.delete()
    }

    @Test(expected = IllegalArgumentException::class)
    fun `refuses to create an empty workout`() {
        val destination = Files.createTempFile("kondis-empty-", ".gpx").toFile()
        try {
            GpxWriter().write(destination, RecordingState(), "run")
        } finally {
            destination.delete()
        }
    }
}
