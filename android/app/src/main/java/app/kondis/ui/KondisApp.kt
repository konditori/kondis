package app.kondis.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsRun
import androidx.compose.material.icons.rounded.AddCircle
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import app.kondis.ui.detail.ActivityDetailRoute
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
private data class ActivityDetailKey(
    val id: String,
) : NavKey

@Serializable
private data class MatchedRoutesKey(
    val id: String,
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
        Destination(SettingsKey, "Settings", Icons.Rounded.Settings),
    )

@Composable
fun KondisApp(viewModel: AppViewModel = hiltViewModel()) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val backStack = rememberNavBackStack(FeedKey)
    val current = backStack.lastOrNull()
    val showNavigation = current !is ActivityDetailKey && current !is MatchedRoutesKey

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
            onBack = { backStack.removeLastOrNull() },
            entryProvider =
                entryProvider {
                    entry<FeedKey> {
                        FeedRoute(
                            units = settings.unitSystem,
                            onActivityClick = { id -> backStack.add(ActivityDetailKey(id)) },
                        )
                    }
                    entry<RecordKey> { RecordRoute() }
                    entry<SettingsKey> { SettingsRoute() }
                    entry<ActivityDetailKey> { key ->
                        ActivityDetailRoute(
                            id = key.id,
                            units = settings.unitSystem,
                            onBack = { backStack.removeLastOrNull() },
                            onMatchedRoutes = { id -> backStack.add(MatchedRoutesKey(id)) },
                        )
                    }
                    entry<MatchedRoutesKey> { key ->
                        MatchedRoutesRoute(
                            id = key.id,
                            units = settings.unitSystem,
                            onBack = { backStack.removeLastOrNull() },
                            onActivityClick = { id -> backStack.add(ActivityDetailKey(id)) },
                        )
                    }
                },
        )
    }
}
