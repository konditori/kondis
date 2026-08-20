package app.kondis.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import app.kondis.data.local.ActivityDao
import app.kondis.data.local.ActivityDetailEntity
import app.kondis.data.local.ActivityEntity
import app.kondis.data.local.QueuedWorkoutEntity
import app.kondis.data.remote.KondisApiFactory
import app.kondis.data.settings.AppSettings
import app.kondis.data.settings.SettingsRepository
import app.kondis.model.Activity
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityMetrics
import app.kondis.model.ActivityUpdate
import app.kondis.model.BestEffortHistory
import app.kondis.model.MatchedRouteHistory
import app.kondis.model.Track
import app.kondis.recording.RecordingState
import app.kondis.sync.WorkoutSyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

data class PageResult(
    val nextCursor: String?,
    val total: Int,
)

data class QueuedWorkout(
    val localActivityId: String,
    val title: String,
    val startedAt: String,
    val waitingForServer: Boolean,
)

@Singleton
@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class ActivityRepository
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val activityDao: ActivityDao,
        private val apiFactory: KondisApiFactory,
        private val settingsRepository: SettingsRepository,
        private val json: Json,
    ) {
        private companion object {
            const val FEED_PAGE_SIZE = 20
        }

        fun activities(search: String): Flow<List<Activity>> =
            settingsRepository.settings
                .flatMapLatest { settings ->
                    settings.accountKey?.let { activityDao.observeActivities(it, search.trim().lowercase()) }
                        ?: flowOf(emptyList())
                }.map { rows -> rows.mapNotNull { row -> decodeActivity(row.payload) } }

        fun detail(id: String): Flow<ActivityDetail?> =
            settingsRepository.settings
                .flatMapLatest { settings ->
                    settings.accountKey?.let { activityDao.observeDetail(it, id) } ?: flowOf(null)
                }.map { row -> row?.let { decodeDetail(it.payload) } }

        fun queuedWorkouts(): Flow<List<QueuedWorkout>> =
            settingsRepository.settings
                .flatMapLatest { settings ->
                    settings.accountKey?.let(activityDao::observeQueuedWorkouts) ?: flowOf(emptyList())
                }.map { workouts ->
                    workouts.map {
                        QueuedWorkout(
                            localActivityId = it.localActivityId,
                            title = it.title,
                            startedAt = it.startedAt,
                            waitingForServer = it.uploadStarted,
                        )
                    }
                }

        suspend fun refresh(search: String = ""): PageResult {
            val account = account()
            val response = api(account.settings).feed(limit = FEED_PAGE_SIZE, search = search.trim().ifBlank { null })
            if (search.isBlank()) {
                activityDao.replaceActivities(account.key, response.activities.map { toEntity(it, account.key) })
            } else {
                activityDao.upsertActivities(response.activities.map { toEntity(it, account.key) })
            }
            return PageResult(response.nextCursor, response.total)
        }

        suspend fun loadMore(
            cursor: String,
            search: String = "",
        ): PageResult {
            val account = account()
            val response =
                api(
                    account.settings,
                ).feed(
                    cursor = cursor,
                    limit = FEED_PAGE_SIZE,
                    search =
                        search.trim().ifBlank {
                            null
                        },
                )
            activityDao.upsertActivities(response.activities.map { toEntity(it, account.key) })
            return PageResult(response.nextCursor, response.total)
        }

        suspend fun refreshDetail(id: String) {
            val account = account()
            val detail = api(account.settings).activity(id)
            activityDao.upsertActivities(listOf(toEntity(detail.summary(), account.key)))
            activityDao.upsertDetail(
                ActivityDetailEntity(
                    accountKey = account.key,
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
            val account = account()
            api(account.settings).deleteActivity(id)
            activityDao.deleteActivity(account.key, id)
            activityDao.deleteDetail(account.key, id)
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

        suspend fun uploadImages(
            activityId: String,
            uris: List<Uri>,
        ) {
            for (uri in uris) {
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: continue
                val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                val body = bytes.toRequestBody(mimeType.toMediaType())
                val name = uri.lastPathSegment ?: "photo.jpg"
                api().uploadActivityImage(activityId, MultipartBody.Part.createFormData("file", name, body))
            }
            refreshDetail(activityId)
        }

        suspend fun loadActivityImage(path: String): Bitmap? {
            val settings = settingsRepository.settings.first()
            val url = URI(settings.serverUrl).resolve(path).toString()
            return runCatching {
                withContext(Dispatchers.IO) {
                    apiFactory.create(settings).activityImage(url).use { body ->
                        val bytes = body.bytes()
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    }
                }
            }.onFailure { error ->
                Log.w("Kondis", "Unable to load activity image $url", error)
            }.getOrNull()
        }

        /** Stores the workout before any network request, so it cannot be lost while offline. */
        suspend fun queueRecordedWorkout(
            file: File,
            recording: RecordingState,
            sport: String,
            title: String,
        ): String {
            val account = account()
            val localId = "local-${UUID.randomUUID()}"
            val startedAt = recording.startedAt ?: Instant.now()
            val savedAt = Instant.now()
            val activity =
                Activity(
                    id = localId,
                    uploadId = localId,
                    sport = sport,
                    name = title.ifBlank { null },
                    description = null,
                    excludeFromRankings = false,
                    startedAt = startedAt.toString(),
                    timezoneOffsetMinutes =
                        java.util.TimeZone
                            .getDefault()
                            .getOffset(startedAt.toEpochMilli()) / 60_000,
                    metrics = localMetrics(recording),
                    createdAt = savedAt.toString(),
                    updatedAt = savedAt.toString(),
                    track = Track("LineString", recording.points.map { listOf(it.longitude, it.latitude) }),
                )
            val detail =
                ActivityDetail(
                    id = activity.id,
                    uploadId = activity.uploadId,
                    sport = activity.sport,
                    name = activity.name,
                    description = null,
                    excludeFromRankings = false,
                    startedAt = activity.startedAt,
                    timezoneOffsetMinutes = activity.timezoneOffsetMinutes,
                    metrics = activity.metrics,
                    createdAt = activity.createdAt,
                    updatedAt = activity.updatedAt,
                    track = activity.track,
                    analysis = null,
                    bestEfforts = null,
                    matchedRouteCount = null,
                )
            activityDao.saveQueuedWorkout(
                activity = toEntity(activity, account.key, isLocal = true),
                detail =
                    ActivityDetailEntity(
                        accountKey = account.key,
                        id = localId,
                        payload = json.encodeToString(ActivityDetail.serializer(), detail),
                        cachedAt = System.currentTimeMillis(),
                    ),
                workout =
                    QueuedWorkoutEntity(
                        accountKey = account.key,
                        localActivityId = localId,
                        gpxPath = file.absolutePath,
                        title = title,
                        startedAt = activity.startedAt,
                    ),
            )
            requestQueuedWorkoutSync()
            return localId
        }

        fun requestQueuedWorkoutSync() {
            val request =
                OneTimeWorkRequestBuilder<WorkoutSyncWorker>()
                    .setConstraints(Constraints(requiredNetworkType = NetworkType.CONNECTED))
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, java.time.Duration.ofSeconds(30))
                    .build()
            WorkManager
                .getInstance(context)
                .enqueueUniqueWork(WORKOUT_SYNC_WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }

        /** Returns true while a workout remains queued, allowing WorkManager to retry later. */
        suspend fun syncQueuedWorkouts(): Boolean {
            val account = accountOrNull() ?: return false
            for (workout in activityDao.queuedWorkouts(account.key)) {
                if (!workout.uploadStarted) {
                    val file = File(workout.gpxPath)
                    if (!file.exists()) continue
                    try {
                        uploadGpx(file, account.settings)
                        activityDao.markUploadStarted(account.key, workout.localActivityId)
                    } catch (_: Exception) {
                        return true
                    }
                }
                try {
                    val remoteId =
                        findRecentlyUploadedActivity(workout.startedAt, workout.title, account.settings) ?: continue
                    val detail = api(account.settings).activity(remoteId)
                    activityDao.replaceQueuedWorkout(
                        accountKey = account.key,
                        localActivityId = workout.localActivityId,
                        activity = toEntity(detail.summary(), account.key),
                        detail =
                            ActivityDetailEntity(
                                accountKey = account.key,
                                id = detail.id,
                                payload = json.encodeToString(ActivityDetail.serializer(), detail),
                                cachedAt = System.currentTimeMillis(),
                            ),
                    )
                    File(workout.gpxPath).delete()
                } catch (_: Exception) {
                    return true
                }
            }
            return activityDao.queuedWorkouts(account.key).isNotEmpty()
        }

        suspend fun findRecentlyUploadedActivity(
            startedAt: String,
            title: String,
        ): String? = findRecentlyUploadedActivity(startedAt, title, account().settings)

        private suspend fun findRecentlyUploadedActivity(
            startedAt: String,
            title: String,
            settings: AppSettings,
        ): String? {
            val expected = runCatching { Instant.parse(startedAt) }.getOrNull() ?: return null
            repeat(20) { attempt ->
                val activities = api(settings).activities(limit = 50).activities
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

        private suspend fun account(): AccountScope = accountOrNull() ?: error("Sign in before accessing account data")

        private suspend fun accountOrNull(): AccountScope? {
            val settings = settingsRepository.settings.first()
            val key = settings.accountKey ?: return null
            if (settings.accessToken == null) return null
            return AccountScope(key, settings)
        }

        private suspend fun api() = api(account().settings)

        private suspend fun api(settings: AppSettings) = apiFactory.create(settings)

        private suspend fun uploadGpx(
            file: File,
            settings: AppSettings,
        ) {
            val request = file.asRequestBody("application/gpx+xml".toMediaType())
            api(settings).uploadActivity(MultipartBody.Part.createFormData("file", file.name, request))
        }

        private fun toEntity(
            activity: Activity,
            accountKey: String,
            isLocal: Boolean = false,
        ) = ActivityEntity(
            accountKey = accountKey,
            id = activity.id,
            startedAt = activity.startedAt,
            searchableText =
                listOf(activity.name, activity.description, activity.sport)
                    .filterNotNull()
                    .joinToString(" ")
                    .lowercase(),
            payload = json.encodeToString(Activity.serializer(), activity),
            isLocal = isLocal,
        )

        private fun localMetrics(recording: RecordingState): ActivityMetrics {
            val elapsed = recording.elapsedSeconds.toDouble()
            val elevations = recording.points.mapNotNull { it.altitude }
            val elevationGain = elevations.zipWithNext().sumOf { (from, to) -> (to - from).coerceAtLeast(0.0) }
            val elevationLoss = elevations.zipWithNext().sumOf { (from, to) -> (from - to).coerceAtLeast(0.0) }
            return ActivityMetrics(
                elapsedTime = elapsed,
                movingTime = elapsed,
                distance = recording.distanceMeters,
                elevationGain = elevationGain.takeIf { elevations.size > 1 },
                elevationLoss = elevationLoss.takeIf { elevations.size > 1 },
                avgSpeed = if (elapsed > 0) recording.distanceMeters / elapsed else null,
                maxSpeed = null,
                avgHr = null,
                maxHr = null,
                avgCadence = null,
                maxCadence = null,
                avgPower = null,
                maxPower = null,
                normalizedPower = null,
                calories = null,
            )
        }

        private fun decodeActivity(payload: String): Activity? =
            runCatching {
                json.decodeFromString(Activity.serializer(), payload)
            }.getOrNull()

        private fun decodeDetail(payload: String): ActivityDetail? =
            runCatching {
                json.decodeFromString(ActivityDetail.serializer(), payload)
            }.getOrNull()
    }

private data class AccountScope(
    val key: String,
    val settings: AppSettings,
)

private const val WORKOUT_SYNC_WORK_NAME = "queued-workout-sync"
