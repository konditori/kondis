package app.kondis.model

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import java.util.Locale

class FormattingTest {
    private lateinit var originalLocale: Locale

    @Before
    fun setUp() {
        originalLocale = Locale.getDefault()
        Locale.setDefault(Locale.US)
    }

    @After
    fun tearDown() {
        Locale.setDefault(originalLocale)
    }

    @Test
    fun `distance uses readable precision`() {
        assertEquals("5.00 km", formatDistance(5_000.0, UnitSystem.Metric))
        assertEquals("42.2 km", formatDistance(42_195.0, UnitSystem.Metric))
        assertEquals("3.11 mi", formatDistance(5_000.0, UnitSystem.Imperial))
    }

    @Test
    fun `duration expands to hours when necessary`() {
        assertEquals("4:07", formatDuration(247.0))
        assertEquals("1:02:03", formatDuration(3_723.0))
    }

    @Test
    fun `pace handles invalid speed`() {
        assertEquals("—", formatPace(0.0, UnitSystem.Metric))
        assertEquals("5:00 /km", formatPace(1_000.0 / 300.0, UnitSystem.Metric))
    }
}
