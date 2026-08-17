package app.kondis.ui.detail

import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.BookmarkBorder
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Map
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityImage
import app.kondis.model.ActivityUpdate
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.model.formatElevation
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed
import app.kondis.model.sportLabel
import app.kondis.ui.components.ActivityImageSlide
import app.kondis.ui.components.ActivityStat
import app.kondis.ui.components.MedalIcon
import app.kondis.ui.components.StaticRoutePreview
import app.kondis.ui.record.ActivityTypePicker
import app.kondis.ui.theme.KondisOrange

@Composable
fun ActivityDetailRoute(
    id: String,
    units: UnitSystem,
    onBack: () -> Unit,
    onMatchedRoutes: (String) -> Unit,
    onBestEfforts: (String, String) -> Unit,
    onDeleted: () -> Unit,
    viewModel: ActivityDetailViewModel = hiltViewModel(),
) {
    LaunchedEffect(id) { viewModel.load(id) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val imagePicker =
        rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            viewModel.uploadImages(uris)
        }
    ActivityDetailScreen(
        state,
        units,
        onBack,
        onMatchedRoutes,
        onBestEfforts,
        onDeleted,
        viewModel::update,
        viewModel::delete,
        viewModel::refresh,
        onAddImages = { imagePicker.launch("image/*") },
        onLoadImage = viewModel::loadImage,
    )
}

@Composable
fun ActivityDetailScreen(
    state: DetailUiState,
    units: UnitSystem,
    onBack: () -> Unit,
    onMatchedRoutes: (String) -> Unit,
    onBestEfforts: (String, String) -> Unit,
    onDeleted: () -> Unit,
    onUpdate: (ActivityUpdate) -> Unit,
    onDelete: () -> Unit,
    onRefresh: () -> Unit,
    onAddImages: () -> Unit,
    onLoadImage: suspend (String) -> Bitmap?,
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

    val queuedForSync = activity.id.startsWith("local-")
    var editing by remember(activity.id) { mutableStateOf(false) }
    var showDeleteDialog by remember(activity.id) { mutableStateOf(false) }
    var draftName by remember(activity.id) { mutableStateOf(activity.name.orEmpty()) }
    var draftDescription by remember(activity.id) { mutableStateOf(activity.description.orEmpty()) }
    var draftSport by remember(activity.id) { mutableStateOf(activity.sport) }
    var draftExcludeFromRankings by remember(activity.id) { mutableStateOf(activity.excludeFromRankings) }
    var draftTags by remember(activity.id) { mutableStateOf(activity.tags) }
    LaunchedEffect(state.deleted) {
        if (state.deleted) onDeleted()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp),
    ) {
        item {
            DetailHeader(
                activity = activity,
                units = units,
                onBack = onBack,
                onLoadImage = onLoadImage,
                onEdit =
                    if (!queuedForSync) {
                        {
                            draftName = activity.name.orEmpty()
                            draftDescription = activity.description.orEmpty()
                            draftSport = activity.sport
                            draftExcludeFromRankings = activity.excludeFromRankings
                            draftTags = activity.tags
                            editing = true
                        }
                    } else {
                        null
                    },
            )
        }
        if (queuedForSync) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.CloudOff, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Text(
                        "Saved on this device and waiting to sync.",
                        modifier = Modifier.padding(start = 10.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (editing) {
            item {
                ActivityEditor(
                    name = draftName,
                    description = draftDescription,
                    sport = draftSport,
                    excludeFromRankings = draftExcludeFromRankings,
                    tags = draftTags,
                    saving = state.saving,
                    deleting = state.deleting,
                    error = state.mutationError,
                    onNameChange = { draftName = it },
                    onDescriptionChange = { draftDescription = it },
                    onSportChange = { draftSport = it },
                    onExcludeChange = { draftExcludeFromRankings = it },
                    onTagsChange = { draftTags = it },
                    onCancel = { editing = false },
                    onSave = {
                        onUpdate(
                            ActivityUpdate(
                                name = draftName.trim().ifBlank { null },
                                description = draftDescription.trim().ifBlank { null },
                                sport = draftSport,
                                excludeFromRankings = draftExcludeFromRankings,
                                tags = draftTags,
                            ),
                        )
                        editing = false
                    },
                    onDelete = { showDeleteDialog = true },
                )
            }
        }
        if (!queuedForSync) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.End,
                ) {
                    OutlinedButton(onClick = onAddImages) { Text("Add photos") }
                }
            }
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
        if (!isCycling(activity.sport)) {
            activity.analysis?.splits?.takeIf(List<*>::isNotEmpty)?.let { splits ->
                item { SectionTitle(eyebrow = "ACTIVITY ANALYSIS", title = "Splits") }
                item {
                    SplitsTable(
                        splits = splits,
                        cycling = false,
                        units = units,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
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
            val distanceEfforts = efforts.filterNot { it.type.startsWith("power_") }
            val powerEfforts = efforts.filter { it.type.startsWith("power_") }
            item {
                Row(
                    Modifier.fillMaxWidth().padding(top = 30.dp, start = 20.dp, end = 12.dp),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    SectionTitle(
                        eyebrow = "${if (isCycling(activity.sport)) "CYCLING" else "RUNNING"} PERFORMANCE",
                        title = "Best efforts",
                    )
                    Spacer(Modifier.weight(1f))
                    TextButton(
                        onClick = {
                            onBestEfforts(if (isCycling(activity.sport)) "ride" else "run", efforts.first().type)
                        },
                    ) { Text("You") }
                }
            }
            if (distanceEfforts.isNotEmpty()) {
                item {
                    BestEffortsTable(
                        efforts = distanceEfforts,
                        cycling = isCycling(activity.sport),
                        units = units,
                        excludedFromRankings = activity.excludeFromRankings,
                        onEffortClick = { effort ->
                            onBestEfforts(if (isCycling(activity.sport)) "ride" else "run", effort.type)
                        },
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }
            if (powerEfforts.isNotEmpty()) {
                item {
                    PowerBestEffortsTable(
                        efforts = powerEfforts,
                        excludedFromRankings = activity.excludeFromRankings,
                        units = units,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }
        }
    }
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { if (!state.deleting) showDeleteDialog = false },
            title = { Text("Delete activity?") },
            text = { Text("This will permanently delete this workout and its analysis.") },
            confirmButton = {
                TextButton(
                    onClick = onDelete,
                    enabled = !state.deleting,
                ) { Text(if (state.deleting) "Deleting…" else "Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }, enabled = !state.deleting) { Text("Cancel") }
            },
        )
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
    onEffortClick: (app.kondis.model.BestEffort) -> Unit,
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
            TableRow(onClick = { onEffortClick(effort) }) {
                Row(Modifier.weight(1.45f), verticalAlignment = Alignment.CenterVertically) {
                    if (achievement != null) {
                        MedalIcon(
                            tint = rankColor(achievement),
                            modifier = Modifier.size(width = 34.dp, height = 38.dp),
                        )
                    } else if (!excludedFromRankings && efforts.any { achievement(it) != null }) {
                        Spacer(Modifier.width(34.dp))
                    }
                    Column(Modifier.weight(1f).padding(start = 6.dp)) {
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
private fun PowerBestEffortsTable(
    efforts: List<app.kondis.model.BestEffort>,
    excludedFromRankings: Boolean,
    units: UnitSystem,
    modifier: Modifier = Modifier,
) {
    DetailTable(modifier) {
        TableHeader {
            TableCell("", .35f, bold = true)
            TableCell("Time", 1f, bold = true)
            TableCell("Power", 1.2f, bold = true)
            TableCell("Elev", .9f, bold = true)
        }
        efforts.forEach { effort ->
            val rank = if (excludedFromRankings) null else achievement(effort)
            TableRow(onClick = {}) {
                if (rank != null) {
                    MedalIcon(
                        tint = rankColor(rank),
                        modifier = Modifier.size(width = 34.dp, height = 38.dp),
                    )
                } else {
                    Spacer(Modifier.width(34.dp))
                }
                TableCell(bestEffortLabel(effort.type).removeSuffix(" power"), 1f)
                TableCell("${effort.value.toInt()} W", 1.2f)
                TableCell(formatElevation(effort.elevationChange, units), .9f)
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
private fun TableRow(
    onClick: (() -> Unit)? = null,
    content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    HorizontalDivider()
    Row(
        Modifier
            .fillMaxWidth()
            .then(onClick?.let { Modifier.clickable(onClick = it) } ?: Modifier)
            .padding(horizontal = 16.dp, vertical = 15.dp),
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
        "power_5s" to "5 sec power",
        "power_15s" to "15 sec power",
        "power_30s" to "30 sec power",
        "power_1m" to "1 min power",
        "power_2m" to "2 min power",
        "power_3m" to "3 min power",
        "power_5m" to "5 min power",
        "power_8m" to "8 min power",
        "power_10m" to "10 min power",
        "power_15m" to "15 min power",
        "power_20m" to "20 min power",
        "power_30m" to "30 min power",
        "power_45m" to "45 min power",
        "power_1h" to "1 hour power",
        "power_2h" to "2 hour power",
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
            Color(0xFFEFAA00)
        }

        2 -> {
            Color(0xFF7B8583)
        }

        else -> {
            Color(0xFFBE6739)
        }
    }

@Composable
private fun DetailHeader(
    activity: ActivityDetail,
    units: UnitSystem,
    onBack: () -> Unit,
    onLoadImage: suspend (String) -> Bitmap?,
    onEdit: (() -> Unit)?,
) {
    val hasMap =
        activity.track
            ?.coordinates
            ?.size
            ?.let { it > 1 } == true
    val firstImage = activity.images.firstOrNull()
    val firstImagePath = firstImage?.preview ?: firstImage?.original ?: firstImage?.thumbnail
    val firstImageBitmap by produceState<Bitmap?>(initialValue = null, key1 = firstImagePath) {
        value = firstImagePath?.let { runCatching { onLoadImage(it) }.getOrNull() }
    }
    var showImages by remember(activity.id) { mutableStateOf(false) }

    Column {
        if (hasMap) {
            Box(Modifier.fillMaxWidth().height(360.dp)) {
                activity.track.let { track ->
                    StaticRoutePreview(track = track, modifier = Modifier.fillMaxSize())
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(
                        onClick = onBack,
                        modifier =
                            Modifier.background(
                                MaterialTheme.colorScheme.scrim.copy(alpha = 0.75f),
                                CircleShape,
                            ),
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                    }
                    Spacer(Modifier.weight(1f))
                    onEdit?.let { TextButton(onClick = it) { Text("Edit") } }
                    IconButton(
                        onClick = {},
                        modifier =
                            Modifier.background(
                                MaterialTheme.colorScheme.scrim.copy(alpha = 0.75f),
                                CircleShape,
                            ),
                    ) {
                        Icon(Icons.Rounded.BookmarkBorder, contentDescription = "Bookmark activity")
                    }
                    IconButton(
                        onClick = {},
                        modifier =
                            Modifier.background(
                                MaterialTheme.colorScheme.scrim.copy(alpha = 0.75f),
                                CircleShape,
                            ),
                    ) {
                        Icon(Icons.Rounded.MoreVert, contentDescription = "More options")
                    }
                }
                if (firstImage != null) {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.BottomStart)
                                .padding(14.dp)
                                .size(76.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { showImages = true }
                                .semantics { contentDescription = "Open activity photos" },
                    ) {
                        firstImageBitmap?.let {
                            Image(
                                bitmap = it.asImageBitmap(),
                                contentDescription = "Open activity photos",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                            )
                        }
                        if (activity.images.size > 1) {
                            Text(
                                text = "+${activity.images.size - 1}",
                                modifier =
                                    Modifier
                                        .align(Alignment.BottomEnd)
                                        .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.75f))
                                        .padding(horizontal = 5.dp, vertical = 2.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    }
                }
            }
        }
        Surface(color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.padding(start = 8.dp, top = if (hasMap) 18.dp else 8.dp, end = 20.dp, bottom = 24.dp)) {
                if (!hasMap) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
                        }
                        Spacer(Modifier.weight(1f))
                        onEdit?.let { TextButton(onClick = it) { Text("Edit") } }
                    }
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
                    if (activity.tags.isNotEmpty()) {
                        Text(
                            activity.tags.joinToString(" · ") {
                                it.replace('_', ' ').replaceFirstChar { character ->
                                    character.titlecase()
                                }
                            },
                            modifier = Modifier.padding(top = 4.dp),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
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
        if (showImages) {
            ActivityPhotoViewer(
                activity = activity,
                onLoadImage = onLoadImage,
                onDismiss = { showImages = false },
            )
        }
    }
}

@Composable
private fun ActivityPhotoViewer(
    activity: ActivityDetail,
    onLoadImage: suspend (String) -> Bitmap?,
    onDismiss: () -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        val pagerState = rememberPagerState(pageCount = { activity.images.size })
        val track = activity.track?.takeIf { it.coordinates.size > 1 }

        Box(
            modifier = Modifier.fillMaxSize().background(Color.Black),
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize().padding(top = 60.dp, bottom = 76.dp),
                pageSpacing = 16.dp,
            ) { page ->
                ActivityImageSlide(
                    image = activity.images[page],
                    onLoadImage = onLoadImage,
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .semantics {
                                contentDescription = "Photo ${page + 1} of ${activity.images.size}"
                            },
                    contentScale = ContentScale.Fit,
                    roundedCorners = false,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ViewerIconButton(onClick = onDismiss, contentDescription = "Close photos") {
                    Icon(Icons.Rounded.Close, contentDescription = null)
                }
                Spacer(Modifier.weight(1f))
                ViewerIconButton(onClick = {}, contentDescription = "Bookmark activity") {
                    Icon(Icons.Rounded.BookmarkBorder, contentDescription = null)
                }
                ViewerIconButton(onClick = {}, contentDescription = "More options") {
                    Icon(Icons.Rounded.MoreVert, contentDescription = null)
                }
            }

            if (track != null) {
                Box(
                    modifier =
                        Modifier
                            .align(Alignment.BottomStart)
                            .navigationBarsPadding()
                            .padding(start = 18.dp, bottom = 18.dp),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(86.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black)
                                .clickable(onClick = onDismiss)
                                .semantics { contentDescription = "Return to activity" },
                    ) {
                        StaticRoutePreview(
                            track = track,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
            }

            if (activity.images.size > 1) {
                Row(
                    modifier =
                        Modifier
                            .align(Alignment.BottomCenter)
                            .navigationBarsPadding()
                            .padding(bottom = 18.dp),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    repeat(activity.images.size) { page ->
                        Surface(
                            modifier =
                                Modifier
                                    .padding(horizontal = 3.dp)
                                    .size(if (page == pagerState.currentPage) 18.dp else 6.dp, 6.dp),
                            shape = RoundedCornerShape(3.dp),
                            color =
                                if (page == pagerState.currentPage) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    Color.White
                                        .copy(alpha = 0.45f)
                                },
                        ) {}
                    }
                }
            }
        }
    }
}

@Composable
private fun ViewerIconButton(
    onClick: () -> Unit,
    contentDescription: String,
    content: @Composable () -> Unit,
) {
    IconButton(
        onClick = onClick,
        modifier =
            Modifier
                .background(
                    Color.Black
                        .copy(alpha = 0.78f),
                    CircleShape,
                ).semantics { this.contentDescription = contentDescription },
    ) {
        content()
    }
}

@Composable
private fun ActivityEditor(
    name: String,
    description: String,
    sport: String,
    excludeFromRankings: Boolean,
    tags: List<String>,
    saving: Boolean,
    deleting: Boolean,
    error: String?,
    onNameChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onSportChange: (String) -> Unit,
    onExcludeChange: (Boolean) -> Unit,
    onTagsChange: (List<String>) -> Unit,
    onCancel: () -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
) {
    Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
        Text("Edit activity", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            label = { Text("Name") },
            placeholder = { Text("Activity name") },
            singleLine = true,
            enabled = !saving && !deleting,
        )
        ActivityTypePicker(
            selectedSport = sport,
            enabled = !saving && !deleting,
            onSportChange = onSportChange,
        )
        OutlinedTextField(
            value = description,
            onValueChange = onDescriptionChange,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            label = { Text("Description") },
            placeholder = { Text("Add a description") },
            minLines = 3,
            enabled = !saving && !deleting,
        )
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
            Checkbox(checked = excludeFromRankings, onCheckedChange = onExcludeChange, enabled = !saving && !deleting)
            Text("Exclude from rankings")
        }
        Text("Tags", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            listOf(
                "race" to "Race",
                "commute" to "Commute",
                "workout" to "Workout",
                "recovery" to "Recovery",
                "with_kid" to "With Kid",
                "with_pet" to "With Pet",
                "competition" to "Competition",
                "for_a_cause" to "For a Cause",
                "bad_gps" to "Bad GPS",
            ).forEach { (tag, label) ->
                FilterChip(selected = tag in tags, onClick = {
                    onTagsChange(
                        if (tag in
                            tags
                        ) {
                            tags - tag
                        } else {
                            tags + tag
                        },
                    )
                }, label = { Text(label) }, enabled = !saving && !deleting)
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp)) }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.End) {
            TextButton(
                onClick = onDelete,
                enabled = !saving && !deleting,
                modifier = Modifier.semantics { contentDescription = "Delete activity" },
            ) {
                Text("Delete", color = MaterialTheme.colorScheme.error)
            }
            TextButton(onClick = onCancel, enabled = !saving && !deleting) { Text("Cancel") }
            Button(onClick = onSave, enabled = !saving && !deleting) { Text(if (saving) "Saving…" else "Save") }
        }
    }
}
