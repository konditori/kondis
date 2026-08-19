package app.kondis.data.remote

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class KondisApiFactoryTest {
    @Test
    fun `release URL validation rejects cleartext HTTP`() {
        assertThrows(IllegalArgumentException::class.java) {
            KondisApiFactory.normalizeBaseUrl("http://kondis.example/api/v1", allowCleartext = false)
        }
        assertEquals(
            "https://kondis.example/api/v1/",
            KondisApiFactory.normalizeBaseUrl("https://kondis.example/api/v1", allowCleartext = false),
        )
    }
}
