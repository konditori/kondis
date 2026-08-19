package app.kondis.data.auth

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import okhttp3.Headers
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ServerCapabilityProberTest {
    private lateinit var server: MockWebServer
    private lateinit var prober: ServerCapabilityProber

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        prober = ServerCapabilityProber(OkHttpClient(), Json { ignoreUnknownKeys = true })
    }

    @After
    fun tearDown() {
        server.close()
    }

    @Test
    fun `a clean 200 response means the deployment can be signed in to directly`() =
        runTest {
            server.dispatcher = respondTo("/api/v1/auth/capabilities" to response(200, "{\"direct\":true}"))

            val capability = prober.probe(server.url("/api/v1/").toString())

            assertEquals(ServerCapability.Direct, capability)
        }

    @Test
    fun `path-specific resource metadata still requests a token for the configured server`() =
        runTest {
            val resourceMetadataUrl = server.url("/.well-known/oauth-protected-resource").toString()
            val issuer = server.url("/").toString()
            server.dispatcher =
                respondTo(
                    "/api/v1/auth/capabilities" to
                        response(
                            401,
                            body = "",
                            headers =
                                Headers
                                    .Builder()
                                    .add(
                                        "WWW-Authenticate",
                                        "Bearer resource_metadata=\"$resourceMetadataUrl\"",
                                    ).build(),
                        ),
                    "/.well-known/oauth-protected-resource" to
                        response(
                            200,
                            """{"resource":"${server.url(
                                "/api/v1/auth/capabilities",
                            )}","authorization_servers":["$issuer"],"scopes_supported":["profile"]}""",
                        ),
                    "/.well-known/oauth-authorization-server" to
                        response(
                            200,
                            """{"issuer":"$issuer","authorization_endpoint":"${issuer}authorize","token_endpoint":"${issuer}token"}""",
                        ),
                )

            val capability = prober.probe(server.url("/api/v1/").toString()) as ServerCapability.ExternalOAuth

            assertEquals(server.url("/api/v1").toString(), capability.resource)
            assertEquals(listOf("profile"), capability.scopes)
        }

    @Test
    fun `a bare 401 challenge falls back to the Cloudflare-documented direct well-known shape`() =
        runTest {
            val issuer = server.url("/").toString()
            server.dispatcher =
                respondTo(
                    "/api/v1/auth/capabilities" to
                        response(
                            401,
                            body = "",
                            headers =
                                Headers
                                    .Builder()
                                    .add(
                                        "WWW-Authenticate",
                                        "Bearer realm=\"Cloudflare Access\"",
                                    ).build(),
                        ),
                    "/.well-known/oauth-authorization-server" to
                        response(
                            200,
                            """{"issuer":"$issuer","authorization_endpoint":"${issuer}authorize","token_endpoint":"${issuer}token"}""",
                        ),
                )

            val capability = prober.probe(server.url("/api/v1/").toString()) as ServerCapability.ExternalOAuth

            assertEquals(issuer, capability.issuer)
            assertEquals("${issuer}authorize", capability.authorizationEndpoint)
        }

    @Test
    fun `a 401 with no discoverable metadata anywhere is reported as an unsupported gateway`() =
        runTest {
            server.dispatcher =
                respondTo(
                    "/api/v1/auth/capabilities" to response(401, ""),
                )

            val capability = prober.probe(server.url("/api/v1/").toString())

            assertTrue(capability is ServerCapability.UnsupportedGateway)
            assertTrue((capability as ServerCapability.UnsupportedGateway).reason.contains("does not advertise"))
        }

    @Test
    fun `a redirect to a Cloudflare Access login page names Managed OAuth as the fix`() =
        runTest {
            server.dispatcher =
                respondTo(
                    "/api/v1/auth/capabilities" to
                        response(
                            302,
                            "",
                            Headers
                                .Builder()
                                .add(
                                    "Location",
                                    "https://myteam.cloudflareaccess.com/cdn-cgi/access/login",
                                ).build(),
                        ),
                )

            val capability = prober.probe(server.url("/api/v1/").toString())

            assertTrue(capability is ServerCapability.UnsupportedGateway)
            assertTrue((capability as ServerCapability.UnsupportedGateway).reason.contains("Managed OAuth"))
        }

    @Test
    fun `a redirect to an unrecognized login page is reported generically`() =
        runTest {
            server.dispatcher =
                respondTo(
                    "/api/v1/auth/capabilities" to
                        response(302, "", Headers.Builder().add("Location", "https://sso.example.com/login").build()),
                )

            val capability = prober.probe(server.url("/api/v1/").toString())

            assertTrue(capability is ServerCapability.UnsupportedGateway)
            assertTrue((capability as ServerCapability.UnsupportedGateway).reason.contains("cannot complete"))
        }

    @Test
    fun `an unreachable server is reported without throwing`() =
        runTest {
            val unreachableUrl = server.url("/api/v1/").toString()
            server.close()

            val capability = prober.probe(unreachableUrl)

            assertTrue(capability is ServerCapability.UnsupportedGateway)
            assertTrue((capability as ServerCapability.UnsupportedGateway).reason.contains("Could not reach"))
        }

    private fun response(
        code: Int,
        body: String,
        headers: Headers = Headers.Builder().build(),
    ) = MockResponse(code, headers, body)

    private fun respondTo(vararg routes: Pair<String, MockResponse>): Dispatcher {
        val byPath = routes.toMap()
        return object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse =
                byPath[request.url.encodedPath] ?: response(404, "")
        }
    }
}
