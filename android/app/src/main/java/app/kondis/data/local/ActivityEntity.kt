package app.kondis.data.local

import androidx.room.Entity

@Entity(tableName = "activities", primaryKeys = ["accountKey", "id"])
data class ActivityEntity(
    val accountKey: String,
    val id: String,
    val startedAt: String,
    val searchableText: String,
    val payload: String,
    val isLocal: Boolean = false,
)

@Entity(tableName = "activity_details", primaryKeys = ["accountKey", "id"])
data class ActivityDetailEntity(
    val accountKey: String,
    val id: String,
    val payload: String,
    val cachedAt: Long,
)

@Entity(tableName = "queued_workouts", primaryKeys = ["accountKey", "localActivityId"])
data class QueuedWorkoutEntity(
    val accountKey: String,
    val localActivityId: String,
    val gpxPath: String,
    val title: String,
    val startedAt: String,
    val uploadStarted: Boolean = false,
)
