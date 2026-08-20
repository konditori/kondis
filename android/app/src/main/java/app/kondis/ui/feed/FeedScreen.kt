package app.kondis.ui.feed

import android.graphics.Bitmap
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.CloudUpload
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.UnitSystem
import app.kondis.model.formatDateTime
import app.kondis.ui.components.ActivityCard
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun FeedRoute(
    units: UnitSystem,
    onActivityClick: (String) -> Unit,
    viewModel: FeedViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    FeedScreen(
        state = state,
        units = units,
        onSearchChange = viewModel::setSearch,
        onRefresh = viewModel::refresh,
        onLoadMore = viewModel::loadMore,
        onSyncQueuedWorkouts = viewModel::syncQueuedWorkouts,
        onActivityClick = onActivityClick,
        onLoadImage = viewModel::loadImage,
    )
}

@Composable
fun FeedScreen(
    state: FeedUiState,
    units: UnitSystem,
    onSearchChange: (String) -> Unit,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onSyncQueuedWorkouts: () -> Unit,
    onActivityClick: (String) -> Unit,
    onLoadImage: suspend (String) -> Bitmap? = { null },
) {
    val pullToRefreshState = rememberPullToRefreshState()
    val listState = rememberLazyListState()
    val initialLoading =
        state.activities.isEmpty() &&
            state.total == null &&
            state.errorMessage == null

    LaunchedEffect(listState, state.activities.size, state.nextCursor, state.loadingMore) {
        snapshotFlow {
            listState.layoutInfo.visibleItemsInfo
                .lastOrNull()
                ?.index ?: -1
        }.distinctUntilChanged()
            .collectLatest { lastVisibleIndex ->
                if (state.nextCursor != null && !state.loadingMore && lastVisibleIndex >= state.activities.size - 3) {
                    onLoadMore()
                }
            }
    }
    PullToRefreshBox(
        isRefreshing = state.refreshing,
        onRefresh = onRefresh,
        state = pullToRefreshState,
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, top = 22.dp, end = 16.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (state.queuedWorkouts.isNotEmpty() || state.showSyncComplete) {
                item {
                    SyncStatusCard(
                        queuedWorkouts = state.queuedWorkouts,
                        showSyncComplete = state.showSyncComplete,
                        onSync = onSyncQueuedWorkouts,
                    )
                }
            }
            if (initialLoading) {
                item {
                    Box(
                        modifier = Modifier.fillParentMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
            } else {
                item {
                    OutlinedTextField(
                        value = state.search,
                        onValueChange = onSearchChange,
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                        placeholder = { Text("Search activities") },
                        shape = MaterialTheme.shapes.large,
                    )
                }
                state.errorMessage?.let { message ->
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Icon(
                                Icons.Rounded.CloudOff,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                            )
                            Text(message, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.error)
                            TextButton(onClick = onRefresh) { Text("Retry") }
                        }
                    }
                }
                if (state.activities.isEmpty() && !state.refreshing) {
                    item {
                        Box(
                            modifier = Modifier.fillParentMaxSize().padding(vertical = 72.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    if (state.search.isBlank()) "Nothing to see here!" else "No matching activities",
                                    style = MaterialTheme.typography.titleLarge,
                                )
                                Text(
                                    if (state.search.isBlank()) "Record a workout" else "Try a different name or sport.",
                                    modifier = Modifier.padding(top = 8.dp),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
            items(state.activities, key = { it.id }) { activity ->
                ActivityCard(
                    activity,
                    units,
                    onClick = { onActivityClick(activity.id) },
                    onLoadImage = onLoadImage,
                )
            }
            if (state.loadingMore) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(strokeWidth = 2.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun SyncStatusCard(
    queuedWorkouts: List<app.kondis.data.QueuedWorkout>,
    showSyncComplete: Boolean,
    onSync: () -> Unit,
) {
    androidx.compose.material3.Card(
        modifier = Modifier.fillMaxWidth().testTag("sync-status"),
        colors =
            androidx.compose.material3.CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
            ),
    ) {
        if (showSyncComplete) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Rounded.CloudDone, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Column {
                    Text("Everything is uploaded", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Your workouts are safely synced to Kondis.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.CloudUpload, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(
                            "${queuedWorkouts.size} ${if (queuedWorkouts.size == 1) "workout" else "workouts"} waiting to sync",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(
                            "They are saved on this device and remain available below.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    TextButton(onClick = onSync, modifier = Modifier.testTag("sync-now")) { Text("Sync now") }
                }
                queuedWorkouts.forEach { workout ->
                    Text(
                        "${workout.title.ifBlank { "Untitled workout" }} · ${formatDateTime(workout.startedAt)}",
                        modifier = Modifier.padding(start = 36.dp, top = 10.dp),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}
