package app.kondis.data.auth

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DynamicClientRegistrar
    @Inject
    constructor(
        private val client: OkHttpClient,
        private val json: Json,
    ) {
        suspend fun register(
            endpoint: String,
            redirectUri: String,
            clientUri: String,
        ): String =
            withContext(Dispatchers.IO) {
                val body =
                    json
                        .encodeToString(
                            RegistrationRequestBody(
                                redirectUris = listOf(redirectUri),
                                clientUri = clientUri,
                            ),
                        ).toRequestBody(JSON_MEDIA_TYPE)
                val request =
                    Request
                        .Builder()
                        .url(endpoint)
                        .post(body)
                        .build()

                client.newCall(request).execute().use { response ->
                    val responseBody = response.body.string()
                    if (!response.isSuccessful) {
                        val error = runCatching { json.decodeFromString<RegistrationError>(responseBody) }.getOrNull()
                        throw ExternalAuthException(
                            error?.description ?: error?.error
                                ?: "Dynamic client registration failed (HTTP ${response.code}).",
                        )
                    }

                    val registration =
                        runCatching { json.decodeFromString<RegistrationResponseBody>(responseBody) }
                            .getOrElse {
                                throw ExternalAuthException(
                                    "The authorization server returned an invalid client registration response.",
                                )
                            }
                    registration.clientId
                }
            }

        private companion object {
            val JSON_MEDIA_TYPE = "application/json".toMediaType()
        }
    }

@Serializable
private data class RegistrationRequestBody(
    @SerialName("redirect_uris")
    val redirectUris: List<String>,
    @SerialName("client_name")
    val clientName: String = "Kondis",
    @SerialName("client_uri")
    val clientUri: String,
    @SerialName("application_type")
    val applicationType: String = "native",
    @SerialName("grant_types")
    val grantTypes: List<String> = listOf("authorization_code"),
    @SerialName("response_types")
    val responseTypes: List<String> = listOf("code"),
    @SerialName("token_endpoint_auth_method")
    val tokenEndpointAuthMethod: String = "none",
)

@Serializable
private data class RegistrationResponseBody(
    @SerialName("client_id")
    val clientId: String,
)

@Serializable
private data class RegistrationError(
    val error: String? = null,
    @SerialName("error_description")
    val description: String? = null,
)
