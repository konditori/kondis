package app.kondis.data.remote

import app.kondis.data.auth.ExternalAuthManager
import app.kondis.data.settings.SettingsRepository
import app.kondis.data.settings.AppSettings
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

data class RealtimeActivityEvent(
    val type: String,
    val activityId: String,
)

@Singleton
class ActivityEventClient
    @Inject
    constructor(
        private val apiFactory: KondisApiFactory,
        private val settingsRepository: SettingsRepository,
        private val externalAuthManager: ExternalAuthManager,
        private val httpClient: OkHttpClient,
        private val json: Json,
    ) {
        fun observe(activityId: String): Flow<RealtimeActivityEvent> =
            callbackFlow {
                val worker = launch(Dispatchers.IO) {
                    while (isActive) {
                        try {
                            val settings = settingsRepository.settings.first()
                            val ticket = apiFactory.create(settings).activityEventsTicket().token
                            val closed = CompletableDeferred<Unit>()
                            val request =
                                Request.Builder()
                                    .url(socketUrl(settings, ticket))
                                    .apply {
                                        settings.accessToken?.let { header("X-Kondis-Authorization", "Bearer $it") }
                                        externalAuthManager.freshAccessTokenOrNull()?.let { header("Authorization", "Bearer $it") }
                                    }.build()
                            val socket =
                                httpClient
                                    .newBuilder()
                                    .readTimeout(0, TimeUnit.MILLISECONDS)
                                    .build()
                                    .newWebSocket(
                                        request,
                                        object : WebSocketListener() {
                                            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                                                webSocket.send("{\"type\":\"activity.subscribe\",\"activityId\":\"$activityId\"}")
                                            }

                                            override fun onMessage(webSocket: WebSocket, text: String) {
                                                parse(text)?.let { trySend(it) }
                                            }

                                            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                                                closed.complete(Unit)
                                            }

                                            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                                                closed.complete(Unit)
                                            }
                                        },
                                    )
                            closed.await()
                            socket.close(1000, "Reconnect")
                        } catch (_: Throwable) {
                            // Retry below; an offline client should not fail the activity screen.
                        }
                        delay(1_000)
                    }
                }
                awaitClose { worker.cancel() }
            }

        private fun parse(payload: String): RealtimeActivityEvent? =
            runCatching {
                val root = json.parseToJsonElement(payload).jsonObject
                val type = root["type"]?.jsonPrimitive?.content ?: return null
                val id = root["activity"]?.jsonObject?.get("id")?.jsonPrimitive?.content ?: return null
                if (type in setOf("activity.updated", "activity.comment.created", "activity.like.updated")) {
                    RealtimeActivityEvent(type, id)
                } else {
                    null
                }
            }.getOrNull()

        private fun socketUrl(settings: AppSettings, ticket: String): String {
            val base = settings.serverUrl.toHttpUrlOrThrow()
            return base
                .newBuilder()
                .scheme(if (base.scheme == "https") "wss" else "ws")
                .addPathSegment("events")
                .addQueryParameter("ticket", ticket)
                .build()
                .toString()
        }
    }

private fun String.toHttpUrlOrThrow(): okhttp3.HttpUrl =
    toHttpUrlOrNull() ?: error("Invalid server URL")
