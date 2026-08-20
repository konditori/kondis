package app.kondis.model

import kotlinx.serialization.Serializable

@Serializable
data class Activity(
    val id: String,
    val uploadId: String,
    val sport: String,
    val name: String?,
    val description: String?,
    val excludeFromRankings: Boolean,
    val tags: List<String> = emptyList(),
    val startedAt: String,
    val timezoneOffsetMinutes: Int?,
    val metrics: ActivityMetrics?,
    val createdAt: String,
    val updatedAt: String,
    val topBestEfforts: List<BestEffortSummary>? = null,
    val achievementCount: Int? = null,
    val track: Track? = null,
    val images: List<ActivityImage> = emptyList(),
    val userId: String? = null,
    val athlete: SocialUser? = null,
    val likeCount: Int = 0,
    val commentCount: Int = 0,
    val viewerLiked: Boolean = false,
)

@Serializable
data class SocialUser(
    val id: String,
    val firstName: String,
    val lastName: String,
    val avatarUrl: String? = null,
) {
    val name: String get() = "$firstName $lastName".trim()
}

@Serializable
data class SocialRelation(
    val following: Boolean,
    val incomingRequest: Boolean,
    val outgoingRequest: Boolean,
    val blockedByViewer: Boolean,
    val blockedViewer: Boolean,
)

@Serializable
data class PersonSearchResult(
    val user: SocialUser,
    val relation: SocialRelation,
)

@Serializable
data class LikeState(
    val liked: Boolean,
    val likeCount: Int,
)

@Serializable
data class Comment(
    val id: String,
    val body: String,
    val createdAt: String,
    val updatedAt: String,
    val user: SocialUser,
)

@Serializable
data class CommentPage(
    val comments: List<Comment>,
    val nextCursor: String? = null,
)

@Serializable
data class ActivityImage(
    val id: String,
    val caption: String? = null,
    val sortOrder: Int = 0,
    val width: Int? = null,
    val height: Int? = null,
    val status: String = "ready",
    val thumbnail: String? = null,
    val preview: String? = null,
    val original: String? = null,
)

@Serializable
data class ActivityUpdate(
    val name: String? = null,
    val description: String? = null,
    val excludeFromRankings: Boolean? = null,
    val sport: String? = null,
    val tags: List<String>? = null,
)

@Serializable
data class ActivityMetrics(
    val elapsedTime: Double,
    val movingTime: Double?,
    val distance: Double?,
    val elevationGain: Double?,
    val elevationLoss: Double?,
    val avgSpeed: Double?,
    val maxSpeed: Double?,
    val avgHr: Int?,
    val maxHr: Int?,
    val avgCadence: Double?,
    val maxCadence: Double?,
    val avgPower: Double?,
    val maxPower: Double?,
    val normalizedPower: Double?,
    val calories: Double?,
)

@Serializable
data class BestEffortSummary(
    val type: String,
    val value: Double,
    val overallRank: Int,
    val yearRank: Int,
)

@Serializable
data class BestEffortHistory(
    val sport: String,
    val type: String,
    val valueKind: String,
    val higherIsBetter: Boolean,
    val distance: Double? = null,
    val duration: Double? = null,
    val options: List<BestEffortOption> = emptyList(),
    val efforts: List<BestEffortHistoryEffort> = emptyList(),
)

@Serializable
data class BestEffortOption(
    val type: String,
    val valueKind: String,
)

@Serializable
data class BestEffortHistoryEffort(
    val activityId: String,
    val activityName: String?,
    val sport: String,
    val startedAt: String,
    val elapsedTime: Double,
    val value: Double,
    val overallRank: Int,
    val year: Int,
    val yearRank: Int,
)

@Serializable
data class Track(
    val type: String,
    val coordinates: List<List<Double>>,
)

@Serializable
data class ActivityPage(
    val activities: List<Activity>,
    val nextCursor: String?,
    val total: Int,
)

@Serializable
data class ActivityDetail(
    val id: String,
    val uploadId: String,
    val sport: String,
    val name: String?,
    val description: String?,
    val excludeFromRankings: Boolean,
    val tags: List<String> = emptyList(),
    val startedAt: String,
    val timezoneOffsetMinutes: Int?,
    val metrics: ActivityMetrics?,
    val createdAt: String,
    val updatedAt: String,
    val track: Track?,
    val analysis: ActivityAnalysis?,
    val bestEfforts: List<BestEffort>?,
    val matchedRouteCount: Int?,
    val images: List<ActivityImage> = emptyList(),
    val userId: String? = null,
    val athlete: SocialUser? = null,
    val likeCount: Int = 0,
    val commentCount: Int = 0,
    val viewerLiked: Boolean = false,
) {
    fun summary() =
        Activity(
            id = id,
            uploadId = uploadId,
            sport = sport,
            name = name,
            description = description,
            excludeFromRankings = excludeFromRankings,
            tags = tags,
            startedAt = startedAt,
            timezoneOffsetMinutes = timezoneOffsetMinutes,
            metrics = metrics,
            createdAt = createdAt,
            updatedAt = updatedAt,
            track = track,
            images = images,
            userId = userId,
            athlete = athlete,
            likeCount = likeCount,
            commentCount = commentCount,
            viewerLiked = viewerLiked,
        )
}

@Serializable
data class ActivityAnalysis(
    val splits: List<ActivitySplit>,
    val profile: List<ProfilePoint>,
    val route: List<RoutePoint>,
)

@Serializable
data class MatchedRouteHistory(
    val sourceActivityId: String,
    val activities: List<Activity>?,
)

@Serializable
data class ActivitySplit(
    val distance: Double,
    val elapsedTime: Double,
    val startTime: Double,
    val endTime: Double,
    val avgHr: Int?,
    val elevationChange: Double?,
)

@Serializable
data class ProfilePoint(
    val distance: Double,
    val time: Double,
    val altitude: Double,
    val heartRate: Int?,
)

@Serializable
data class RoutePoint(
    val time: Double,
    val coordinate: List<Double>,
)

@Serializable
data class BestEffort(
    val type: String,
    val value: Double,
    val distance: Double,
    val elapsedTime: Double,
    val startTime: Double,
    val endTime: Double,
    val avgHr: Int?,
    val elevationChange: Double?,
    val overallRank: Int,
    val year: Int,
    val yearRank: Int,
)

@Serializable
data class UploadResponse(
    val byteSize: Long,
    val queued: Boolean,
)
