package app.kondis.data.auth

import android.content.Context
import android.net.Uri
import androidx.browser.auth.AuthTabIntent
import androidx.core.net.toUri
import app.kondis.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.RegistrationRequest
import net.openid.appauth.RegistrationResponse
import net.openid.appauth.ResponseTypeValues
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** Thrown when this app cannot drive a discovered authorization server (for example, it requires
 * manual OAuth client configuration this app does not yet support). */
class ExternalAuthException(
    message: String,
) : Exception(message)

sealed interface AuthorizationOutcome {
    data class Success(
        val accessToken: String?,
    ) : AuthorizationOutcome

    data class Failure(
        val message: String,
    ) : AuthorizationOutcome
}

/**
 * What to launch to run the browser sign-in step: the modern [AuthTabIntent] surface
 * (`androidx.browser.auth`, stable since `androidx.browser` 1.9.0) — a browser tab purpose-built
 * for authorization, run in an ephemeral (non-history, non-cookie-sharing) session, with an
 * explicit result when the browser could not verify the HTTPS App Link redirect.
 */
data class AuthTabLaunch(
    val authorizationUri: Uri,
    val redirectHost: String,
    val redirectPath: String,
)

/**
 * Drives the OAuth 2.0 Authorization Code + PKCE flow (RFC 8252) against whichever
 * standards-compliant authorization server [ServerCapabilityProber] discovered — Cloudflare Access
 * with Managed OAuth enabled, or any other provider exposing RFC 8414/OIDC discovery metadata and
 * dynamic client registration (RFC 7591). The flow always runs in the device's external browser via
 * an [AuthTabIntent]; this app never uses a WebView for it, per RFC 8252 §8.12: an embedded browser
 * can read every keystroke and cookie, defeating the purpose of relying on a third-party identity
 * provider at all.
 *
 * Only one authorization attempt and one signed-in external session exist at a time, matching
 * [app.kondis.data.settings.SettingsRepository]'s single-active-server model.
 */
@Singleton
class ExternalAuthManager
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val store: SecureSessionStore,
    ) {
        // Deferred so building this object never touches the browser before it's actually needed
        // (most app launches never touch OAuth at all), and so it can be constructed in a JVM unit
        // test that never exercises any OAuth-driving method. AuthorizationService here is only
        // ever used for its plain HTTP operations (token exchange, registration, refresh) — never
        // for launching a browser, which AuthTabIntent owns directly.
        private val authService by lazy { AuthorizationService(context) }

        private val mutableReauthorizationRequired = MutableStateFlow(false)

        /**
         * True once a token refresh fails because the authorization server rejected the refresh
         * token outright (revoked, expired grant), meaning the browser sign-in must be repeated
         * before any request can succeed again. Distinguishing this from a Kondis-credential
         * failure lets the UI explain which sign-in actually needs to be redone.
         */
        val reauthorizationRequired: StateFlow<Boolean> = mutableReauthorizationRequired.asStateFlow()

        suspend fun hasExternalSession(): Boolean = store.externalAuthState() != null

        /**
         * Registers a client (via RFC 7591 dynamic registration, when the provider advertises a
         * `registration_endpoint`) and builds the [AuthTabLaunch] to launch for [capability]. Pass
         * the resulting `AuthTabIntent.AuthResult` fields to [completeAuthorization].
         */
        suspend fun prepareAuthorizationRequest(capability: ServerCapability.ExternalOAuth): AuthTabLaunch =
            withContext(Dispatchers.IO) {
                val redirectUri = BuildConfig.OAUTH_REDIRECT_URI.toUri()
                val configuration =
                    AuthorizationServiceConfiguration(
                        capability.authorizationEndpoint.toUri(),
                        capability.tokenEndpoint.toUri(),
                        capability.registrationEndpoint?.toUri(),
                    )
                val clientId =
                    capability.registrationEndpoint?.let { registerClient(configuration, redirectUri) }
                        ?: throw ExternalAuthException(
                            "This identity provider does not support automatic app registration " +
                                "(no registration_endpoint was advertised). Manual OAuth client " +
                                "configuration is not yet supported by this app.",
                        )
                val requestBuilder =
                    AuthorizationRequest.Builder(configuration, clientId, ResponseTypeValues.CODE, redirectUri)
                if (capability.scopes.isNotEmpty()) requestBuilder.setScopes(capability.scopes)
                // RFC 8707 resource indicator: tells the authorization server which API this access
                // token must be scoped to. Cloudflare Access Managed OAuth requires this parameter.
                requestBuilder.setAdditionalParameters(mapOf("resource" to capability.resource))
                val request = requestBuilder.build()
                store.setPendingAuthorizationRequest(request.jsonSerializeString())
                AuthTabLaunch(
                    authorizationUri = request.toUri(),
                    redirectHost = redirectUri.host ?: "",
                    redirectPath = redirectUri.path ?: "/",
                )
            }

        /** Call with the `AuthTabIntent.AuthResult` fields from launching [prepareAuthorizationRequest]'s result. */
        suspend fun completeAuthorization(
            resultCode: Int,
            resultUri: Uri?,
        ): AuthorizationOutcome {
            val pendingRequest =
                store.pendingAuthorizationRequest()?.let { json ->
                    runCatching { AuthorizationRequest.jsonDeserialize(json) }.getOrNull()
                }
            store.setPendingAuthorizationRequest(null)

            val failureMessage =
                when (resultCode) {
                    AuthTabIntent.RESULT_OK -> {
                        null
                    }

                    AuthTabIntent.RESULT_CANCELED -> {
                        "Sign-in was cancelled."
                    }

                    AuthTabIntent.RESULT_VERIFICATION_FAILED -> {
                        "Could not verify the app's sign-in callback address with this browser. Check that " +
                            "${BuildConfig.OAUTH_REDIRECT_URI} is reachable and correctly configured."
                    }

                    AuthTabIntent.RESULT_VERIFICATION_TIMED_OUT -> {
                        "Verifying the sign-in callback address took too long. Check your connection and try again."
                    }

                    else -> {
                        "Sign-in did not complete (code $resultCode)."
                    }
                }
            if (failureMessage != null) return AuthorizationOutcome.Failure(failureMessage)
            if (pendingRequest == null || resultUri == null) {
                return AuthorizationOutcome.Failure("Sign-in did not complete.")
            }
            val response =
                runCatching {
                    AuthorizationResponse.Builder(pendingRequest).fromUri(resultUri).build()
                }.getOrNull() ?: return AuthorizationOutcome.Failure("Sign-in did not complete.")

            // RFC 8252 §8.10 mix-up mitigation: reject a response that doesn't match the request we
            // stored before launching the browser (wrong pending flow, or a forged callback).
            if (response.state != pendingRequest.state) {
                return AuthorizationOutcome.Failure(
                    "The sign-in response did not match the pending request. Please try again.",
                )
            }

            val authState = AuthState(response, null)
            val outcome =
                withContext(Dispatchers.IO) {
                    suspendCancellableCoroutine<AuthorizationOutcome> { continuation ->
                        authService.performTokenRequest(
                            response.createTokenExchangeRequest(),
                        ) { tokenResponse, tokenException ->
                            authState.update(tokenResponse, tokenException)
                            if (tokenResponse != null) {
                                continuation.resume(AuthorizationOutcome.Success(authState.accessToken))
                            } else {
                                continuation.resume(
                                    AuthorizationOutcome.Failure(
                                        tokenException?.errorDescription ?: tokenException?.error
                                            ?: "Token exchange failed.",
                                    ),
                                )
                            }
                        }
                    }
                }
            if (outcome is AuthorizationOutcome.Success) {
                store.setExternalAuthState(authState.jsonSerializeString())
                mutableReauthorizationRequired.value = false
            }
            return outcome
        }

        /**
         * Returns a valid access token for the current external session, refreshing it first if
         * needed, or `null` if there is no external session (direct-auth deployments always hit
         * this path harmlessly) or the refresh could not complete.
         */
        suspend fun freshAccessTokenOrNull(): String? =
            withContext(Dispatchers.IO) {
                val stateJson = store.externalAuthState() ?: return@withContext null
                val authState =
                    runCatching { AuthState.jsonDeserialize(stateJson) }.getOrNull() ?: return@withContext null
                val accessToken =
                    suspendCancellableCoroutine<String?> { continuation ->
                        authState.performActionWithFreshTokens(authService) { token, _, exception ->
                            if (exception != null && isPermanentOAuthFailure(exception)) {
                                mutableReauthorizationRequired.value = true
                            }
                            continuation.resume(token)
                        }
                    }
                // AuthState mutates itself in place during a refresh attempt regardless of outcome
                // (for example recording that a refresh token was rejected); persist that either way.
                store.setExternalAuthState(authState.jsonSerializeString())
                accessToken
            }

        /** Ends the local external session. Does not revoke the token or sign out of the upstream
         * identity provider's own session — only clears what this app can act on unilaterally. */
        suspend fun signOut() {
            store.clearExternalAuth()
            mutableReauthorizationRequired.value = false
        }

        private suspend fun registerClient(
            configuration: AuthorizationServiceConfiguration,
            redirectUri: Uri,
        ): String {
            val request = RegistrationRequest.Builder(configuration, listOf(redirectUri)).build()
            val response: RegistrationResponse =
                suspendCancellableCoroutine { continuation ->
                    authService.performRegistrationRequest(request) { registrationResponse, exception ->
                        if (registrationResponse != null) {
                            continuation.resume(registrationResponse)
                        } else {
                            continuation.resumeWithException(
                                ExternalAuthException(
                                    exception?.errorDescription ?: exception?.error
                                        ?: "Dynamic client registration failed.",
                                ),
                            )
                        }
                    }
                }
            return response.clientId
        }

        private fun isPermanentOAuthFailure(exception: AuthorizationException): Boolean =
            exception.type == AuthorizationException.TYPE_OAUTH_TOKEN_ERROR
    }
