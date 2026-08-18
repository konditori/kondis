package app.kondis.di

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import app.kondis.BuildConfig
import app.kondis.data.local.ActivityDao
import app.kondis.data.local.KondisDatabase
import app.kondis.recording.RecordingPersistence
import app.kondis.recording.RecordingStore
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import javax.inject.Singleton

@dagger.Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideJson(): Json =
        Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            encodeDefaults = true
        }

    @Provides
    @Singleton
    fun provideHttpClient(): OkHttpClient =
        OkHttpClient
            .Builder()
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
                }
            }.build()

    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context,
    ): KondisDatabase =
        Room
            .databaseBuilder(context, KondisDatabase::class.java, "kondis.db")
            .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
            .build()

    @Provides
    fun provideActivityDao(database: KondisDatabase): ActivityDao = database.activityDao()

    @Provides
    @Singleton
    fun provideRecordingPersistence(store: RecordingStore): RecordingPersistence = store

    private val MIGRATION_1_2 =
        object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE activities ADD COLUMN isLocal INTEGER NOT NULL DEFAULT 0")
                db.execSQL(
                    """
                    CREATE TABLE IF NOT EXISTS queued_workouts (
                        localActivityId TEXT NOT NULL PRIMARY KEY,
                        gpxPath TEXT NOT NULL,
                        title TEXT NOT NULL,
                        startedAt TEXT NOT NULL,
                        uploadStarted INTEGER NOT NULL DEFAULT 0
                    )
                    """.trimIndent(),
                )
            }
        }

    private val MIGRATION_2_3 =
        object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Version 2 rows have no trustworthy destination account. They
                // are caches; discard them instead of risking a cross-account upload.
                db.execSQL("DROP TABLE queued_workouts")
                db.execSQL("DROP TABLE activity_details")
                db.execSQL("DROP TABLE activities")
                db.execSQL(
                    """
                    CREATE TABLE activities (
                        accountKey TEXT NOT NULL,
                        id TEXT NOT NULL,
                        startedAt TEXT NOT NULL,
                        searchableText TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        isLocal INTEGER NOT NULL,
                        PRIMARY KEY(accountKey, id)
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE TABLE activity_details (
                        accountKey TEXT NOT NULL,
                        id TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        cachedAt INTEGER NOT NULL,
                        PRIMARY KEY(accountKey, id)
                    )
                    """.trimIndent(),
                )
                db.execSQL(
                    """
                    CREATE TABLE queued_workouts (
                        accountKey TEXT NOT NULL,
                        localActivityId TEXT NOT NULL,
                        gpxPath TEXT NOT NULL,
                        title TEXT NOT NULL,
                        startedAt TEXT NOT NULL,
                        uploadStarted INTEGER NOT NULL,
                        PRIMARY KEY(accountKey, localActivityId)
                    )
                    """.trimIndent(),
                )
            }
        }
}
