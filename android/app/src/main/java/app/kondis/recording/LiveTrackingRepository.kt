package app.kondis.recording

import android.content.Context
import android.content.Intent
import app.kondis.data.remote.KondisApiFactory
import app.kondis.data.remote.LivePointRequest
import app.kondis.data.remote.LiveWorkoutCreateRequest
import app.kondis.data.remote.LiveWorkoutPointsRequest
import app.kondis.data.remote.LiveWorkoutStateRequest
import app.kondis.data.settings.SettingsRepository
import app.kondis.ui.i18n.tr
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LiveTrackingRepository
    @Inject
    constructor(
        @param:ApplicationContext private val context: Context,
        private val apiFactory: KondisApiFactory,
        private val settingsRepository: SettingsRepository,
    ) {
        private var session: Session? = null
        private var pendingStart: PendingStart? = null

        suspend fun start(
            sport: String,
            startedAt: java.time.Instant,
        ) {
            pendingStart = PendingStart(sport, startedAt)
            val settings = settingsRepository.settings.first()
            val response =
                apiFactory
                    .create(settings)
                    .createLiveWorkout(
                        LiveWorkoutCreateRequest(
                            clientSessionId = UUID.randomUUID().toString(),
                            sport = sport,
                            startedAt = startedAt.toString(),
                        ),
                    )
            session = Session(response.id, response.lastSequence, settings.serverUrl)
        }

        suspend fun sync(recording: RecordingState) {
            if (session == null) {
                val start = pendingStart ?: return
                start(start.sport, start.startedAt)
            }
            val current = session ?: return
            val pending = recording.points.drop(current.sentPointCount).take(MAX_BATCH_SIZE)
            if (pending.isEmpty()) return
            val settings = settingsRepository.settings.first()
            val response =
                apiFactory
                    .create(settings)
                    .uploadLivePoints(
                        current.id,
                        LiveWorkoutPointsRequest(
                            points =
                                pending.mapIndexed { index, point ->
                                    LivePointRequest(
                                        sequence = current.sentPointCount + index + 1,
                                        recordedAt = point.recordedAt.toString(),
                                        latitude = point.latitude,
                                        longitude = point.longitude,
                                        altitude = point.altitude,
                                        accuracyMeters = point.accuracyMeters,
                                    )
                                },
                            elapsedSeconds = recording.elapsedSeconds,
                            distanceMeters = recording.distanceMeters,
                        ),
                    )
            session = current.copy(sentPointCount = maxOf(current.sentPointCount + pending.size, response.lastSequence))
        }

        suspend fun updateState(
            status: String,
            recording: RecordingState,
        ) {
            sync(recording)
            val current = session ?: return
            val settings = settingsRepository.settings.first()
            apiFactory
                .create(settings)
                .updateLiveWorkout(
                    current.id,
                    LiveWorkoutStateRequest(status, recording.elapsedSeconds, recording.distanceMeters),
                )
        }

        suspend fun share(): Boolean {
            val current = session ?: return false
            val settings = settingsRepository.settings.first()
            val response = apiFactory.create(settings).createLiveWorkoutShare(current.id)
            val appUrl = settings.serverUrl.substringBefore("/api/v1").trimEnd('/')
            val shareIntent =
                Intent(Intent.ACTION_SEND)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, "$appUrl/live/${response.token}")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(
                Intent
                    .createChooser(
                        shareIntent,
                        context.tr("share_live_tracking"),
                    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            return true
        }

        suspend fun discard() {
            val current = session ?: return
            val settings = settingsRepository.settings.first()
            apiFactory.create(settings).discardLiveWorkout(current.id)
            session = null
            pendingStart = null
        }

        private data class Session(
            val id: String,
            val sentPointCount: Int,
            val serverUrl: String,
        )

        private data class PendingStart(
            val sport: String,
            val startedAt: java.time.Instant,
        )

        private companion object {
            const val MAX_BATCH_SIZE = 50
        }
    }
