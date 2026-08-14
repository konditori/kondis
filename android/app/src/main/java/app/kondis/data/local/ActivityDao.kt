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
        WHERE :query = '' OR searchableText LIKE '%' || :query || '%'
        ORDER BY startedAt DESC, id DESC
        LIMIT :limit
        """,
    )
    fun observeActivities(
        query: String,
        limit: Int = 250,
    ): Flow<List<ActivityEntity>>

    @Query("SELECT * FROM activity_details WHERE id = :id")
    fun observeDetail(id: String): Flow<ActivityDetailEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertActivities(activities: List<ActivityEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDetail(detail: ActivityDetailEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertQueuedWorkout(workout: QueuedWorkoutEntity)

    @Query("SELECT * FROM queued_workouts ORDER BY startedAt DESC")
    fun observeQueuedWorkouts(): Flow<List<QueuedWorkoutEntity>>

    @Query("SELECT * FROM queued_workouts ORDER BY startedAt ASC")
    suspend fun queuedWorkouts(): List<QueuedWorkoutEntity>

    @Query("UPDATE queued_workouts SET uploadStarted = 1 WHERE localActivityId = :id")
    suspend fun markUploadStarted(id: String)

    @Query("DELETE FROM queued_workouts WHERE localActivityId = :id")
    suspend fun deleteQueuedWorkout(id: String)

    @Query("DELETE FROM activities WHERE id = :id")
    suspend fun deleteActivity(id: String)

    @Query("DELETE FROM activity_details WHERE id = :id")
    suspend fun deleteDetail(id: String)

    @Query("DELETE FROM activities WHERE isLocal = 0")
    suspend fun clearRemoteActivities()

    @Transaction
    suspend fun replaceActivities(activities: List<ActivityEntity>) {
        clearRemoteActivities()
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
        localActivityId: String,
        activity: ActivityEntity,
        detail: ActivityDetailEntity,
    ) {
        deleteActivity(localActivityId)
        deleteDetail(localActivityId)
        deleteQueuedWorkout(localActivityId)
        upsertActivities(listOf(activity))
        upsertDetail(detail)
    }
}
