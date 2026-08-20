package app.kondis.data.auth

import android.content.Context
import android.net.Uri
import androidx.browser.auth.AuthTabIntent
import androidx.core.net.toUri
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
import net.openid.appauth.ResponseTypeValues
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

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

data class AuthTabLaunch(
    val authorizationUri: Uri,
    val redirectScheme: String,
)

@Singleton
class ExternalAuthManager
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val store: SecureSessionStore,
        private val clientRegistrar: DynamicClientRegistrar,
    ) {
        private val authService by lazy { AuthorizationService(context) }

        private val mutableReauthorizationRequired = MutableStateFlow(false)

        val reauthorizationRequired: StateFlow<Boolean> = mutableReauthorizationRequired.asStateFlow()

        suspend fun hasExternalSession(): Boolean = store.externalAuthState() != null

        suspend fun prepareAuthorizationRequest(capability: ServerCapability.ExternalOAuth): AuthTabLaunch =
            withContext(Dispatchers.IO) {
                val configuration =
                    AuthorizationServiceConfiguration(
                        capability.authorizationEndpoint.toUri(),
                        capability.tokenEndpoint.toUri(),
                        capability.registrationEndpoint?.toUri(),
                    )
                val clientId =
                    capability.registrationEndpoint?.let { endpoint ->
                        clientRegistrar.register(
                            endpoint = endpoint,
                            redirectUri = REDIRECT_URI.toString(),
                            clientUri = originOf(capability.resource),
                        )
                    }
                        ?: throw ExternalAuthException(
                            "This identity provider does not support automatic app registration " +
                                "(no registration_endpoint was advertised). Manual OAuth client " +
                                "configuration is not yet supported by this app.",
                        )
                val requestBuilder =
                    AuthorizationRequest.Builder(configuration, clientId, ResponseTypeValues.CODE, REDIRECT_URI)
                if (capability.scopes.isNotEmpty()) requestBuilder.setScopes(capability.scopes)

                requestBuilder.setAdditionalParameters(mapOf("resource" to capability.resource))
                val request = requestBuilder.build()
                store.setPendingAuthorizationRequest(request.jsonSerializeString())
                AuthTabLaunch(
                    authorizationUri = request.toUri(),
                    redirectScheme = REDIRECT_URI.scheme.orEmpty(),
                )
            }

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
                        "The browser could not verify the app's sign-in callback."
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
                store.setExternalAuthState(authState.jsonSerializeString())
                accessToken
            }

        suspend fun signOut() {
            store.clearExternalAuth()
            mutableReauthorizationRequired.value = false
        }

        private fun isPermanentOAuthFailure(exception: AuthorizationException): Boolean =
            exception.type == AuthorizationException.TYPE_OAUTH_TOKEN_ERROR

        private fun originOf(resource: String): String =
            resource
                .toHttpUrlOrNull()
                ?.newBuilder()
                ?.encodedPath("/")
                ?.query(null)
                ?.fragment(null)
                ?.build()
                ?.toString()
                ?: resource

        private companion object {
            val REDIRECT_URI = "app.kondis:///oauth-callback".toUri()
        }
    }
