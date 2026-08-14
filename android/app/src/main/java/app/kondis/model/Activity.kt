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
    val startedAt: String,
    val timezoneOffsetMinutes: Int?,
    val metrics: ActivityMetrics?,
    val createdAt: String,
    val updatedAt: String,
    val topBestEfforts: List<BestEffortSummary>? = null,
    val track: Track? = null,
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
    val overallRank: Int,
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
    val startedAt: String,
    val timezoneOffsetMinutes: Int?,
    val metrics: ActivityMetrics?,
    val createdAt: String,
    val updatedAt: String,
    val track: Track?,
    val analysis: ActivityAnalysis?,
    val bestEfforts: List<BestEffort>?,
    val matchedRouteCount: Int?,
) {
    fun summary() =
        Activity(
            id = id,
            uploadId = uploadId,
            sport = sport,
            name = name,
            description = description,
            excludeFromRankings = excludeFromRankings,
            startedAt = startedAt,
            timezoneOffsetMinutes = timezoneOffsetMinutes,
            metrics = metrics,
            createdAt = createdAt,
            updatedAt = updatedAt,
            track = track,
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
