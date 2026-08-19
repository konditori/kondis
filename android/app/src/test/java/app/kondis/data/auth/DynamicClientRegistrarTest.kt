package app.kondis.data.auth

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class DynamicClientRegistrarTest {
    private lateinit var server: MockWebServer
    private lateinit var registrar: DynamicClientRegistrar

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        registrar =
            DynamicClientRegistrar(
                OkHttpClient(),
                Json {
                    ignoreUnknownKeys = true
                    encodeDefaults = true
                },
            )
    }

    @After
    fun tearDown() {
        server.close()
    }

    @Test
    fun `accepts a public client response without secret metadata`() =
        runTest {
            server.enqueue(
                MockResponse(
                    201,
                    body =
                        """
                        {
                          "client_id": "cloudflare-client",
                          "redirect_uris": ["app.kondis:///oauth-callback"],
                          "token_endpoint_auth_method": "none"
                        }
                        """.trimIndent(),
                ),
            )

            val clientId =
                registrar.register(
                    server.url("/registration").toString(),
                    "app.kondis:///oauth-callback",
                    "https://kondis.example/",
                )

            assertEquals("cloudflare-client", clientId)
            val requestBody =
                server
                    .takeRequest()
                    .body
                    ?.utf8()
                    .orEmpty()
            assertTrue(requestBody.contains("\"redirect_uris\":[\"app.kondis:///oauth-callback\"]"))
            assertTrue(requestBody.contains("\"client_name\":\"Kondis\""))
            assertTrue(requestBody.contains("\"client_uri\":\"https://kondis.example/\""))
            assertTrue(requestBody.contains("\"token_endpoint_auth_method\":\"none\""))
        }

    @Test
    fun `surfaces the authorization server registration error`() =
        runTest {
            server.enqueue(
                MockResponse(
                    400,
                    body =
                        """
                        {
                          "error": "invalid_client_metadata",
                          "error_description": "redirect_uri is not allowed"
                        }
                        """.trimIndent(),
                ),
            )

            val error =
                runCatching {
                    registrar.register(
                        server.url("/registration").toString(),
                        "app.kondis:///oauth-callback",
                        "https://kondis.example/",
                    )
                }.exceptionOrNull()

            assertEquals("redirect_uri is not allowed", error?.message)
        }
}
