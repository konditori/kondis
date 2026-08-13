package app.kondis.ui.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.ActivityDetail
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.model.formatElevation
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed
import app.kondis.model.sportLabel
import app.kondis.ui.components.ActivityStat
import app.kondis.ui.components.StaticRoutePreview

@Composable
fun ActivityDetailRoute(
    id: String,
    units: UnitSystem,
    onBack: () -> Unit,
    viewModel: ActivityDetailViewModel = hiltViewModel(),
) {
    LaunchedEffect(id) { viewModel.load(id) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    ActivityDetailScreen(state, units, onBack, viewModel::refresh)
}

@Composable
fun ActivityDetailScreen(
    state: DetailUiState,
    units: UnitSystem,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
) {
    val activity = state.activity
    if (activity == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (state.loading) CircularProgressIndicator()
            state.errorMessage?.let {
                Icon(Icons.Rounded.CloudOff, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                Text(it, modifier = Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.error)
                TextButton(onClick = onRefresh) { Text("Try again") }
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp),
    ) {
        item { DetailHeader(activity, units, onBack) }
        activity.track?.takeIf { it.coordinates.size > 1 }?.let { track ->
            item { StaticRoutePreview(track, Modifier.fillMaxWidth().height(280.dp)) }
        }
        activity.description?.takeIf(String::isNotBlank)?.let { description ->
            item {
                Text(
                    description,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp),
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
        activity.analysis?.splits?.takeIf(List<*>::isNotEmpty)?.let { splits ->
            item {
                Text(
                    "Splits",
                    modifier = Modifier.padding(start = 20.dp, top = 28.dp, end = 20.dp, bottom = 10.dp),
                    style = MaterialTheme.typography.headlineMedium,
                )
            }
            item {
                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
                    Text("KM", Modifier.weight(.7f), style = MaterialTheme.typography.labelLarge)
                    Text("Time", Modifier.weight(1f), style = MaterialTheme.typography.labelLarge)
                    Text("Pace", Modifier.weight(1f), style = MaterialTheme.typography.labelLarge)
                    Text("HR", Modifier.weight(.7f), style = MaterialTheme.typography.labelLarge)
                }
            }
            itemsIndexed(splits) { index, split ->
                Column {
                    HorizontalDivider(modifier = Modifier.padding(horizontal = 20.dp))
                    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 13.dp)) {
                        Text("${index + 1}", Modifier.weight(.7f))
                        Text(formatDuration(split.elapsedTime), Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                        Text(formatPace(split.distance / split.elapsedTime, units), Modifier.weight(1f))
                        Text(split.avgHr?.let { "$it" } ?: "—", Modifier.weight(.7f))
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailHeader(activity: ActivityDetail, units: UnitSystem, onBack: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(start = 8.dp, top = 8.dp, end = 20.dp, bottom = 24.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
            }
            Column(Modifier.padding(start = 12.dp)) {
                Text(sportLabel(activity.sport), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                Text(activity.summary().displayName(), style = MaterialTheme.typography.displaySmall)
                Text(
                    formatDateTime(activity.startedAt),
                    modifier = Modifier.padding(top = 5.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    val metrics = activity.metrics
                    ActivityStat("Distance", formatDistance(metrics?.distance, units))
                    ActivityStat("Moving time", formatDuration(metrics?.movingTime ?: metrics?.elapsedTime))
                    ActivityStat(
                        if (activity.sport.contains("run")) "Pace" else "Avg speed",
                        if (activity.sport.contains("run")) formatPace(metrics?.avgSpeed, units) else formatSpeed(metrics?.avgSpeed, units),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    ActivityStat("Elevation", formatElevation(activity.metrics?.elevationGain, units), Modifier.weight(1f))
                    ActivityStat("Avg heart rate", activity.metrics?.avgHr?.let { "$it bpm" } ?: "—", Modifier.weight(1f))
                    ActivityStat("Calories", activity.metrics?.calories?.let { "${it.toInt()} kcal" } ?: "—", Modifier.weight(1f))
                }
            }
        }
    }
}
