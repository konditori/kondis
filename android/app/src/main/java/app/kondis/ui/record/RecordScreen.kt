package app.kondis.ui.record

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.GpsFixed
import androidx.compose.material.icons.rounded.LocationOff
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.UnitSystem
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.recording.RecordingMode

@Composable
fun RecordRoute(viewModel: RecordingViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val permissions = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
    }.toTypedArray()
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        if (results[Manifest.permission.ACCESS_FINE_LOCATION] == true) {
            viewModel.start()
        }
    }
    val hasLocationPermission = ContextCompat.checkSelfPermission(
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
    onDiscard: () -> Unit,
    onReset: () -> Unit,
) {
    val recording = state.recording
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
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("run" to "Run", "ride" to "Ride", "walk" to "Walk", "hike" to "Hike").forEach { (value, label) ->
                FilterChip(
                    selected = state.sport == value,
                    onClick = { onSportChange(value) },
                    enabled = recording.mode == RecordingMode.Idle,
                    label = { Text(label) },
                )
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
                    if (recording.hasLocation) "GPS locked" else if (recording.mode == RecordingMode.Idle) "Ready" else "Finding GPS…",
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            Metric("Distance", formatDistance(recording.distanceMeters, UnitSystem.Metric))
            Metric("Points", recording.points.size.toString())
        }
        Spacer(Modifier.weight(1f))
        when (recording.mode) {
            RecordingMode.Idle -> Button(
                onClick = onStart,
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) {
                Icon(Icons.Rounded.PlayArrow, contentDescription = null)
                Text("Start workout", modifier = Modifier.padding(start = 8.dp))
            }
            RecordingMode.Recording, RecordingMode.Paused -> Row(
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedButton(
                            onClick = if (recording.mode == RecordingMode.Recording) onPause else onResume,
                            modifier = Modifier.weight(1f).height(56.dp),
                        ) {
                            Icon(if (recording.mode == RecordingMode.Recording) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null)
                            Text(if (recording.mode == RecordingMode.Recording) "Pause" else "Resume")
                        }
                        Button(
                            onClick = onFinish,
                            enabled = recording.hasLocation,
                            modifier = Modifier.weight(1f).height(56.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary),
                        ) {
                            Icon(Icons.Rounded.Stop, null)
                            Text("Finish")
                        }
                    }
                    TextButton(onClick = onDiscard, modifier = Modifier.fillMaxWidth()) { Text("Discard workout") }
                }
            }
            RecordingMode.Saving -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Text("Saving and syncing workout…", modifier = Modifier.padding(top = 12.dp))
            }
            RecordingMode.Saved -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Rounded.Check, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(36.dp))
                Text("Workout saved", style = MaterialTheme.typography.titleLarge)
                Button(onClick = onReset, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) { Text("Done") }
            }
            RecordingMode.Error -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    recording.errorMessage ?: "Recording failed",
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                )
                Button(onClick = onReset, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) { Text("Dismiss") }
            }
        }
    }
}

@Composable
private fun Metric(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.headlineMedium)
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
