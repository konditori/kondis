package app.kondis.recording

import android.content.Context
import android.util.AtomicFile
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
private data class StoredPoint(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double?,
    val recordedAt: String,
    val accuracyMeters: Float,
)

@Serializable
private data class StoredRecording(
    val mode: String,
    val startedAt: String?,
    val elapsedSeconds: Long,
    val distanceMeters: Double,
    val points: List<StoredPoint>,
    val errorMessage: String?,
    val activeSince: String?,
    val elapsedBeforeActive: Long,
)

data class RestoredRecording(
    val state: RecordingState,
    val activeSince: Instant?,
    val elapsedBeforeActive: Long,
)

interface RecordingPersistence {
    fun load(): RestoredRecording?

    fun save(
        state: RecordingState,
        activeSince: Instant?,
        elapsedBeforeActive: Long,
    )

    fun clear()
}

@Singleton
class RecordingStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
        private val json: Json,
    ) : RecordingPersistence {
        private val file = AtomicFile(File(context.filesDir, "recording/active.json"))

        override fun load(): RestoredRecording? =
            runCatching {
                val stored = json.decodeFromString<StoredRecording>(file.readFully().decodeToString())
                val mode = RecordingMode.entries.firstOrNull { it.name == stored.mode } ?: return null
                if (mode == RecordingMode.Idle || mode == RecordingMode.Saved) return null
                RestoredRecording(
                    state =
                        RecordingState(
                            mode = mode,
                            startedAt = stored.startedAt?.let(Instant::parse),
                            elapsedSeconds = stored.elapsedSeconds,
                            distanceMeters = stored.distanceMeters,
                            points =
                                stored.points.map {
                                    TrackPoint(
                                        latitude = it.latitude,
                                        longitude = it.longitude,
                                        altitude = it.altitude,
                                        recordedAt = Instant.parse(it.recordedAt),
                                        accuracyMeters = it.accuracyMeters,
                                    )
                                },
                            errorMessage = stored.errorMessage,
                        ),
                    activeSince = stored.activeSince?.let(Instant::parse),
                    elapsedBeforeActive = stored.elapsedBeforeActive,
                )
            }.getOrNull()

        override fun save(
            state: RecordingState,
            activeSince: Instant?,
            elapsedBeforeActive: Long,
        ) {
            file.baseFile.parentFile?.mkdirs()
            val stored =
                StoredRecording(
                    mode = state.mode.name,
                    startedAt = state.startedAt?.toString(),
                    elapsedSeconds = state.elapsedSeconds,
                    distanceMeters = state.distanceMeters,
                    points =
                        state.points.map {
                            StoredPoint(
                                latitude = it.latitude,
                                longitude = it.longitude,
                                altitude = it.altitude,
                                recordedAt = it.recordedAt.toString(),
                                accuracyMeters = it.accuracyMeters,
                            )
                        },
                    errorMessage = state.errorMessage,
                    activeSince = activeSince?.toString(),
                    elapsedBeforeActive = elapsedBeforeActive,
                )
            val output = file.startWrite()
            try {
                output.write(json.encodeToString(stored).encodeToByteArray())
                file.finishWrite(output)
            } catch (error: Exception) {
                file.failWrite(output)
                throw error
            }
        }

        override fun clear() = file.delete()
    }
