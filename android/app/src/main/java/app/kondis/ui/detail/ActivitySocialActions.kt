package app.kondis.ui.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChatBubbleOutline
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.kondis.model.ActivityDetail
import app.kondis.ui.i18n.tr

@Composable
internal fun ActivitySocialSection(
    activity: ActivityDetail,
    onLike: () -> Unit,
    onOpenDiscussion: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            IconButton(onClick = onLike, modifier = Modifier.size(32.dp)) {
                Icon(
                    if (activity.viewerLiked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    contentDescription = if (activity.viewerLiked) tr("unlike_activity") else tr("like_activity"),
                    tint = if (activity.viewerLiked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(activity.likeCount.toString(), color = MaterialTheme.colorScheme.onSurfaceVariant)
            IconButton(onClick = onOpenDiscussion, modifier = Modifier.padding(start = 12.dp).size(32.dp)) {
                Icon(
                    Icons.Rounded.ChatBubbleOutline,
                    contentDescription = tr("comments_count", activity.commentCount),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(activity.commentCount.toString(), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
