package app.kondis.data

import android.content.Context
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
class ActivityRepository
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
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

        fun queuedWorkouts(): Flow<List<QueuedWorkout>> =
            activityDao.observeQueuedWorkouts().map { workouts ->
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

        /** Stores the workout before any network request, so it cannot be lost while offline. */
        suspend fun queueRecordedWorkout(
            file: File,
            recording: RecordingState,
            sport: String,
            title: String,
        ): String {
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
                activity = toEntity(activity, isLocal = true),
                detail =
                    ActivityDetailEntity(
                        id = localId,
                        payload = json.encodeToString(ActivityDetail.serializer(), detail),
                        cachedAt = System.currentTimeMillis(),
                    ),
                workout =
                    QueuedWorkoutEntity(
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
            for (workout in activityDao.queuedWorkouts()) {
                if (!workout.uploadStarted) {
                    val file = File(workout.gpxPath)
                    if (!file.exists()) continue
                    try {
                        uploadGpx(file)
                        activityDao.markUploadStarted(workout.localActivityId)
                    } catch (_: Exception) {
                        return true
                    }
                }
                try {
                    val remoteId = findRecentlyUploadedActivity(workout.startedAt, workout.title) ?: continue
                    val detail = api().activity(remoteId)
                    activityDao.replaceQueuedWorkout(
                        localActivityId = workout.localActivityId,
                        activity = toEntity(detail.summary()),
                        detail =
                            ActivityDetailEntity(
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
            return activityDao.queuedWorkouts().isNotEmpty()
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

        private suspend fun api() = settingsRepository.settings.first().let { apiFactory.create(it.serverUrl, it.accessToken) }

        private fun toEntity(
            activity: Activity,
            isLocal: Boolean = false,
        ) = ActivityEntity(
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

private const val WORKOUT_SYNC_WORK_NAME = "queued-workout-sync"
