package app.kondis.di

import android.content.Context
import androidx.room.Room
import app.kondis.BuildConfig
import app.kondis.data.local.ActivityDao
import app.kondis.data.local.KondisDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    @Provides
    @Singleton
    fun provideHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            }
        }
        .build()

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): KondisDatabase = Room
        .databaseBuilder(context, KondisDatabase::class.java, "kondis.db")
        .build()

    @Provides
    fun provideActivityDao(database: KondisDatabase): ActivityDao = database.activityDao()
}

