package app.kondis.ui.detail

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Map
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.Activity
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDuration
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed
import app.kondis.ui.i18n.tr
import app.kondis.ui.theme.KondisOrange
import kotlin.math.abs

@Composable
fun MatchedRoutesRoute(
    id: String,
    units: UnitSystem,
    onBack: () -> Unit,
    onActivityClick: (String) -> Unit,
    viewModel: MatchedRoutesViewModel = hiltViewModel(),
) {
    LaunchedEffect(id) { viewModel.load(id) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    MatchedRoutesScreen(state, units, onBack, onActivityClick)
}

@Composable
fun MatchedRoutesScreen(
    state: MatchedRoutesUiState,
    units: UnitSystem,
    onBack: () -> Unit,
    onActivityClick: (String) -> Unit,
) {
    val activities = state.history?.activities.orEmpty()
    if (state.loading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }
    if (state.errorMessage != null || state.history == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(state.errorMessage ?: tr("no_matched_route_data"), color = MaterialTheme.colorScheme.error)
        }
        return
    }
    val source = activities.firstOrNull { it.id == state.history.sourceActivityId } ?: activities.firstOrNull()
    val cycling = source?.let { isCyclingSport(it.sport) } == true
    val values =
        activities.mapNotNull {
            it.metrics?.avgSpeed?.takeIf { speed -> speed > 0 }?.let { speed ->
                if (cycling) {
                    speed
                } else {
                    1000 /
                        speed
                }
            }
        }
    val average = values.average().takeIf { it.isFinite() } ?: 0.0
    val fastest = if (cycling) values.maxOrNull() ?: 0.0 else values.minOrNull() ?: 0.0
    val slowest = if (cycling) values.minOrNull() ?: 0.0 else values.maxOrNull() ?: 0.0

    LazyColumn(contentPadding = PaddingValues(bottom = 32.dp)) {
        item {
            Row(
                Modifier.fillMaxWidth().padding(start = 8.dp, top = 8.dp, end = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(
                    onClick = onBack,
                ) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = tr("back")) }
                Text(
                    tr("back_to_activity"),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
        item {
            Row(
                Modifier.padding(horizontal = 20.dp, vertical = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(
                            64.dp,
                        ).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(18.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Rounded.Map,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(32.dp),
                    )
                }
                Column(Modifier.padding(start = 16.dp)) {
                    Text(
                        tr("repeated_route"),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        tr(if (cycling) "matched_rides" else "matched_runs"),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        tr("compare_route_activities", activities.size),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (values.isNotEmpty()) {
            item {
                SectionTitle(eyebrow = tr("progress_over_time"), title = if (cycling) tr("speed") else tr("pace"))
                Card(
                    Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        RouteChart(values, cycling, units, Modifier.fillMaxWidth().height(220.dp))
                        Row(
                            Modifier.fillMaxWidth().padding(top = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            ChartStat(tr("fastest"), performance(fastest, cycling, units), KondisOrange)
                            ChartStat(
                                tr("all_time_average"),
                                performance(average, cycling, units),
                                MaterialTheme.colorScheme.primary,
                            )
                            ChartStat(
                                tr("slowest"),
                                performance(slowest, cycling, units),
                                MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Row(Modifier.padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text(tr("activities_count", activities.size), fontWeight = FontWeight.Bold)
                            Text("- ${tr("trending_average")}", color = MaterialTheme.colorScheme.primary)
                            Text("- ${tr("each_effort")}", color = MaterialTheme.colorScheme.secondary)
                        }
                    }
                }
            }
        }
        item { SectionTitle(eyebrow = tr("every_effort"), title = tr("activities_count", activities.size)) }
        items(activities.sortedByDescending { it.startedAt }, key = { it.id }) { activity ->
            MatchedActivityRow(activity, source?.id == activity.id, cycling, units, average, onActivityClick)
        }
    }
}

@Composable
private fun RouteChart(
    values: List<Double>,
    cycling: Boolean,
    units: UnitSystem,
    modifier: Modifier,
) {
    val line = MaterialTheme.colorScheme.primary
    val lightLine = MaterialTheme.colorScheme.secondary.copy(alpha = .45f)
    val gridLine = MaterialTheme.colorScheme.outline.copy(alpha = .18f)
    Canvas(modifier) {
        val min = values.minOrNull() ?: 0.0
        val max = values.maxOrNull() ?: 1.0
        val spread = (max - min).coerceAtLeast(max * .04).coerceAtLeast(1.0)

        fun point(
            index: Int,
            value: Double,
        ): Offset {
            val x = if (values.size == 1) size.width / 2 else index * size.width / (values.size - 1)
            val normalized = (value - min) / spread
            val y =
                if (cycling) {
                    size.height - normalized * (size.height - 24.dp.toPx())
                } else {
                    normalized *
                        (size.height - 24.dp.toPx()) +
                        12.dp.toPx()
                }
            return Offset(x, y.toFloat())
        }
        repeat(4) { index ->
            val y = index * size.height / 3
            drawLine(gridLine, Offset(0f, y), Offset(size.width, y), 1f)
        }
        val effortPoints = values.mapIndexed(::point)
        effortPoints.zipWithNext().forEach { (start, end) -> drawLine(lightLine, start, end, 3f) }
        effortPoints.forEach { drawCircle(line, 5.dp.toPx(), it) }
        val trend = Path()
        effortPoints.forEachIndexed { index, point ->
            val from = (index - 1).coerceAtLeast(0)
            val to = (index + 1).coerceAtMost(values.lastIndex)
            val avg = values.subList(from, to + 1).average()
            val trendPoint = point(index, avg)
            if (index == 0) trend.moveTo(trendPoint.x, trendPoint.y) else trend.lineTo(trendPoint.x, trendPoint.y)
        }
        drawPath(trend, line, style = Stroke(width = 4.dp.toPx()))
    }
}

@Composable
private fun ChartStat(
    label: String,
    value: String,
    color: Color,
) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = FontWeight.Bold, color = color)
    }
}

@Composable
private fun MatchedActivityRow(
    activity: Activity,
    current: Boolean,
    cycling: Boolean,
    units: UnitSystem,
    average: Double,
    onClick: (String) -> Unit,
) {
    val speed = activity.metrics?.avgSpeed
    val value = speed?.takeIf { it > 0 }?.let { if (cycling) it else 1000 / it }
    val difference = value?.let { it - average }
    Card(
        Modifier.padding(horizontal = 16.dp, vertical = 4.dp).fillMaxWidth().clickable {
            onClick(activity.id)
        },
        shape =
            RoundedCornerShape(
                14.dp,
            ),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    formatDateTime(activity.startedAt),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(activity.displayName(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (current) {
                    Text(
                        "This ${if (cycling) "ride" else "run"}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(performance(speed, cycling, units), fontWeight = FontWeight.SemiBold)
                Text(
                    if (difference == null ||
                        average == 0.0
                    ) {
                        "—"
                    } else {
                        differenceLabel(difference, cycling, units)
                    },
                    color =
                        if (cycling ==
                            (difference ?: 0.0) > 0
                        ) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.error
                        },
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Timer, contentDescription = null, modifier = Modifier.size(15.dp))
                    Text(
                        formatDuration(activity.metrics?.movingTime ?: activity.metrics?.elapsedTime),
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
            Icon(Icons.Rounded.ChevronRight, contentDescription = null)
        }
    }
}

private fun performance(
    speed: Double?,
    cycling: Boolean,
    units: UnitSystem,
): String = if (cycling) formatSpeed(speed, units) else formatPace(speed, units)

private fun performance(
    chartValue: Double,
    cycling: Boolean,
    units: UnitSystem,
): String =
    if (cycling) {
        formatSpeed(chartValue, units)
    } else {
        formatPace(
            if (chartValue >
                0
            ) {
                1000 / chartValue
            } else {
                null
            },
            units,
        )
    }

private fun differenceLabel(
    value: Double,
    cycling: Boolean,
    units: UnitSystem,
): String =
    if (cycling) {
        "%+.1f %s".format(
            value *
                if (units ==
                    UnitSystem.Metric
                ) {
                    3.6
                } else {
                    2.236936
                },
            if (units ==
                UnitSystem.Metric
            ) {
                "km/h"
            } else {
                "mph"
            },
        )
    } else {
        "%+d s/%s".format(
            abs(value).toInt() *
                if (value <
                    0
                ) {
                    -1
                } else {
                    1
                },
            if (units == UnitSystem.Metric) "km" else "mi",
        )
    }

private fun isCyclingSport(sport: String) = sport.contains("ride") || sport.contains("bike")
