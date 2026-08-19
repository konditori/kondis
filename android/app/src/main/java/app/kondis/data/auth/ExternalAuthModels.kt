package app.kondis.data.auth

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * RFC 9728 OAuth 2.0 Protected Resource Metadata, published by the API itself (or by a gateway
 * standing in front of it, such as Cloudflare Access) so a client can discover which authorization
 * server(s) protect it.
 */
@Serializable
data class ProtectedResourceMetadata(
    @SerialName("resource") val resource: String? = null,
    @SerialName("authorization_servers") val authorizationServers: List<String> = emptyList(),
    @SerialName("scopes_supported") val scopesSupported: List<String> = emptyList(),
)

/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata (a superset of OpenID Connect Discovery for the
 * fields this app needs). Any standards-compliant identity provider can be driven from this shape,
 * not just Cloudflare Access.
 */
@Serializable
data class AuthorizationServerMetadata(
    @SerialName("issuer") val issuer: String,
    @SerialName("authorization_endpoint") val authorizationEndpoint: String,
    @SerialName("token_endpoint") val tokenEndpoint: String,
    @SerialName("registration_endpoint") val registrationEndpoint: String? = null,
    @SerialName("revocation_endpoint") val revocationEndpoint: String? = null,
    @SerialName("scopes_supported") val scopesSupported: List<String> = emptyList(),
)

/**
 * What the app learned about a configured server: whether it can sign in directly with a Kondis
 * email and password, whether it must first authenticate through an external OAuth/OIDC
 * authorization server (a perimeter gateway such as Cloudflare Access, or any other provider that
 * exposes standard discovery metadata), or whether it is behind a gateway this app cannot drive.
 */
sealed interface ServerCapability {
    /** No perimeter gateway was detected; sign in directly with a Kondis email and password. */
    data object Direct : ServerCapability

    /**
     * A standards-based OAuth/OIDC authorization server protects this deployment. [resource] is the
     * RFC 8707 resource indicator to request the access token for; [scopes] and
     * [registrationEndpoint] may be empty/null depending on what the provider advertises.
     */
    data class ExternalOAuth(
        val issuer: String,
        val authorizationEndpoint: String,
        val tokenEndpoint: String,
        val registrationEndpoint: String?,
        val resource: String,
        val scopes: List<String>,
    ) : ServerCapability

    /**
     * A gateway is present but this app cannot complete its login automatically (for example
     * Cloudflare Access without Managed OAuth enabled, which only offers a browser cookie flow).
     */
    data class UnsupportedGateway(
        val reason: String,
    ) : ServerCapability
}
