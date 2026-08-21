package app.kondis.ui.detail

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.kondis.model.ActivityDetail
import app.kondis.model.Comment
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDistance
import app.kondis.ui.components.StaticRoutePreview
import app.kondis.ui.components.sportIcon
import app.kondis.ui.i18n.tr

@Composable
fun ActivityDiscussionRoute(
    id: String,
    onBack: () -> Unit,
    viewModel: ActivityDetailViewModel = hiltViewModel(),
) {
    LaunchedEffect(id) { viewModel.load(id) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    ActivityDiscussionScreen(
        activity = state.activity,
        comments = state.comments,
        loading = state.loading || state.commentsLoading,
        commenting = state.commenting,
        onBack = onBack,
        onRefresh = viewModel::refreshDiscussion,
        onComment = viewModel::addComment,
        onLoadImage = viewModel::loadImage,
    )
}

@Composable
private fun ActivityDiscussionScreen(
    activity: ActivityDetail?,
    comments: List<Comment>,
    loading: Boolean,
    commenting: Boolean,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onComment: (String) -> Unit,
    onLoadImage: suspend (String) -> Bitmap?,
) {
    var draft by remember(activity?.id) { mutableStateOf("") }
    var commentCountBeforeSubmission by remember(activity?.id) { mutableStateOf<Int?>(null) }
    val commentListState = rememberLazyListState()
    val pullToRefreshState = rememberPullToRefreshState()

    LaunchedEffect(comments.size, commentCountBeforeSubmission) {
        val previousCommentCount = commentCountBeforeSubmission ?: return@LaunchedEffect
        if (comments.size > previousCommentCount) {
            commentListState.animateScrollToItem(comments.size + 1)
            commentCountBeforeSubmission = null
        }
    }

    Surface(modifier = Modifier.fillMaxSize().imePadding(), color = MaterialTheme.colorScheme.surface) {
        Column {
            Row(
                Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = tr("back"))
                }
                Text(tr("discussion"), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            HorizontalDivider()
            if (activity == null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    if (loading) CircularProgressIndicator()
                }
                return@Surface
            }
            PullToRefreshBox(
                isRefreshing = loading,
                onRefresh = onRefresh,
                state = pullToRefreshState,
                modifier = Modifier.weight(1f),
            ) {
                LazyColumn(modifier = Modifier.fillMaxSize(), state = commentListState) {
                    item { DiscussionActivityHeader(activity) }
                    item { HorizontalDivider() }
                    if (loading && comments.isEmpty()) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                            }
                        }
                    } else if (comments.isEmpty()) {
                        item {
                            Text(
                                "No comments yet",
                                modifier = Modifier.padding(20.dp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        items(comments.size, key = { comments[it].id }) { index ->
                            DiscussionComment(comments[index], onLoadImage)
                        }
                    }
                }
            }
            HorizontalDivider()
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it.take(2_000) },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text(tr("add_comment")) },
                    singleLine = true,
                )
                Spacer(Modifier.width(8.dp))
                IconButton(
                    onClick = {
                        commentCountBeforeSubmission = comments.size
                        onComment(draft)
                        draft = ""
                    },
                    enabled = draft.isNotBlank() && !commenting,
                ) {
                    Icon(
                        Icons.AutoMirrored.Rounded.Send,
                        contentDescription = tr("post"),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
    }
}

@Composable
private fun DiscussionActivityHeader(activity: ActivityDetail) {
    Column(Modifier.fillMaxWidth()) {
        activity.track?.takeIf { it.coordinates.size > 1 }?.let { track ->
            StaticRoutePreview(track = track, modifier = Modifier.fillMaxWidth().height(120.dp))
        }
        Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            Text(
                activity.summary().displayName(),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Row(
                modifier = Modifier.padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(activity.athlete?.name.orEmpty(), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(tr("activity_metadata_separator"), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(discussionActivityDate(activity.startedAt), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(tr("activity_metadata_separator"), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Icon(
                    sportIcon(activity.sport),
                    contentDescription = null,
                    modifier = Modifier.size(15.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    formatDistance(activity.metrics?.distance, UnitSystem.Metric),
                    modifier = Modifier.padding(start = 5.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Row(
                modifier = Modifier.padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Rounded.FavoriteBorder,
                    contentDescription = tr("like_activity"),
                    modifier = Modifier.size(22.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    activity.likeCount.toString(),
                    modifier = Modifier.padding(start = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun DiscussionComment(
    comment: Comment,
    onLoadImage: suspend (String) -> Bitmap?,
) {
    val avatar by produceState<Bitmap?>(initialValue = null, key1 = comment.user.avatarUrl) {
        value = comment.user.avatarUrl?.let { runCatching { onLoadImage(it) }.getOrNull() }
    }
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.Top) {
        Avatar(avatar, comment.user.name, Modifier.size(42.dp))
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(comment.user.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Text(
                    relativeDiscussionTimestamp(comment.createdAt),
                    modifier = Modifier.padding(start = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(comment.body, modifier = Modifier.padding(top = 5.dp), style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun Avatar(
    bitmap: Bitmap?,
    name: String?,
    modifier: Modifier = Modifier,
) {
    Box(modifier.clip(CircleShape), contentAlignment = Alignment.Center) {
        bitmap?.let {
            Image(
                it.asImageBitmap(),
                contentDescription = name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } ?: Icon(
            Icons.Rounded.Person,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.primaryContainer).padding(9.dp),
        )
    }
}

private fun relativeDiscussionTimestamp(instant: String): String =
    runCatching {
        val timestamp = java.time.Instant.parse(instant)
        val minutesAgo =
            java.time.Duration
                .between(timestamp, java.time.Instant.now())
                .toMinutes()
                .coerceAtLeast(0)
        when {
            minutesAgo < 1 -> {
                "Just now"
            }

            minutesAgo < 60 -> {
                "$minutesAgo min ago"
            }

            minutesAgo < 24 * 60 -> {
                val hoursAgo = minutesAgo / 60
                "$hoursAgo ${if (hoursAgo == 1L) "hour" else "hours"} ago"
            }

            minutesAgo < 7 * 24 * 60 -> {
                val daysAgo = minutesAgo / (24 * 60)
                "$daysAgo ${if (daysAgo == 1L) "day" else "days"} ago"
            }

            else -> {
                formatDateTime(timestamp.toString())
            }
        }
    }.getOrElse { formatDateTime(instant) }

private fun discussionActivityDate(instant: String): String =
    runCatching {
        java.time.format.DateTimeFormatter
            .ofPattern("M/d/yy", java.util.Locale.US)
            .format(
                java.time.Instant
                    .parse(instant)
                    .atZone(java.time.ZoneId.systemDefault()),
            )
    }.getOrElse { formatDateTime(instant) }
