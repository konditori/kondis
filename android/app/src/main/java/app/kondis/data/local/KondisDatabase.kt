package app.kondis.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [ActivityEntity::class, ActivityDetailEntity::class, QueuedWorkoutEntity::class],
    version = 2,
    exportSchema = true,
)
abstract class KondisDatabase : RoomDatabase() {
    abstract fun activityDao(): ActivityDao
}
