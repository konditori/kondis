package app.kondis.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Dns
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.displaySmall)
        Text("Server", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 10.dp))
        Text(
            "URL of the Kondis server.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(
            value = state.serverUrlDraft,
            onValueChange = onServerUrlChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("API base URL") },
            leadingIcon = { Icon(Icons.Rounded.Dns, null) },
            supportingText = { Text("For example https://kondis.example") },
            singleLine = true,
        )
        Button(onClick = onSave, enabled = !state.checking, modifier = Modifier.fillMaxWidth()) {
            if (state.checking) CircularProgressIndicator(modifier = Modifier.padding(end = 10.dp), strokeWidth = 2.dp)
            Text(if (state.checking) "Checking…" else "Save and test connection")
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
        Text("Units", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 18.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            UnitSystem.entries.forEach { units ->
                FilterChip(
                    selected = state.settings.unitSystem == units,
                    onClick = { onUnitChange(units) },
                    label = { Text(if (units == UnitSystem.Metric) "Metric" else "Imperial") },
                    leadingIcon =
                        if (state.settings.unitSystem == units) {
                            { Icon(Icons.Rounded.CheckCircle, null) }
                        } else {
                            null
                        },
                )
            }
        }
        Button(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) { Text("Sign out and switch account") }
    }
}
