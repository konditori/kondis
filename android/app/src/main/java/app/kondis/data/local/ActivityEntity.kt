package app.kondis.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "activities")
data class ActivityEntity(
    @PrimaryKey val id: String,
    val startedAt: String,
    val searchableText: String,
    val payload: String,
)

@Entity(tableName = "activity_details")
data class ActivityDetailEntity(
    @PrimaryKey val id: String,
    val payload: String,
    val cachedAt: Long,
)

