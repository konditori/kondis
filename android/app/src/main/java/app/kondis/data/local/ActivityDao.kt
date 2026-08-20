package app.kondis.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface ActivityDao {
    @Query(
        """
        SELECT * FROM activities
        WHERE accountKey = :accountKey
          AND (:query = '' OR searchableText LIKE '%' || :query || '%')
        ORDER BY startedAt DESC, id DESC
        LIMIT :limit
        """,
    )
    fun observeActivities(
        accountKey: String,
        query: String,
        limit: Int = 250,
    ): Flow<List<ActivityEntity>>

    @Query("SELECT * FROM activity_details WHERE accountKey = :accountKey AND id = :id")
    fun observeDetail(
        accountKey: String,
        id: String,
    ): Flow<ActivityDetailEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertActivities(activities: List<ActivityEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDetail(detail: ActivityDetailEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertQueuedWorkout(workout: QueuedWorkoutEntity)

    @Query("SELECT * FROM queued_workouts WHERE accountKey = :accountKey ORDER BY startedAt DESC")
    fun observeQueuedWorkouts(accountKey: String): Flow<List<QueuedWorkoutEntity>>

    @Query("SELECT * FROM queued_workouts WHERE accountKey = :accountKey ORDER BY startedAt ASC")
    suspend fun queuedWorkouts(accountKey: String): List<QueuedWorkoutEntity>

    @Query("UPDATE queued_workouts SET uploadStarted = 1 WHERE accountKey = :accountKey AND localActivityId = :id")
    suspend fun markUploadStarted(
        accountKey: String,
        id: String,
    )

    @Query("DELETE FROM queued_workouts WHERE accountKey = :accountKey AND localActivityId = :id")
    suspend fun deleteQueuedWorkout(
        accountKey: String,
        id: String,
    )

    @Query("DELETE FROM activities WHERE accountKey = :accountKey AND id = :id")
    suspend fun deleteActivity(
        accountKey: String,
        id: String,
    )

    @Query("DELETE FROM activity_details WHERE accountKey = :accountKey AND id = :id")
    suspend fun deleteDetail(
        accountKey: String,
        id: String,
    )

    @Query("DELETE FROM activities WHERE accountKey = :accountKey AND isLocal = 0")
    suspend fun clearRemoteActivities(accountKey: String)

    @Transaction
    suspend fun replaceActivities(
        accountKey: String,
        activities: List<ActivityEntity>,
    ) {
        clearRemoteActivities(accountKey)
        upsertActivities(activities)
    }

    @Transaction
    suspend fun saveQueuedWorkout(
        activity: ActivityEntity,
        detail: ActivityDetailEntity,
        workout: QueuedWorkoutEntity,
    ) {
        upsertActivities(listOf(activity))
        upsertDetail(detail)
        upsertQueuedWorkout(workout)
    }

    @Transaction
    suspend fun replaceQueuedWorkout(
        accountKey: String,
        localActivityId: String,
        activity: ActivityEntity,
        detail: ActivityDetailEntity,
    ) {
        upsertActivities(listOf(activity))
        upsertDetail(detail)
        upsertDetail(detail.copy(id = localActivityId))
        deleteActivity(accountKey, localActivityId)
        deleteQueuedWorkout(accountKey, localActivityId)
    }
}
