package app.kondis.ui.detail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.MilitaryTech
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.BestEffortHistory
import app.kondis.model.BestEffortHistoryEffort
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed
import app.kondis.model.sportLabel

@Composable
fun BestEffortsRoute(
    sport: String,
    type: String,
    units: UnitSystem,
    onBack: () -> Unit,
    onActivityClick: (String) -> Unit,
    onNavigate: (String, String) -> Unit,
    viewModel: BestEffortsViewModel = hiltViewModel(),
) {
    LaunchedEffect(sport, type) { viewModel.load(sport, type) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    BestEffortsScreen(state, sport, type, units, onBack, onActivityClick, onNavigate)
}

@Composable
private fun BestEffortsScreen(
    state: BestEffortsUiState,
    sport: String,
    type: String,
    units: UnitSystem,
    onBack: () -> Unit,
    onActivityClick: (String) -> Unit,
    onNavigate: (String, String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth().padding(start = 8.dp, top = 8.dp, end = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text("YOU", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                    Text("Best efforts", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                }
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SportTab("Run", sport == "run", Modifier.weight(1f)) { onNavigate("run", "5k") }
                SportTab("Ride", sport == "ride", Modifier.weight(1f)) { onNavigate("ride", "10k") }
            }
        }
        state.errorMessage?.let { message ->
            item {
                Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.CloudOff, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    Text(message, Modifier.padding(start = 10.dp), color = MaterialTheme.colorScheme.error)
                }
            }
        }
        state.history?.let { history ->
            item {
                Text(
                    "${if (sport == "ride") "Cycling" else "Running"} performance",
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
            }
            item { EffortSelector(history, type, onNavigate) }
            val podium = history.efforts.filter { it.overallRank <= 3 }.sortedBy { it.overallRank }
            if (podium.isNotEmpty()) {
                item { BestEffortSectionTitle("ALL-TIME RANKING", "Your ${effortLabel(type)} efforts") }
                items(podium, key = { "podium-${it.activityId}" }) { effort ->
                    EffortCard(effort, history, units, onActivityClick)
                }
            }
            item { BestEffortSectionTitle("EVERY RESULT", "Effort history") }
            items(history.efforts.asReversed(), key = { "history-${it.activityId}-${it.startedAt}" }) { effort ->
                EffortCard(effort, history, units, onActivityClick)
            }
        }
    }
}

@Composable
private fun SportTab(
    label: String,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors =
            CardDefaults.cardColors(
                containerColor =
                    if (selected) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
            ),
    ) {
        Text(
            label,
            Modifier.padding(vertical = 12.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun EffortSelector(
    history: BestEffortHistory,
    selected: String,
    onNavigate: (String, String) -> Unit,
) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        Text("Effort", style = MaterialTheme.typography.labelLarge)
        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            history.options.take(5).forEach { option ->
                Card(
                    modifier = Modifier.clickable { onNavigate(history.sport, option.type) },
                    colors =
                        CardDefaults.cardColors(
                            containerColor =
                                if (option.type ==
                                    selected
                                ) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.surfaceVariant
                                },
                        ),
                ) {
                    Text(
                        effortLabel(option.type),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                        color =
                            if (option.type ==
                                selected
                            ) {
                                MaterialTheme.colorScheme.onPrimary
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                    )
                }
            }
        }
    }
}

@Composable
private fun EffortCard(
    effort: BestEffortHistoryEffort,
    history: BestEffortHistory,
    units: UnitSystem,
    onActivityClick: (String) -> Unit,
) {
    Card(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().clickable { onActivityClick(effort.activityId) },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            if (effort.overallRank <= 3) {
                Icon(Icons.Rounded.MilitaryTech, contentDescription = null, tint = rankColor(effort.overallRank))
            }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(effort.activityName ?: sportLabel(effort.sport), fontWeight = FontWeight.Bold)
                Text(formatDateTime(effort.startedAt), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(effortValue(effort, history, units), style = MaterialTheme.typography.titleMedium)
            }
            Text(if (effort.overallRank <= 3) "#${effort.overallRank}" else "—")
            Icon(Icons.Rounded.ChevronRight, contentDescription = null)
        }
    }
}

@Composable
private fun BestEffortSectionTitle(
    eyebrow: String,
    title: String,
) {
    Column(Modifier.padding(start = 20.dp, top = 18.dp, end = 20.dp, bottom = 2.dp)) {
        Text(eyebrow, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    }
}

private fun effortValue(
    effort: BestEffortHistoryEffort,
    history: BestEffortHistory,
    units: UnitSystem,
): String =
    when (history.valueKind) {
        "distance" -> {
            formatDistance(effort.value, units)
        }

        "power" -> {
            "${effort.value.toInt()} W"
        }

        else -> {
            val pace = history.distance?.let { distance -> formatPace(distance / effort.value, units) }
            "${formatDuration(effort.value)}${pace?.let { " · $it" } ?: ""}"
        }
    }

private fun effortLabel(type: String): String =
    mapOf(
        "400m" to "400 m",
        "1k" to "1K",
        "half_mile" to "1/2 mile",
        "1_mile" to "1 mile",
        "2_miles" to "2 miles",
        "5k" to "5K",
        "10k" to "10K",
        "15k" to "15K",
        "longest_ride" to "Longest ride",
        "biggest_climb" to "Biggest climb",
    )[type] ?: type

private fun rankColor(rank: Int) =
    when (rank) {
        1 -> {
            androidx.compose.ui.graphics
                .Color(0xFFF59E0B)
        }

        2 -> {
            androidx.compose.ui.graphics
                .Color(0xFFA7B0B5)
        }

        else -> {
            androidx.compose.ui.graphics
                .Color(0xFFB87333)
        }
    }
