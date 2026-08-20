package app.kondis.data.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ProtectedResourceMetadata(
    @SerialName("resource") val resource: String? = null,
    @SerialName("authorization_servers") val authorizationServers: List<String> = emptyList(),
    @SerialName("scopes_supported") val scopesSupported: List<String> = emptyList(),
)

@Serializable
data class AuthorizationServerMetadata(
    @SerialName("issuer") val issuer: String,
    @SerialName("authorization_endpoint") val authorizationEndpoint: String,
    @SerialName("token_endpoint") val tokenEndpoint: String,
    @SerialName("registration_endpoint") val registrationEndpoint: String? = null,
    @SerialName("revocation_endpoint") val revocationEndpoint: String? = null,
    @SerialName("scopes_supported") val scopesSupported: List<String> = emptyList(),
)

sealed interface ServerCapability {
    data object Direct : ServerCapability

    data object InitialSetupRequired : ServerCapability

    data class ExternalOAuth(
        val issuer: String,
        val authorizationEndpoint: String,
        val tokenEndpoint: String,
        val registrationEndpoint: String?,
        val resource: String,
        val scopes: List<String>,
    ) : ServerCapability

    data class UnsupportedGateway(
        val reason: String,
    ) : ServerCapability
}
