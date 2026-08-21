package app.kondis.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChatBubbleOutline
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kondis.model.Activity
import app.kondis.model.UnitSystem
import app.kondis.model.displayName
import app.kondis.model.formatDateTime
import app.kondis.model.formatDistance
import app.kondis.model.formatDuration
import app.kondis.model.formatPace
import app.kondis.model.formatSpeed
import app.kondis.ui.i18n.tr
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit

@Composable
fun ActivityCard(
    activity: Activity,
    units: UnitSystem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onLike: () -> Unit = {},
    onLoadImage: suspend (String) -> Bitmap? = { null },
) {
    Column(
        modifier = modifier.fillMaxWidth().clickable(onClick = onClick),
    ) {
        Column {
            val avatarPath = activity.athlete?.avatarUrl
            val avatarBitmap by produceState<Bitmap?>(initialValue = null, key1 = avatarPath) {
                value = avatarPath?.let { runCatching { onLoadImage(it) }.getOrNull() }
            }
            Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier.size(40.dp).clip(CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        avatarBitmap?.let {
                            Image(
                                bitmap = it.asImageBitmap(),
                                contentDescription = activity.athlete?.name,
                                modifier = Modifier.size(40.dp),
                                contentScale = ContentScale.Crop,
                            )
                        } ?: Icon(
                            Icons.Rounded.Person,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier =
                                Modifier
                                    .size(
                                        40.dp,
                                    ).background(MaterialTheme.colorScheme.primaryContainer)
                                    .padding(9.dp),
                        )
                    }
                    Column(Modifier.padding(start = 12.dp)) {
                        activity.athlete?.name?.takeIf(String::isNotBlank)?.let {
                            Text(it, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                sportIcon(activity.sport),
                                contentDescription = null,
                                modifier = Modifier.size(13.dp),
                                tint = MaterialTheme.colorScheme.primary,
                            )
                            Text(
                                formatFeedDate(activity.startedAt),
                                modifier = Modifier.padding(start = 2.dp),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                val visibleAchievements = distinctAchievementEfforts(activity.topBestEfforts.orEmpty())
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        activity.displayName(),
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    if (visibleAchievements.isNotEmpty()) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            visibleAchievements.forEach { effort -> AchievementBadge(effort) }
                            activity.achievementCount?.let { count ->
                                if (shouldShowAchievementCount(count, activity.topBestEfforts.orEmpty())) {
                                    Text(
                                        count.toString(),
                                        modifier = Modifier.padding(start = 2.dp),
                                        fontSize = 13.sp,
                                        lineHeight = 13.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                        }
                    }
                }
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
                activity.description?.takeIf(String::isNotBlank)?.let { description ->
                    Text(
                        description,
                        modifier = Modifier.padding(top = 8.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(12.dp))
                ActivityCardVisualPager(
                    activity,
                    onLoadImage,
                )
                Spacer(Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    val metrics = activity.metrics
                    ActivityStat(tr("distance"), formatDistance(metrics?.distance, units))
                    ActivityStat(tr("time"), formatDuration(metrics?.movingTime ?: metrics?.elapsedTime))
                    val isPace = activity.sport.contains("run") || activity.sport == "walk"
                    ActivityStat(
                        if (isPace) tr("pace") else tr("speed"),
                        if (isPace) formatPace(metrics?.avgSpeed, units) else formatSpeed(metrics?.avgSpeed, units),
                    )
                }
            }
            activity.personalRecord()?.let { effort ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .background(
                                MaterialTheme.colorScheme.surfaceVariant,
                            ).padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    AchievementMedal(effort.overallRank, showRank = true)
                    Text(
                        achievementText(effort),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 18.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onLike, modifier = Modifier.size(40.dp)) {
                    Icon(
                        if (activity.viewerLiked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                        contentDescription =
                            if (activity.viewerLiked) {
                                tr(
                                    "unlike_activity",
                                )
                            } else {
                                tr("like_activity")
                            },
                        tint =
                            if (activity.viewerLiked) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                    )
                }
                Text(activity.likeCount.toString(), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Icon(
                    Icons.Rounded.ChatBubbleOutline,
                    contentDescription = tr("comments_count", activity.commentCount),
                    modifier = Modifier.padding(start = 20.dp),
                )
                Text(
                    activity.commentCount.toString(),
                    modifier = Modifier.padding(start = 6.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            androidx.compose.material3.HorizontalDivider()
        }
    }
}

private fun formatFeedDate(instant: String): String =
    runCatching {
        val zone = ZoneId.systemDefault()
        val activityTime = Instant.parse(instant).atZone(zone)
        val daysAgo = ChronoUnit.DAYS.between(activityTime.toLocalDate(), java.time.LocalDate.now(zone))
        val time = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).format(activityTime)
        when (daysAgo) {
            0L -> "Today, $time"
            1L -> "Yesterday, $time"
            in 2..6 -> "$daysAgo days ago, $time"
            else -> formatDateTime(instant)
        }
    }.getOrElse { formatDateTime(instant) }

@Composable
private fun ActivityCardVisualPager(
    activity: Activity,
    onLoadImage: suspend (String) -> Bitmap?,
) {
    val hasMap =
        activity.track
            ?.coordinates
            ?.size
            ?.let { it > 1 } == true
    val pageCount = (if (hasMap) 1 else 0) + activity.images.size
    if (pageCount == 0) return

    val pagerState = rememberPagerState(pageCount = { pageCount })
    Box {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(190.dp),
            contentPadding = PaddingValues(horizontal = 0.dp),
            pageSpacing = 8.dp,
        ) { page ->
            if (hasMap && page == 0) {
                activity.track.let { track ->
                    StaticRoutePreview(track = track, modifier = Modifier.fillMaxWidth().height(190.dp))
                }
            } else {
                ActivityImageSlide(
                    image = activity.images[page - if (hasMap) 1 else 0],
                    onLoadImage = onLoadImage,
                    modifier = Modifier.fillMaxWidth().height(190.dp),
                )
            }
        }
    }
    if (pageCount > 1) {
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.Center) {
            repeat(pageCount) { page ->
                Surface(
                    modifier =
                        Modifier.padding(horizontal = 3.dp).size(
                            if (page ==
                                pagerState.currentPage
                            ) {
                                18.dp
                            } else {
                                6.dp
                            },
                            6.dp,
                        ),
                    shape = RoundedCornerShape(3.dp),
                    color =
                        if (page ==
                            pagerState.currentPage
                        ) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.outlineVariant
                        },
                ) {}
            }
        }
    }
}
