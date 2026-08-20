package app.kondis.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Dns
import androidx.compose.material.icons.rounded.Straighten
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.UnitSystem

@Composable
fun SettingsRoute(viewModel: SettingsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    SettingsScreen(
        state = state,
        onServerUrlChange = viewModel::setServerUrlDraft,
        onUnitChange = viewModel::setUnits,
        onSave = viewModel::saveAndTest,
        onSignOut = viewModel::signOut,
    )
}

@Composable
fun SettingsScreen(
    state: SettingsUiState,
    onServerUrlChange: (String) -> Unit,
    onUnitChange: (UnitSystem) -> Unit,
    onSave: () -> Unit,
    onSignOut: () -> Unit,
) {
    var showSignOutConfirmation by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.displaySmall)
        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 18.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Icon(
                        Icons.Rounded.Straighten,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Text("Units of measurement", style = MaterialTheme.typography.titleLarge)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    UnitOption(
                        label = "Metric",
                        selected = state.settings.unitSystem == UnitSystem.Metric,
                        onClick = { onUnitChange(UnitSystem.Metric) },
                        modifier = Modifier.weight(1f),
                    )
                    UnitOption(
                        label = "Imperial",
                        selected = state.settings.unitSystem == UnitSystem.Imperial,
                        onClick = { onUnitChange(UnitSystem.Imperial) },
                        modifier = Modifier.weight(1f),
                    )
                }
                Button(onClick = { onUnitChange(state.settings.unitSystem) }) {
                    Text("Save preference")
                }
            }
        }
        Text("Server URL", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 10.dp))
        OutlinedTextField(
            value = state.serverUrlDraft,
            onValueChange = onServerUrlChange,
            enabled = !state.serverActive,
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = { Icon(Icons.Rounded.Dns, null) },
            supportingText =
                if (!state.serverActive) {
                    { Text("For example http://192.168.0.10 or https://kondis.example.com") }
                } else {
                    null
                },
            singleLine = true,
        )
        if (state.serverActive) {
            Button(
                onClick = { showSignOutConfirmation = true },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Sign out") }
        } else {
            Button(onClick = onSave, enabled = !state.checking, modifier = Modifier.fillMaxWidth()) {
                if (state.checking) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(end = 10.dp),
                        strokeWidth = 2.dp,
                    )
                }
                Text(if (state.checking) "Checking…" else "Save and test connection")
            }
        }
        state.message?.let { message ->
            Text(
                message,
                color =
                    if (message ==
                        "Connected successfully"
                    ) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    },
            )
        }
    }

    if (showSignOutConfirmation) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showSignOutConfirmation = false },
            title = { Text("Sign out?") },
            text = { Text("You will sign out from your Kondis server") },
            confirmButton = {
                androidx.compose.material3.TextButton(
                    onClick = {
                        showSignOutConfirmation = false
                        onSignOut()
                    },
                ) { Text("Sign out") }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(onClick = { showSignOutConfirmation = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun UnitOption(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        modifier = modifier,
        colors =
            CardDefaults.cardColors(
                containerColor =
                    if (selected) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surface
                    },
            ),
        border =
            androidx.compose.foundation.BorderStroke(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
            ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(18.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(
                if (selected) Icons.Rounded.CheckCircle else Icons.Rounded.Dns,
                contentDescription = null,
                tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(label, style = MaterialTheme.typography.titleMedium)
        }
    }
}
