package app.kondis.ui.components

import android.graphics.Bitmap
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
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

@Composable
fun ActivityCard(
    activity: Activity,
    units: UnitSystem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onLike: () -> Unit = {},
    onLoadImage: suspend (String) -> Bitmap? = { null },
) {
    Card(
        modifier = modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(18.dp),
                horizontalArrangement = Arrangement.spacedBy(13.dp),
            ) {
                Box(
                    modifier = Modifier.size(44.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(sportIcon(activity.sport), contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    activity.athlete?.let { athlete ->
                        Text(
                            athlete.name,
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Text(activity.displayName(), style = MaterialTheme.typography.titleMedium)
                    Text(
                        formatDateTime(activity.startedAt),
                        style = MaterialTheme.typography.bodyMedium,
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
                    val achievements = activity.topBestEfforts.orEmpty()
                    val achievementCount = activity.achievementCount
                    if (achievementCount != null && achievements.isNotEmpty()) {
                        Row(
                            modifier = Modifier.padding(top = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            distinctAchievementEfforts(achievements).forEach { effort -> AchievementBadge(effort) }
                            if (shouldShowAchievementCount(achievementCount, achievements)) {
                                Text(
                                    achievementCount.toString(),
                                    modifier = Modifier.padding(end = 2.dp),
                                    fontSize = 13.sp,
                                    lineHeight = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }
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
            ActivityCardVisualPager(activity, onLoadImage)
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 18.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onLike) {
                    Icon(
                        if (activity.viewerLiked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                        contentDescription = if (activity.viewerLiked) tr("unlike_activity") else tr("like_activity"),
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
        }
    }
}

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
