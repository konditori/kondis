package app.kondis.data.remote
import app.kondis.data.auth.ExternalAuthManager
import app.kondis.data.settings.AppSettings
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KondisApiFactory
    @Inject
    constructor(
        private val client: OkHttpClient,
        private val json: Json,
        private val externalAuthManager: ExternalAuthManager,
    ) {
        /**
         * Builds an API client for [settings]'s server, attaching a fresh perimeter OAuth access
         * token (see [ExternalAuthManager]) whenever the deployment is signed in through one. This is
         * the standard way to reach the API; use [create] directly only for requests that must
         * bypass the current session (for example the capability probe).
         */
        suspend fun create(settings: AppSettings): KondisApi =
            create(settings.serverUrl, settings.accessToken, externalAuthManager.freshAccessTokenOrNull())

        /**
         * @param accessToken the Kondis-issued session token, sent in a dedicated header so it never
         *   collides with a perimeter gateway's own `Authorization` bearer token.
         * @param externalAccessToken the perimeter OAuth/OIDC access token, when the deployment is
         *   behind one (for example Cloudflare Access Managed OAuth); sent as `Authorization: Bearer`,
         *   matching what any such gateway expects to see.
         */
        fun create(
            baseUrl: String,
            accessToken: String? = null,
            externalAccessToken: String? = null,
        ): KondisApi =
            Retrofit
                .Builder()
                .baseUrl(normalizeApiBaseUrl(baseUrl))
                .client(
                    client
                        .newBuilder()
                        // An authentication gateway may redirect a rejected API request to an HTML
                        // login page. Retrofit must see the redirect status, not parse that page as JSON.
                        .followRedirects(false)
                        .followSslRedirects(false)
                        .addInterceptor { chain ->
                            val requestBuilder = chain.request().newBuilder()
                            authHeaders(accessToken, externalAccessToken).forEach { (name, value) ->
                                requestBuilder.header(name, value)
                            }
                            chain.proceed(requestBuilder.build())
                        }.build(),
                ).addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
                .create(KondisApi::class.java)

        companion object {
            private const val API_BASE_PATH = "/api/v1/"

            /**
             * The exact headers [create] attaches for a given pair of credentials: the external
             * perimeter token (if any) as a standard `Authorization: Bearer`, and the Kondis token
             * (if any) in its own dedicated header so the two never collide. Exposed for testing
             * without needing a full [KondisApiFactory] instance.
             */
            internal fun authHeaders(
                accessToken: String?,
                externalAccessToken: String?,
            ): Map<String, String> =
                buildMap {
                    if (externalAccessToken != null) put("Authorization", "Bearer $externalAccessToken")
                    if (accessToken != null) put("X-Kondis-Authorization", "Bearer $accessToken")
                }

            fun normalizeBaseUrl(value: String): String {
                val trimmed = value.trim()
                require(trimmed.startsWith("https://") || (trimmed.startsWith("http://"))) {
                    "Server URL must start with http:// or https://"
                }
                val url = trimmed.toHttpUrlOrNull() ?: throw IllegalArgumentException("Server URL is invalid")
                val path = url.encodedPath.trimEnd('/')
                require(path.isEmpty()) {
                    "Enter the server URL (without ${API_BASE_PATH.trimEnd('/')})"
                }
                return url
                    .newBuilder()
                    .encodedPath("/")
                    .build()
                    .toString()
                    .trimEnd('/')
            }

            private fun normalizeApiBaseUrl(value: String): String {
                val baseUrl = normalizeBaseUrl(value)
                return baseUrl.trimEnd('/') + API_BASE_PATH
            }
        }
    }
