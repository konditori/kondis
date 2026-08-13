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
    fun observeActivities(query: String, limit: Int = 250): Flow<List<ActivityEntity>>

    @Query("SELECT * FROM activity_details WHERE id = :id")
    fun observeDetail(id: String): Flow<ActivityDetailEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertActivities(activities: List<ActivityEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDetail(detail: ActivityDetailEntity)

    @Query("DELETE FROM activities")
    suspend fun clearActivities()

    @Transaction
    suspend fun replaceActivities(activities: List<ActivityEntity>) {
        clearActivities()
        upsertActivities(activities)
    }
}

