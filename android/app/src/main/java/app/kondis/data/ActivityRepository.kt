package app.kondis.data

import app.kondis.data.local.ActivityDao
import app.kondis.data.local.ActivityDetailEntity
import app.kondis.data.local.ActivityEntity
import app.kondis.data.remote.KondisApiFactory
import app.kondis.data.settings.SettingsRepository
import app.kondis.model.Activity
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityUpdate
import app.kondis.model.BestEffortHistory
import app.kondis.model.MatchedRouteHistory
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.time.Duration
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

data class PageResult(
    val nextCursor: String?,
    val total: Int,
)

@Singleton
class ActivityRepository
    @Inject
    constructor(
        private val activityDao: ActivityDao,
        private val apiFactory: KondisApiFactory,
        private val settingsRepository: SettingsRepository,
        private val json: Json,
    ) {
        fun activities(search: String): Flow<List<Activity>> =
            activityDao
                .observeActivities(search.trim().lowercase())
                .map { rows -> rows.mapNotNull { row -> decodeActivity(row.payload) } }

        fun detail(id: String): Flow<ActivityDetail?> =
            activityDao
                .observeDetail(id)
                .map { row -> row?.let { decodeDetail(it.payload) } }

        suspend fun refresh(search: String = ""): PageResult {
            val response = api().activities(search = search.trim().ifBlank { null })
            if (search.isBlank()) {
                activityDao.replaceActivities(response.activities.map(::toEntity))
            } else {
                activityDao.upsertActivities(response.activities.map(::toEntity))
            }
            return PageResult(response.nextCursor, response.total)
        }

        suspend fun loadMore(
            cursor: String,
            search: String = "",
        ): PageResult {
            val response = api().activities(cursor = cursor, search = search.trim().ifBlank { null })
            activityDao.upsertActivities(response.activities.map(::toEntity))
            return PageResult(response.nextCursor, response.total)
        }

        suspend fun refreshDetail(id: String) {
            val detail = api().activity(id)
            activityDao.upsertActivities(listOf(toEntity(detail.summary())))
            activityDao.upsertDetail(
                ActivityDetailEntity(
                    id = detail.id,
                    payload = json.encodeToString(ActivityDetail.serializer(), detail),
                    cachedAt = System.currentTimeMillis(),
                ),
            )
        }

        suspend fun updateActivity(
            id: String,
            update: ActivityUpdate,
        ) {
            api().updateActivity(id, update)
            refreshDetail(id)
        }

        suspend fun deleteActivity(id: String) {
            api().deleteActivity(id)
            activityDao.deleteActivity(id)
            activityDao.deleteDetail(id)
        }

        suspend fun matchedRoutes(id: String): MatchedRouteHistory = api().matchedRoutes(id)

        suspend fun bestEfforts(
            sport: String,
            type: String,
        ): BestEffortHistory = api().bestEfforts(sport, type)

        suspend fun uploadGpx(file: File) {
            val request = file.asRequestBody("application/gpx+xml".toMediaType())
            api().uploadActivity(MultipartBody.Part.createFormData("file", file.name, request))
        }

        suspend fun findRecentlyUploadedActivity(
            startedAt: String,
            title: String,
        ): String? {
            val expected = runCatching { Instant.parse(startedAt) }.getOrNull() ?: return null
            repeat(20) { attempt ->
                val activities = api().activities(limit = 50).activities
                val match =
                    activities
                        .filter { activity ->
                            val actual =
                                runCatching { Instant.parse(activity.startedAt) }.getOrNull() ?: return@filter false
                            Duration.between(expected, actual).abs().seconds <= 120 &&
                                (activity.name == title || activity.name == null)
                        }.minByOrNull { activity ->
                            Duration.between(expected, Instant.parse(activity.startedAt)).abs().toMillis()
                        }
                if (match != null) return match.id
                if (attempt < 19) delay(1_000)
            }
            return null
        }

        suspend fun checkConnection() {
            api().activities(limit = 1)
        }

        private suspend fun api() = apiFactory.create(settingsRepository.settings.first().serverUrl)

        private fun toEntity(activity: Activity) =
            ActivityEntity(
                id = activity.id,
                startedAt = activity.startedAt,
                searchableText =
                    listOf(activity.name, activity.description, activity.sport)
                        .filterNotNull()
                        .joinToString(" ")
                        .lowercase(),
                payload = json.encodeToString(Activity.serializer(), activity),
            )

        private fun decodeActivity(payload: String): Activity? =
            runCatching {
                json.decodeFromString(Activity.serializer(), payload)
            }.getOrNull()

        private fun decodeDetail(payload: String): ActivityDetail? =
            runCatching {
                json.decodeFromString(ActivityDetail.serializer(), payload)
            }.getOrNull()
    }
