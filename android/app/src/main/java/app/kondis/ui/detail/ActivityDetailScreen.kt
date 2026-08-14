package app.kondis.ui.detail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Map
import androidx.compose.material.icons.rounded.MilitaryTech
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import app.kondis.ui.theme.KondisOrange

@Composable
fun ActivityDetailRoute(
    id: String,
    units: UnitSystem,
    onBack: () -> Unit,
    onMatchedRoutes: (String) -> Unit,
    viewModel: ActivityDetailViewModel = hiltViewModel(),
) {
    LaunchedEffect(id) { viewModel.load(id) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    ActivityDetailScreen(state, units, onBack, onMatchedRoutes, viewModel::refresh)
}

@Composable
fun ActivityDetailScreen(
    state: DetailUiState,
    units: UnitSystem,
    onBack: () -> Unit,
    onMatchedRoutes: (String) -> Unit,
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
            item { SectionTitle(eyebrow = "ACTIVITY ANALYSIS", title = "Splits") }
            item {
                SplitsTable(
                    splits = splits,
                    cycling = isCycling(activity.sport),
                    units = units,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
        if (activity.matchedRouteCount != null && activity.matchedRouteCount > 1) {
            item {
                RepeatedRouteCard(
                    count = activity.matchedRouteCount,
                    cycling = isCycling(activity.sport),
                    onClick = { onMatchedRoutes(activity.id) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 28.dp),
                )
            }
        }
        activity.bestEfforts?.takeIf(List<*>::isNotEmpty)?.let { efforts ->
            item {
                SectionTitle(
                    eyebrow = "${if (isCycling(activity.sport)) "CYCLING" else "RUNNING"} PERFORMANCE",
                    title = "Best efforts",
                )
            }
            item {
                BestEffortsTable(
                    efforts = efforts,
                    cycling = isCycling(activity.sport),
                    units = units,
                    excludedFromRankings = activity.excludeFromRankings,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }
}

@Composable
private fun RepeatedRouteCard(
    count: Int,
    cycling: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Rounded.Map,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(34.dp),
            )
            Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                Text(
                    "REPEATED ROUTE",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "$count ${if (count == 1) "activity" else "activities"} on this route",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Compare your performance across every matched effort.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                "View matched ${if (cycling) "rides" else "runs"}",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
            )
            Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
fun SectionTitle(
    eyebrow: String,
    title: String,
) {
    Column(Modifier.padding(start = 20.dp, top = 30.dp, end = 20.dp, bottom = 12.dp)) {
        Text(eyebrow, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SplitsTable(
    splits: List<app.kondis.model.ActivitySplit>,
    cycling: Boolean,
    units: UnitSystem,
    modifier: Modifier = Modifier,
) {
    val hasHeartRate = splits.any { it.avgHr != null }
    DetailTable(modifier) {
        TableHeader {
            TableCell("KM", .85f, bold = true)
            TableCell(if (cycling) "Speed" else "Pace", 1.35f, bold = true)
            if (hasHeartRate) TableCell("HR", .8f, bold = true)
            TableCell("Elev", .85f, bold = true)
        }
        splits.forEachIndexed { index, split ->
            TableRow {
                val label =
                    if (index == splits.lastIndex &&
                        split.distance < 995
                    ) {
                        "%.2f".format(split.distance / 1000)
                    } else {
                        "${index + 1}"
                    }
                TableCell(label, .85f, bold = true)
                TableCell(splitRate(split.distance, split.elapsedTime, units, cycling), 1.35f)
                if (hasHeartRate) TableCell(split.avgHr?.toString() ?: "—", .8f)
                TableCell(formatElevation(split.elevationChange, units), .85f)
            }
        }
    }
}

@Composable
private fun BestEffortsTable(
    efforts: List<app.kondis.model.BestEffort>,
    cycling: Boolean,
    units: UnitSystem,
    excludedFromRankings: Boolean,
    modifier: Modifier = Modifier,
) {
    val hasHeartRate = efforts.any { it.avgHr != null }
    DetailTable(modifier) {
        TableHeader {
            TableCell("Distance", 1.45f, bold = true)
            TableCell("Time", 1f, bold = true)
            TableCell(if (cycling) "Speed" else "Pace", 1.3f, bold = true)
            if (hasHeartRate) TableCell("HR", .8f, bold = true)
            TableCell("Elev", .85f, bold = true)
        }
        efforts.forEach { effort ->
            val achievement = if (excludedFromRankings) null else achievement(effort)
            TableRow {
                Row(Modifier.weight(1.45f), verticalAlignment = Alignment.CenterVertically) {
                    if (achievement != null) {
                        Icon(
                            Icons.Rounded.MilitaryTech,
                            contentDescription = null,
                            tint = rankColor(achievement),
                            modifier = Modifier.size(28.dp),
                        )
                    } else if (!excludedFromRankings && efforts.any { achievement(it) != null }) {
                        Spacer(Modifier.width(28.dp))
                    }
                    Column(Modifier.padding(start = 6.dp)) {
                        Text(bestEffortLabel(effort.type), fontWeight = FontWeight.Bold)
                        achievement?.let {
                            Text(
                                achievementText(effort),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                TableCell(formatDuration(effort.elapsedTime), 1f)
                TableCell(
                    if (cycling) {
                        formatSpeed(effort.distance / effort.elapsedTime, units)
                    } else {
                        formatPace(effort.distance / effort.elapsedTime, units)
                    },
                    1.3f,
                )
                if (hasHeartRate) TableCell(effort.avgHr?.let { "$it" } ?: "—", .8f)
                TableCell(formatElevation(effort.elevationChange, units), .85f)
            }
        }
    }
}

@Composable
private fun DetailTable(
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        content = content,
    )
}

@Composable
private fun TableHeader(content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), content = content)
}

@Composable
private fun TableRow(content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    HorizontalDivider()
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.TableCell(
    value: String,
    weight: Float,
    bold: Boolean = false,
) {
    Text(
        value,
        Modifier.weight(weight),
        style = MaterialTheme.typography.bodyMedium,
        fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
    )
}

private fun isCycling(sport: String) = sport.contains("ride") || sport.contains("bike")

private fun splitRate(
    distance: Double,
    elapsedTime: Double,
    units: UnitSystem,
    cycling: Boolean,
): String = if (cycling) formatSpeed(distance / elapsedTime, units) else formatPace(distance / elapsedTime, units)

private fun bestEffortLabel(type: String): String =
    mapOf(
        "400m" to "400 m",
        "1k" to "1K",
        "half_mile" to "1/2 mile",
        "1_mile" to "1 mile",
        "2_miles" to "2 miles",
        "5k" to "5K",
        "10k" to "10K",
        "15k" to "15K",
        "10_miles" to "10 miles",
        "20k" to "20K",
        "half_marathon" to "Half marathon",
        "30k" to "30K",
        "marathon" to "Marathon",
        "50k" to "50K",
        "longest_ride" to "Longest ride",
        "biggest_climb" to "Biggest climb",
    ).getOrDefault(type, type)

private fun achievement(effort: app.kondis.model.BestEffort): Int? =
    when {
        effort.overallRank in 1..3 -> effort.overallRank
        effort.yearRank in 1..3 -> effort.yearRank
        else -> null
    }

private fun achievementText(effort: app.kondis.model.BestEffort): String =
    when {
        effort.overallRank == 1 -> "New best of all time"
        effort.overallRank == 2 -> "New 2nd best of all time"
        effort.overallRank == 3 -> "New 3rd best of all time"
        effort.yearRank == 1 -> "New best of ${effort.year}"
        effort.yearRank == 2 -> "New 2nd best of ${effort.year}"
        else -> "New 3rd best of ${effort.year}"
    }

private fun rankColor(rank: Int) =
    when (rank) {
        1 -> {
            KondisOrange
        }

        2 -> {
            androidx.compose.ui.graphics
                .Color(0xFF87908D)
        }

        else -> {
            androidx.compose.ui.graphics
                .Color(0xFFE2A500)
        }
    }

@Composable
private fun DetailHeader(
    activity: ActivityDetail,
    units: UnitSystem,
    onBack: () -> Unit,
) {
    Surface(color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(start = 8.dp, top = 8.dp, end = 20.dp, bottom = 24.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
            }
            Column(Modifier.padding(start = 12.dp)) {
                Text(
                    sportLabel(activity.sport),
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.labelLarge,
                )
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
                        if (activity.sport.contains(
                                "run",
                            )
                        ) {
                            formatPace(metrics?.avgSpeed, units)
                        } else {
                            formatSpeed(metrics?.avgSpeed, units)
                        },
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    ActivityStat(
                        "Elevation",
                        formatElevation(activity.metrics?.elevationGain, units),
                        Modifier.weight(1f),
                    )
                    ActivityStat(
                        "Avg heart rate",
                        activity.metrics?.avgHr?.let {
                            "$it bpm"
                        } ?: "—",
                        Modifier.weight(1f),
                    )
                    ActivityStat(
                        "Calories",
                        activity.metrics?.calories?.let {
                            "${it.toInt()} kcal"
                        } ?: "—",
                        Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
