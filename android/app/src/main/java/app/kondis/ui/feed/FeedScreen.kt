package app.kondis.ui.feed

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.UnitSystem
import app.kondis.ui.components.ActivityCard

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
        onActivityClick = onActivityClick,
    )
}

@Composable
fun FeedScreen(
    state: FeedUiState,
    units: UnitSystem,
    onSearchChange: (String) -> Unit,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onActivityClick: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, top = 22.dp, end = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Activities", style = MaterialTheme.typography.displaySmall)
                    Text(
                        state.total?.let { "$it ${if (it == 1) "workout" else "workouts"}" } ?: "Your private training log",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = onRefresh, enabled = !state.refreshing) {
                    if (state.refreshing) {
                        CircularProgressIndicator(modifier = Modifier.padding(10.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Rounded.Refresh, contentDescription = "Refresh activities")
                    }
                }
            }
        }
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
                    Icon(Icons.Rounded.CloudOff, contentDescription = null, tint = MaterialTheme.colorScheme.error)
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
                            if (state.search.isBlank()) "Your first activity starts here" else "No matching activities",
                            style = MaterialTheme.typography.titleLarge,
                        )
                        Text(
                            if (state.search.isBlank()) "Record a workout or connect to your Kondis server." else "Try a different name or sport.",
                            modifier = Modifier.padding(top = 8.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        items(state.activities, key = { it.id }) { activity ->
            ActivityCard(activity, units, onClick = { onActivityClick(activity.id) })
        }
        if (state.nextCursor != null) {
            item {
                Button(
                    onClick = onLoadMore,
                    enabled = !state.loadingMore,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (state.loadingMore) {
                        CircularProgressIndicator(modifier = Modifier.padding(end = 10.dp), strokeWidth = 2.dp)
                    }
                    Text(if (state.loadingMore) "Loading…" else "Load more")
                }
            }
        }
    }
}

