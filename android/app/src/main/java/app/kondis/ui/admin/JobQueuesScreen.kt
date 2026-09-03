package app.kondis.ui.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Archive
import androidx.compose.material.icons.rounded.BrokenImage
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Error
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.data.remote.AllJobStatusResponse
import app.kondis.data.remote.JobHistoryEntryResponse
import app.kondis.data.remote.QueueStatusResponse
import app.kondis.ui.i18n.tr
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private data class QueueDefinition(
    val key: String,
    val labelKey: String,
    val descriptionKey: String,
    val icon: ImageVector,
    val status: (AllJobStatusResponse) -> QueueStatusResponse,
)

private val queues =
    listOf(
        QueueDefinition(
            "activityParsing",
            "activity_processing",
            "activity_processing_description",
            Icons.Rounded.Timer,
            AllJobStatusResponse::activityParsing,
        ),
        QueueDefinition(
            "backgroundTask",
            "imports_and_tasks",
            "imports_and_tasks_description",
            Icons.Rounded.Archive,
            AllJobStatusResponse::backgroundTask,
        ),
        QueueDefinition(
            "imageProcessing",
            "image_processing",
            "image_processing_description",
            Icons.Rounded.Image,
            AllJobStatusResponse::imageProcessing,
        ),
        QueueDefinition(
            "storage",
            "storage_tasks",
            "storage_tasks_description",
            Icons.Rounded.Storage,
            AllJobStatusResponse::storage,
        ),
    )

@Composable
fun JobQueuesRoute(
    onBack: () -> Unit,
    viewModel: JobQueuesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    JobQueuesScreen(
        state = state,
        onBack = onBack,
        onRefresh = viewModel::refresh,
    )
}

@Composable
private fun JobQueuesScreen(
    state: JobQueuesUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 8.dp, top = 8.dp, end = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = tr("back"))
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        tr("administration").uppercase(),
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Text(
                        tr("job_queues"),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
                IconButton(onClick = onRefresh, enabled = !state.loading) {
                    Icon(Icons.Rounded.Refresh, contentDescription = tr("refresh"))
                }
            }
        }

        state.errorMessage?.let { message ->
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.Error, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    Text(message, color = MaterialTheme.colorScheme.error)
                }
            }
        }

        if (state.loading && state.queues == null) {
            item {
                Row(Modifier.fillMaxWidth().padding(36.dp), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
                }
            }
        }

        state.queues?.let { status ->
            items(queues, key = QueueDefinition::key) { definition ->
                QueueCard(
                    definition = definition,
                    report = definition.status(status),
                )
            }
        }

        item {
            Text(
                tr("recent_jobs"),
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                tr("recent_jobs_description"),
                modifier = Modifier.padding(horizontal = 20.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        if (!state.loading && state.history.isEmpty()) {
            item {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Rounded.BrokenImage, contentDescription = null)
                    Text(tr("no_job_history"), modifier = Modifier.padding(top = 10.dp), fontWeight = FontWeight.Bold)
                }
            }
        } else {
            items(state.history, key = JobHistoryEntryResponse::id) { job -> JobHistoryCard(job) }
        }
    }
}

@Composable
private fun QueueCard(
    definition: QueueDefinition,
    report: QueueStatusResponse,
) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                    Icon(
                        definition.icon,
                        contentDescription = null,
                        modifier = Modifier.padding(10.dp).size(21.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        tr(definition.labelKey),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        tr(definition.descriptionKey),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                JobCount(tr("active"), report.jobCounts.active)
                JobCount(tr("waiting"), report.jobCounts.queued)
                JobCount(tr("failed"), report.jobCounts.failed, report.jobCounts.failed > 0)
            }
        }
    }
}

@Composable
private fun JobCount(
    label: String,
    value: Int,
    failed: Boolean = false,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            value.toString(),
            color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun JobHistoryCard(job: JobHistoryEntryResponse) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (job.status == "failed") Icons.Rounded.Error else Icons.Rounded.CheckCircle,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = statusColor(job.status),
                )
                Text(
                    job.name.replace(Regex("([a-z0-9])([A-Z])"), "$1 $2"),
                    modifier = Modifier.padding(start = 8.dp).weight(1f),
                    fontWeight = FontWeight.Bold,
                )
                StatusPill(statusLabel(job.status), job.status)
            }
            HorizontalDivider()
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(queueLabel(job.queue), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.weight(1f))
                Text(
                    formatTimestamp(job.startedAt ?: job.createdAt),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    formatDuration(job.durationMs),
                    modifier = Modifier.padding(start = 10.dp),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                )
            }
            job.error?.let { error ->
                Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun StatusPill(
    label: String,
    status: String,
) {
    Surface(
        color = statusColor(status).copy(alpha = 0.16f),
        contentColor = statusColor(status),
        shape = RoundedCornerShape(50),
    ) {
        Text(
            label.uppercase(),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun statusLabel(status: String): String =
    when (status) {
        "queued" -> tr("job_status_queued")
        "running" -> tr("job_status_running")
        "succeeded" -> tr("job_status_succeeded")
        "failed" -> tr("job_status_failed")
        else -> tr("job_status_skipped")
    }

@Composable
private fun queueLabel(queue: String): String = queues.firstOrNull { it.key == queue }?.let { tr(it.labelKey) } ?: queue

private fun statusColor(status: String): Color =
    when (status) {
        "failed" -> Color(0xFFDC5A68)
        "queued", "running" -> Color(0xFF78A6FF)
        "skipped" -> Color(0xFFD7BD69)
        else -> Color(0xFF57B982)
    }

private fun formatDuration(milliseconds: Long?): String =
    when {
        milliseconds == null -> "—"
        milliseconds < 1_000 -> "$milliseconds ms"
        milliseconds < 60_000 -> "${milliseconds / 1_000}s"
        else -> "${milliseconds / 60_000}m ${(milliseconds % 60_000) / 1_000}s"
    }

private val jobDateFormatter = DateTimeFormatter.ofPattern("MMM d, HH:mm").withZone(ZoneId.systemDefault())

private fun formatTimestamp(value: String): String =
    runCatching { jobDateFormatter.format(Instant.parse(value)) }.getOrDefault(value)
