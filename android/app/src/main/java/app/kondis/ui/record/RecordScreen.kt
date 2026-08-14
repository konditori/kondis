package app.kondis.ui.record

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.GpsFixed
import androidx.compose.material.icons.rounded.LocationOff
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.Track
import app.kondis.model.UnitSystem
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed
import app.kondis.model.sportLabel
import app.kondis.recording.RecordingMode
import app.kondis.recording.RecordingState
import app.kondis.recording.distanceMeters
import app.kondis.ui.components.StaticRoutePreview
import app.kondis.ui.components.sportIcon

@Composable
fun RecordRoute(
    onActivitySaved: (String) -> Unit,
    onRecordingActiveChanged: (Boolean) -> Unit,
    viewModel: RecordingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(state.recording.mode) {
        onRecordingActiveChanged(state.recording.mode != RecordingMode.Idle)
    }
    androidx.compose.runtime.LaunchedEffect(state.savedActivityId) {
        state.savedActivityId?.let(onActivitySaved)
    }
    val context = LocalContext.current
    val permissions =
        buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.toTypedArray()
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            if (results[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
                viewModel.start()
            }
        }
    val hasLocationPermission =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED

    RecordScreen(
        state = state,
        onSportChange = viewModel::setSport,
        onStart = { if (hasLocationPermission) viewModel.start() else launcher.launch(permissions) },
        onPause = viewModel::pause,
        onResume = viewModel::resume,
        onFinish = viewModel::finish,
        onTitleChange = viewModel::setTitle,
        onSaveReview = viewModel::saveReview,
        onDiscard = viewModel::discard,
        onReset = viewModel::reset,
    )
}

@Composable
fun RecordScreen(
    state: RecordingUiState,
    onSportChange: (String) -> Unit,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onFinish: () -> Unit,
    onTitleChange: (String) -> Unit,
    onSaveReview: () -> Unit,
    onDiscard: () -> Unit,
    onReset: () -> Unit,
) {
    val recording = state.recording
    if (recording.mode == RecordingMode.Saving || recording.mode == RecordingMode.Saved) {
        PostRecordingScreen(
            state = state,
            onTitleChange = onTitleChange,
            onSave = onSaveReview,
            onDiscard = onDiscard,
            onDone = onReset,
        )
        return
    }
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Record", modifier = Modifier.fillMaxWidth(), style = MaterialTheme.typography.displaySmall)
        Text(
            "A private, reliable GPS workout",
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
        if (recording.mode == RecordingMode.Idle) {
            ActivityTypePicker(
                selectedSport = state.sport,
                enabled = true,
                onSportChange = onSportChange,
            )
        } else {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text("Workout type", style = MaterialTheme.typography.labelMedium)
                Text(sportLabel(state.sport), style = MaterialTheme.typography.titleMedium)
            }
        }
        Spacer(Modifier.weight(1f))
        Box(
            modifier = Modifier.size(220.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    if (recording.hasLocation) Icons.Rounded.GpsFixed else Icons.Rounded.LocationOff,
                    contentDescription = null,
                    modifier = Modifier.size(28.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Text(
                    formatDuration(recording.elapsedSeconds.toDouble()),
                    modifier = Modifier.padding(top = 8.dp),
                    style = MaterialTheme.typography.displaySmall,
                )
                Text(
                    when {
                        recording.mode == RecordingMode.Idle -> "Ready"
                        recording.points.isEmpty() -> "Looking for GPS…"
                        recording.points.last().accuracyMeters <= 10f -> "GPS excellent"
                        recording.points.last().accuracyMeters <= 30f -> "GPS good"
                        else -> "GPS weak"
                    },
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            Metric("Distance", formatDistance(recording.distanceMeters, UnitSystem.Metric))
            if (state.sport in setOf("ride", "mountain_bike_ride", "gravel_ride", "e_bike_ride", "virtual_ride")) {
                Metric("Speed", formatSpeed(recording.currentSpeedMetersPerSecond(), UnitSystem.Metric))
            } else {
                Metric("Pace", formatPace(recording.currentSpeedMetersPerSecond(), UnitSystem.Metric))
            }
        }
        Spacer(Modifier.weight(1f))
        when (recording.mode) {
            RecordingMode.Idle -> {
                Button(
                    onClick = onStart,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                ) {
                    Icon(Icons.Rounded.PlayArrow, contentDescription = null)
                    Text("Start workout", modifier = Modifier.padding(start = 8.dp))
                }
            }

            RecordingMode.Recording -> {
                Button(
                    onClick = onPause,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                ) {
                    Icon(Icons.Rounded.Pause, contentDescription = null)
                    Text("Pause")
                }
            }

            RecordingMode.Paused -> {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedButton(
                        onClick = onResume,
                        modifier = Modifier.weight(1f).height(56.dp),
                    ) {
                        Icon(Icons.Rounded.PlayArrow, contentDescription = null)
                        Text("Resume")
                    }
                    Button(
                        onClick = onFinish,
                        enabled = recording.hasLocation,
                        modifier = Modifier.weight(1f).height(56.dp),
                    ) {
                        Icon(Icons.Rounded.Stop, contentDescription = null)
                        Text("Finish")
                    }
                }
            }

            RecordingMode.Saving -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                    Text("Saving and syncing workout…", modifier = Modifier.padding(top = 12.dp))
                }
            }

            RecordingMode.Saved -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Rounded.Check,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(36.dp),
                    )
                    Text("Workout saved", style = MaterialTheme.typography.titleLarge)
                    Button(onClick = onReset, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) { Text("Done") }
                }
            }

            RecordingMode.Error -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        recording.errorMessage ?: "Recording failed",
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                    Button(
                        onClick = onReset,
                        modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    ) { Text("Dismiss") }
                }
            }
        }
    }
}

private fun RecordingState.currentSpeedMetersPerSecond(): Double? {
    val previous = points.dropLast(1).lastOrNull() ?: return null
    val latest = points.lastOrNull() ?: return null
    val seconds =
        java.time.Duration
            .between(previous.recordedAt, latest.recordedAt)
            .toMillis() / 1_000.0
    if (seconds <= 0) return null
    return distanceMeters(previous, latest) / seconds
}

@Composable
private fun PostRecordingScreen(
    state: RecordingUiState,
    onTitleChange: (String) -> Unit,
    onSave: () -> Unit,
    onDiscard: () -> Unit,
    onDone: () -> Unit,
) {
    var showDiscardDialog by remember { mutableStateOf(false) }
    val recording = state.recording
    val track =
        Track(
            type = "LineString",
            coordinates = recording.points.map { point -> listOf(point.longitude, point.latitude) },
        )
    androidx.compose.foundation.lazy.LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding =
            androidx.compose.foundation.layout
                .PaddingValues(bottom = 28.dp),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth().padding(start = 8.dp, top = 12.dp, end = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (recording.mode == RecordingMode.Saved) "Workout saved" else "Save activity",
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.headlineSmall,
                )
                if (recording.mode == RecordingMode.Saved) {
                    TextButton(onClick = onDone) { Text("Done") }
                }
            }
        }
        item {
            if (recording.points.size > 1) {
                StaticRoutePreview(
                    track = track,
                    modifier = Modifier.fillMaxWidth().height(300.dp).padding(top = 12.dp),
                )
            } else {
                Text(
                    "No GPS trace was captured for this activity.",
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 32.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        item {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 20.dp)) {
                Text("Activity title", style = MaterialTheme.typography.labelLarge)
                OutlinedTextField(
                    value = state.title,
                    onValueChange = onTitleChange,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    enabled = !state.uploading && recording.mode != RecordingMode.Saved,
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                )
                Row(
                    Modifier.fillMaxWidth().padding(top = 24.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    Metric("Distance", formatDistance(recording.distanceMeters, UnitSystem.Metric))
                    Metric("Time", formatDuration(recording.elapsedSeconds.toDouble()))
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 20.dp)) {
                if (state.uploading) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(22.dp))
                        Text("Uploading activity…", modifier = Modifier.padding(start = 12.dp))
                    }
                } else if (recording.mode == RecordingMode.Saved) {
                    Text(
                        "Saved on this device. It will upload when your Kondis server is reachable.",
                        color = MaterialTheme.colorScheme.primary,
                    )
                } else {
                    Button(onClick = onSave, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text("Save activity") }
                    TextButton(onClick = { showDiscardDialog = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Discard activity")
                    }
                }
            }
        }
    }
    if (showDiscardDialog) {
        AlertDialog(
            onDismissRequest = { showDiscardDialog = false },
            title = { Text("Discard workout?") },
            text = { Text("This recording will be permanently deleted and cannot be recovered.") },
            confirmButton = {
                TextButton(onClick = {
                    showDiscardDialog = false
                    onDiscard()
                }) { Text("Discard") }
            },
            dismissButton = { TextButton(onClick = { showDiscardDialog = false }) { Text("Keep workout") } },
        )
    }
}

private val commonRecordSports =
    listOf(
        "run",
        "ride",
        "walk",
        "hike",
        "swim",
        "trail_run",
        "mountain_bike_ride",
        "gravel_ride",
        "e_bike_ride",
        "virtual_ride",
        "rowing",
        "canoeing",
    )

private val allRecordSports =
    listOf(
        "alpine_ski",
        "backcountry_ski",
        "badminton",
        "basketball",
        "canoeing",
        "cricket",
        "cross_country_ski",
        "crossfit",
        "dance",
        "e_bike_ride",
        "elliptical",
        "e_mountain_bike_ride",
        "golf",
        "gravel_ride",
        "handcycle",
        "high_intensity_interval_training",
        "hike",
        "ice_skate",
        "inline_skate",
        "kayaking",
        "kitesurf",
        "mountain_bike_ride",
        "padel",
        "physical_therapy",
        "pickleball",
        "pilates",
        "racquetball",
        "ride",
        "rock_climbing",
        "roller_ski",
        "rowing",
        "run",
        "sail",
        "skateboard",
        "snowboard",
        "snowshoe",
        "soccer",
        "squash",
        "stair_stepper",
        "stand_up_paddling",
        "surfing",
        "swim",
        "table_tennis",
        "tennis",
        "trail_run",
        "velomobile",
        "virtual_ride",
        "virtual_row",
        "virtual_run",
        "volleyball",
        "walk",
        "weight_training",
        "wheelchair",
        "windsurf",
        "workout",
        "yoga",
        "other",
    )

@Composable
fun ActivityTypePicker(
    selectedSport: String,
    enabled: Boolean,
    onSportChange: (String) -> Unit,
) {
    var open = remember { mutableStateOf(false) }
    OutlinedButton(
        onClick = { open.value = true },
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().height(56.dp),
        shape = RoundedCornerShape(16.dp),
        contentPadding =
            androidx.compose.foundation.layout
                .PaddingValues(horizontal = 16.dp),
    ) {
        Icon(sportIcon(selectedSport), contentDescription = null)
        Text(
            sportLabel(selectedSport),
            modifier = Modifier.weight(1f).padding(start = 12.dp),
            textAlign = TextAlign.Start,
        )
        Icon(Icons.Rounded.ExpandMore, contentDescription = "Choose activity type")
    }
    if (open.value) {
        ActivityTypeSheet(
            selectedSport = selectedSport,
            onDismiss = { open.value = false },
            onSelect = { sport ->
                onSportChange(sport)
                open.value = false
            },
        )
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun ActivityTypeSheet(
    selectedSport: String,
    onDismiss: () -> Unit,
    onSelect: (String) -> Unit,
) {
    var query = remember { mutableStateOf("") }
    val normalizedQuery = query.value.trim()
    val common =
        commonRecordSports.filter {
            normalizedQuery.isBlank() ||
                sportLabel(it).contains(normalizedQuery, ignoreCase = true)
        }
    val more =
        allRecordSports
            .filterNot(commonRecordSports::contains)
            .filter { normalizedQuery.isBlank() || sportLabel(it).contains(normalizedQuery, ignoreCase = true) }
            .sortedBy(::sportLabel)
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Choose a sport", style = MaterialTheme.typography.headlineSmall)
                    Text("Select what you’re about to record", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = onDismiss) { Icon(Icons.Rounded.Close, contentDescription = "Close") }
            }
            OutlinedTextField(
                value = query.value,
                onValueChange = { query.value = it },
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                singleLine = true,
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                placeholder = { Text("Search sports") },
                shape = RoundedCornerShape(14.dp),
            )
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                contentPadding =
                    androidx.compose.foundation.layout
                        .PaddingValues(top = 16.dp, bottom = 32.dp),
            ) {
                if (common.isNotEmpty()) {
                    item {
                        Text(
                            "Popular",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(vertical = 8.dp),
                        )
                    }
                    items(
                        common,
                        key = { "popular-$it" },
                    ) { sport -> ActivityTypeRow(sport, selectedSport == sport, onSelect) }
                }
                if (more.isNotEmpty()) {
                    item {
                        Text(
                            "More activities",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 20.dp, bottom = 8.dp),
                        )
                    }
                    items(
                        more,
                        key = { "more-$it" },
                    ) { sport -> ActivityTypeRow(sport, selectedSport == sport, onSelect) }
                }
                if (common.isEmpty() &&
                    more.isEmpty()
                ) {
                    item {
                        Text(
                            "No sports found",
                            modifier = Modifier.padding(vertical = 24.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ActivityTypeRow(
    sport: String,
    selected: Boolean,
    onSelect: (String) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().clickable { onSelect(sport) }.padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            sportIcon(sport),
            contentDescription = null,
            tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(28.dp),
        )
        Text(
            sportLabel(sport),
            modifier = Modifier.weight(1f).padding(start = 16.dp),
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
        )
        if (selected) {
            Icon(
                Icons.Rounded.Check,
                contentDescription = "Selected",
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun Metric(
    label: String,
    value: String,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.headlineMedium)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
