package app.kondis.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsRun
import androidx.compose.material.icons.rounded.AddCircle
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import app.kondis.data.settings.AppSettings
import app.kondis.recording.isActive
import app.kondis.ui.detail.ActivityDetailRoute
import app.kondis.ui.detail.BestEffortsRoute
import app.kondis.ui.detail.MatchedRoutesRoute
import app.kondis.ui.feed.FeedRoute
import app.kondis.ui.record.RecordRoute
import app.kondis.ui.settings.SettingsRoute
import kotlinx.serialization.Serializable

@Serializable
private data object FeedKey : NavKey

@Serializable
private data object RecordKey : NavKey

@Serializable
private data object SettingsKey : NavKey

@Serializable
private data object YouKey : NavKey

@Serializable
private data class ActivityDetailKey(
    val id: String,
) : NavKey

@Serializable
private data class MatchedRoutesKey(
    val id: String,
) : NavKey

@Serializable
private data class BestEffortsKey(
    val sport: String,
    val type: String,
) : NavKey

private data class Destination(
    val key: NavKey,
    val label: String,
    val icon: ImageVector,
)

private val destinations =
    listOf(
        Destination(FeedKey, "Activities", Icons.AutoMirrored.Rounded.DirectionsRun),
        Destination(RecordKey, "Record", Icons.Rounded.AddCircle),
        Destination(YouKey, "You", Icons.Rounded.Person),
    )

@Composable
fun KondisApp(viewModel: AppViewModel = hiltViewModel()) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val loginStage by viewModel.loginStage.collectAsStateWithLifecycle()
    val loginError by viewModel.loginError.collectAsStateWithLifecycle()
    val reauthorizationRequired by viewModel.reauthorizationRequired.collectAsStateWithLifecycle()
    val recording by viewModel.recording.collectAsStateWithLifecycle()
    val recordingActive = recording.mode.isActive

    // The OAuth/OIDC authorization step always completes in the external browser (RFC 8252).
    // Launching it and receiving the result is owned by MainActivity rather than here: the modern
    // Auth Tab launcher must be registered on an ActivityResultCaller (an Activity/Fragment), which
    // a @Composable function is not — see MainActivity.kt.
    if (settings.accessToken == null || reauthorizationRequired) {
        LoginScreen(
            settings = settings,
            loginStage = loginStage,
            errorMessage = loginError,
            isReauth = reauthorizationRequired && settings.accessToken != null,
            onCheckServer = viewModel::checkServer,
            onStartBrowserSignIn = viewModel::startExternalAuth,
            onLogin = { email, password ->
                val serverUrl =
                    when (val stage = loginStage) {
                        is LoginStage.DirectReady -> stage.serverUrl
                        is LoginStage.OAuthSignedIn -> stage.serverUrl
                        else -> settings.serverUrl
                    }
                viewModel.login(serverUrl, email, password)
            },
        )
        return
    }
    val backStack = rememberNavBackStack(if (recordingActive) RecordKey else FeedKey)
    val current = backStack.lastOrNull()
    val showNavigation = !recordingActive && current != RecordKey

    LaunchedEffect(recordingActive) {
        if (recordingActive && backStack.lastOrNull() != RecordKey) {
            backStack.clear()
            backStack.add(RecordKey)
        }
    }

    fun navigateBack() {
        if (recordingActive) return
        if (backStack.size > 1) {
            backStack.removeAt(backStack.lastIndex)
        } else {
            backStack.clear()
            backStack.add(FeedKey)
        }
    }

    Scaffold(
        bottomBar = {
            if (showNavigation) {
                NavigationBar(tonalElevation = 2.dp) {
                    destinations.forEach { destination ->
                        NavigationBarItem(
                            selected = current == destination.key,
                            onClick = {
                                if (current != destination.key) {
                                    backStack.clear()
                                    backStack.add(destination.key)
                                }
                            },
                            icon = { Icon(destination.icon, contentDescription = destination.label) },
                            label = { Text(destination.label) },
                        )
                    }
                }
            }
        },
    ) { contentPadding ->
        NavDisplay(
            backStack = backStack,
            modifier = Modifier.padding(contentPadding),
            onBack = ::navigateBack,
            entryProvider =
                entryProvider {
                    entry<FeedKey> {
                        FeedRoute(
                            units = settings.unitSystem,
                            onActivityClick = { id -> backStack.add(ActivityDetailKey(id)) },
                        )
                    }
                    entry<RecordKey> {
                        RecordRoute(
                            onActivitySaved = { id ->
                                backStack.clear()
                                backStack.add(ActivityDetailKey(id))
                            },
                        )
                    }
                    entry<SettingsKey> { SettingsRoute() }
                    entry<YouKey> {
                        BestEffortsRoute(
                            sport = "run",
                            type = "5k",
                            units = settings.unitSystem,
                            onBack = ::navigateBack,
                            onActivityClick = { id -> backStack.add(ActivityDetailKey(id)) },
                            onNavigate = { sport, type -> backStack.add(BestEffortsKey(sport, type)) },
                            onSettings = {
                                backStack.clear()
                                backStack.add(SettingsKey)
                            },
                        )
                    }
                    entry<ActivityDetailKey> { key ->
                        ActivityDetailRoute(
                            id = key.id,
                            units = settings.unitSystem,
                            onBack = ::navigateBack,
                            onMatchedRoutes = { id -> backStack.add(MatchedRoutesKey(id)) },
                            onBestEfforts = { sport, type -> backStack.add(BestEffortsKey(sport, type)) },
                            onDeleted = ::navigateBack,
                        )
                    }
                    entry<MatchedRoutesKey> { key ->
                        MatchedRoutesRoute(
                            id = key.id,
                            units = settings.unitSystem,
                            onBack = ::navigateBack,
                            onActivityClick = { id -> backStack.add(ActivityDetailKey(id)) },
                        )
                    }
                    entry<BestEffortsKey> { key ->
                        BestEffortsRoute(
                            sport = key.sport,
                            type = key.type,
                            units = settings.unitSystem,
                            onBack = ::navigateBack,
                            onActivityClick = { id -> backStack.add(ActivityDetailKey(id)) },
                            onNavigate = { sport, type -> backStack.add(BestEffortsKey(sport, type)) },
                            onSettings = {
                                backStack.clear()
                                backStack.add(SettingsKey)
                            },
                        )
                    }
                },
        )
    }
}

/**
 * Guides the user through connecting to a self-hosted Kondis server: enter its address, let
 * [LoginStage] report whether it can be reached directly or requires signing in through an
 * OAuth/OIDC gateway first (see [AppViewModel.checkServer]), then complete whichever sign-in that
 * server needs. [isReauth] renders a shorter prompt for the case where only the perimeter gateway
 * session expired and the Kondis credentials on this device are still valid.
 */
@Composable
private fun LoginScreen(
    settings: AppSettings,
    loginStage: LoginStage,
    errorMessage: String?,
    isReauth: Boolean,
    onCheckServer: (String) -> Unit,
    onStartBrowserSignIn: () -> Unit,
    onLogin: (String, String) -> Unit,
) {
    var serverUrlDraft by remember(settings.serverUrl) { mutableStateOf(settings.serverUrl) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val checking = loginStage == LoginStage.CheckingServer
    val showServerField =
        !isReauth && loginStage !is LoginStage.DirectReady &&
            loginStage !is LoginStage.OAuthReady && loginStage !is LoginStage.OAuthSignedIn

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            if (isReauth) "Sign-in expired" else "Sign in to Kondis",
            style = MaterialTheme.typography.headlineSmall,
        )
        Spacer(Modifier.height(16.dp))

        if (showServerField) {
            OutlinedTextField(
                value = serverUrlDraft,
                onValueChange = { serverUrlDraft = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("API base URL") },
                supportingText = { Text("For a phone, use the server's LAN address and include /api/v1") },
                singleLine = true,
                enabled = !checking,
            )
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { onCheckServer(serverUrlDraft) },
                enabled = serverUrlDraft.isNotBlank() && !checking,
            ) {
                if (checking) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Text("Continue")
                }
            }
        }

        when (val stage = loginStage) {
            is LoginStage.UnsupportedGateway -> {
                Spacer(Modifier.height(12.dp))
                Text(stage.reason, color = MaterialTheme.colorScheme.error)
            }

            is LoginStage.OAuthReady -> {
                Spacer(Modifier.height(12.dp))
                Text(
                    if (isReauth) {
                        "Your sign-in with this server's identity provider expired."
                    } else {
                        "This server requires signing in with your identity provider first."
                    },
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = onStartBrowserSignIn) { Text("Continue in browser") }
            }

            is LoginStage.DirectReady, is LoginStage.OAuthSignedIn -> {
                Spacer(Modifier.height(12.dp))
                if (stage is LoginStage.OAuthSignedIn) {
                    Text("Signed in with your identity provider. Now sign in with your Kondis account.")
                    Spacer(Modifier.height(8.dp))
                }
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Email") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { onLogin(email, password) },
                    enabled = email.isNotBlank() && password.isNotBlank(),
                ) { Text("Sign in") }
            }

            LoginStage.EnteringServer, LoginStage.CheckingServer -> {}
        }

        errorMessage?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }
}
