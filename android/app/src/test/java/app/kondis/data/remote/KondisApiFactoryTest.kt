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
            "https://kondis.example",
            KondisApiFactory.normalizeBaseUrl("https://kondis.example/api/v1", allowCleartext = false),
        )
    }

    @Test
    fun `deployment root URL resolves to the Kondis API prefix`() {
        assertEquals(
            "https://kondis.example",
            KondisApiFactory.normalizeBaseUrl("https://kondis.example", allowCleartext = false),
        )
    }

    @Test
    fun `Kondis token uses its own header so it never collides with a perimeter bearer token`() {
        val headers = KondisApiFactory.authHeaders(accessToken = "kondis-token", externalAccessToken = null)

        assertEquals(mapOf("X-Kondis-Authorization" to "Bearer kondis-token"), headers)
    }

    @Test
    fun `external OAuth access token is sent as a standard Authorization bearer`() {
        val headers = KondisApiFactory.authHeaders(accessToken = null, externalAccessToken = "cf-access-token")

        assertEquals(mapOf("Authorization" to "Bearer cf-access-token"), headers)
    }

    @Test
    fun `both credentials are attached together when signed in through a perimeter gateway`() {
        val headers =
            KondisApiFactory.authHeaders(
                accessToken = "kondis-token",
                externalAccessToken = "cf-access-token",
            )

        assertEquals(
            mapOf(
                "Authorization" to "Bearer cf-access-token",
                "X-Kondis-Authorization" to "Bearer kondis-token",
            ),
            headers,
        )
    }

    @Test
    fun `no headers are attached before any sign-in has happened`() {
        assertEquals(
            emptyMap<String, String>(),
            KondisApiFactory.authHeaders(accessToken = null, externalAccessToken = null),
        )
    }
}
