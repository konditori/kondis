package app.kondis.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [ActivityEntity::class, ActivityDetailEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class KondisDatabase : RoomDatabase() {
    abstract fun activityDao(): ActivityDao
}
