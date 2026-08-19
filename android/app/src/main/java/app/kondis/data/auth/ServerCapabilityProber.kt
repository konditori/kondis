package app.kondis.data.auth

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Detects, without sending any credentials, how a configured Kondis server expects to be signed
 * in to: directly with a Kondis email and password, through a standards-based OAuth/OIDC
 * authorization server (for example Cloudflare Access with Managed OAuth enabled, or any other
 * provider publishing RFC 8414/RFC 9728 discovery metadata), or through a gateway this app cannot
 * drive automatically (for example Cloudflare Access without Managed OAuth, which only offers a
 * browser cookie flow — see RFC 8252 §8.12 for why this app will not extract that cookie from a
 * WebView).
 *
 * This deliberately bypasses [app.kondis.data.remote.KondisApiFactory]: the probe request must
 * carry no `Authorization`/cookie of any kind and must not silently follow redirects, since a `302`
 * to a login page is itself meaningful signal.
 */
@Singleton
class ServerCapabilityProber
    @Inject
    constructor(
        client: OkHttpClient,
        private val json: Json,
    ) {
        private val probeClient =
            client
                .newBuilder()
                .followRedirects(false)
                .followSslRedirects(false)
                .build()

        suspend fun probe(baseUrl: String): ServerCapability =
            withContext(Dispatchers.IO) {
                val resource = baseUrl.trimEnd('/')
                val capabilitiesUrl =
                    baseUrl.toHttpUrlOrNull()?.resolve("auth/capabilities")
                        ?: return@withContext ServerCapability.UnsupportedGateway(
                            "\"$baseUrl\" is not a valid server URL.",
                        )
                val response =
                    runCatching { get(capabilitiesUrl.toString()) }.getOrElse { error ->
                        return@withContext ServerCapability.UnsupportedGateway(
                            "Could not reach the server: ${error.message ?: error::class.simpleName}",
                        )
                    }
                response.use {
                    when {
                        it.code == 200 -> {
                            ServerCapability.Direct
                        }

                        it.code == 401 -> {
                            capabilityFromChallenge(capabilitiesUrl, resource, it)
                        }

                        it.code in 300..399 -> {
                            ServerCapability.UnsupportedGateway(redirectReason(it))
                        }

                        else -> {
                            ServerCapability.UnsupportedGateway(
                                "The server returned an unexpected response (HTTP ${it.code}) while checking sign-in support.",
                            )
                        }
                    }
                }
            }

        private fun capabilityFromChallenge(
            capabilitiesUrl: HttpUrl,
            resource: String,
            response: Response,
        ): ServerCapability {
            val challenge = response.header("WWW-Authenticate")
            val resourceMetadataUrl = challenge?.let { RESOURCE_METADATA_PARAM.find(it)?.groupValues?.get(1) }
            val origin =
                HttpUrl
                    .Builder()
                    .scheme(capabilitiesUrl.scheme)
                    .host(capabilitiesUrl.host)
                    .port(capabilitiesUrl.port)
                    .build()

            resourceMetadataUrl?.let { url ->
                fetchProtectedResourceMetadata(url)?.let { metadata ->
                    return capabilityFromResourceMetadata(metadata, resource)
                }
            }
            // Some deployments (Cloudflare Access Managed OAuth as documented today) serve
            // authorization-server metadata directly from the protected origin without a
            // `resource_metadata` pointer. Try both well-known shapes there before giving up.
            val directAuthServerUrl = origin.resolve(".well-known/oauth-authorization-server").toString()
            fetchAuthorizationServerMetadata(directAuthServerUrl)?.let { metadata ->
                return capabilityFromAuthServerMetadata(metadata, resource)
            }
            val directResourceUrl = origin.resolve(".well-known/oauth-protected-resource").toString()
            fetchProtectedResourceMetadata(directResourceUrl)?.let { metadata ->
                return capabilityFromResourceMetadata(metadata, resource)
            }
            return ServerCapability.UnsupportedGateway(
                "This server requires sign-in but does not advertise a supported OAuth/OIDC configuration. " +
                    "If it is protected by Cloudflare Access, ask the administrator to enable Managed OAuth.",
            )
        }

        private fun capabilityFromResourceMetadata(
            metadata: ProtectedResourceMetadata,
            resource: String,
        ): ServerCapability {
            val issuer =
                metadata.authorizationServers.firstOrNull()
                    ?: return ServerCapability.UnsupportedGateway(
                        "This server's protected-resource metadata did not list an authorization server.",
                    )
            val authMetadata =
                wellKnownCandidates(issuer).firstNotNullOfOrNull { candidate ->
                    fetchAuthorizationServerMetadata(candidate)
                }
                    ?: return ServerCapability.UnsupportedGateway(
                        "Could not discover OAuth/OIDC endpoints for the identity provider \"$issuer\".",
                    )
            return capabilityFromAuthServerMetadata(
                authMetadata,
                resource,
                metadata.scopesSupported,
            )
        }

        private fun capabilityFromAuthServerMetadata(
            metadata: AuthorizationServerMetadata,
            resource: String,
            scopes: List<String> = emptyList(),
        ): ServerCapability =
            ServerCapability.ExternalOAuth(
                issuer = metadata.issuer,
                authorizationEndpoint = metadata.authorizationEndpoint,
                tokenEndpoint = metadata.tokenEndpoint,
                registrationEndpoint = metadata.registrationEndpoint,
                resource = resource,
                scopes = scopes.ifEmpty { metadata.scopesSupported },
            )

        private fun fetchProtectedResourceMetadata(url: String): ProtectedResourceMetadata? =
            fetchJson(url) { body -> json.decodeFromString(ProtectedResourceMetadata.serializer(), body) }

        private fun fetchAuthorizationServerMetadata(url: String): AuthorizationServerMetadata? =
            fetchJson(url) { body -> json.decodeFromString(AuthorizationServerMetadata.serializer(), body) }

        private fun <T> fetchJson(
            url: String,
            parse: (String) -> T,
        ): T? =
            runCatching {
                get(url).use { response ->
                    if (!response.isSuccessful) return null
                    parse(response.body.string())
                }
            }.getOrNull()

        private fun get(url: String): Response =
            probeClient
                .newCall(
                    Request
                        .Builder()
                        .url(url)
                        .get()
                        .build(),
                ).execute()

        private fun redirectReason(response: Response): String {
            val location = response.header("Location")
            return if (location?.contains("cloudflareaccess.com") == true) {
                "This server redirects to a Cloudflare Access login page. Ask the administrator to enable " +
                    "Managed OAuth for this application so the app can sign in without a browser cookie."
            } else {
                "This server redirects to a login page (HTTP ${response.code}) that this app cannot complete " +
                    "automatically."
            }
        }

        private companion object {
            val RESOURCE_METADATA_PARAM = Regex("resource_metadata=\"([^\"]+)\"")

            /**
             * Candidate well-known metadata URLs for an issuer, in priority order: RFC 8414
             * authorization-server metadata, then OpenID Connect Discovery, each per RFC 8414 §3.1 /
             * OIDC Discovery §4.2 rules for issuers that include a path component (for example
             * Keycloak realms), falling back to the simple no-path form used by most providers
             * (including Cloudflare Access).
             */
            fun wellKnownCandidates(issuer: String): List<String> {
                val issuerUrl = issuer.toHttpUrlOrNull() ?: return emptyList()
                val path = issuerUrl.encodedPath.trim('/')
                val origin =
                    HttpUrl
                        .Builder()
                        .scheme(issuerUrl.scheme)
                        .host(issuerUrl.host)
                        .port(issuerUrl.port)
                        .build()
                return listOf("oauth-authorization-server", "openid-configuration").map { suffix ->
                    origin
                        .newBuilder()
                        .addPathSegments(".well-known/$suffix")
                        .apply { if (path.isNotEmpty()) addPathSegments(path) }
                        .build()
                        .toString()
                }
            }
        }
    }
