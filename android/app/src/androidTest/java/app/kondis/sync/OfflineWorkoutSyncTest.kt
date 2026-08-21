package app.kondis.sync

import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until
import app.kondis.MainActivity
import app.kondis.data.auth.SecureSessionStore
import app.kondis.data.local.ActivityDao
import app.kondis.data.local.ActivityDaoEntryPoint
import app.kondis.data.local.ActivityDetailEntity
import app.kondis.data.local.ActivityEntity
import app.kondis.data.local.QueuedWorkoutEntity
import app.kondis.data.settings.SettingsRepository
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.runBlocking
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import okhttp3.Headers
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.time.Instant
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class OfflineWorkoutSyncTest {
    private val device by lazy { UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()) }

    private lateinit var server: MockWebServer
    private lateinit var activityDao: ActivityDao
    private lateinit var scenario: ActivityScenario<MainActivity>
    private val remoteId = "remote-sync-test-activity"
    private val deleteId = "zzzz-remote-delete-test-activity"
    private val startedAt = Instant.now().toString()
    private lateinit var accountKey: String

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        server = MockWebServer()
        server.dispatcher = apiDispatcher()
        server.start()
        val serverUrl = server.url("/").toString().trimEnd('/')
        accountKey = "$serverUrl|offline-sync-test-user"
        runBlocking {
            SettingsRepository(context, SecureSessionStore(context)).apply {
                setServerUrl(serverUrl)
                setAccessToken("offline-sync-test-token")
                setAccountId("offline-sync-test-user")
            }
        }

        activityDao =
            EntryPointAccessors
                .fromApplication(context, ActivityDaoEntryPoint::class.java)
                .activityDao()
        val file =
            File(context.filesDir, "recordings/sync-test.gpx").apply {
                parentFile?.mkdirs()
                writeText("<gpx version=\"1.1\"><trk><trkseg><trkpt lat=\"57.7\" lon=\"11.9\"/></trkseg></trk></gpx>")
            }
        runBlocking {
            activityDao.saveQueuedWorkout(
                activity = localActivityEntity(),
                detail = localDetailEntity(),
                workout =
                    QueuedWorkoutEntity(
                        accountKey,
                        "local-sync-test",
                        file.absolutePath,
                        "Offline test run",
                        startedAt,
                    ),
            )
            activityDao.upsertActivities(listOf(remoteActivityEntity()))
            activityDao.upsertDetail(
                ActivityDetailEntity(accountKey, deleteId, deleteDetailJson(), System.currentTimeMillis()),
            )
        }
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After
    fun tearDown() {
        if (::scenario.isInitialized) scenario.close()
        server.close()
    }

    @Test
    fun queuedWorkoutSurvivesInLocalFeedAndSyncsToServer() {
        check(device.wait(Until.hasObject(By.res("sync-now")), 30_000)) {
            "Sync button did not appear; server requests=${server.requestCount}"
        }
        check(scrollToActivity("local-sync-test")) {
            "Local activity card did not appear; server requests=${server.requestCount}"
        }
        scrollToActivity("local-sync-test", beginning = true)

        check(device.wait(Until.hasObject(By.res("sync-now")), 5_000)) {
            "Sync button disappeared after returning to the beginning of the feed"
        }
        device.findObject(By.res("sync-now")).click()
        check(device.wait(Until.hasObject(By.res("sync-complete")), 45_000)) {
            "Sync did not complete; server requests=${server.requestCount}"
        }

        var upload: RecordedRequest? = null
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (upload == null && System.nanoTime() < deadline) {
            val request = server.takeRequest(1, TimeUnit.SECONDS) ?: continue
            if (request.method == "POST" && request.url.encodedPath == "/api/v1/upload/activity") upload = request
        }
        check(upload != null) { "No upload request received" }
        check(device.hasObject(By.res("sync-complete"))) {
            "Sync completion indicator disappeared; server requests=${server.requestCount}"
        }

        runBlocking { check(activityDao.queuedWorkouts(accountKey).isEmpty()) }
    }

    @Test
    fun deletingActivityReturnsToFeed() {
        val uiDevice = device
        check(uiDevice.wait(Until.hasObject(By.res("sync-now")), 30_000)) {
            "Sync button did not appear; server requests=${server.requestCount}"
        }
        check(scrollToActivity(deleteId)) {
            "Delete activity card was not found after scrolling; server requests=${server.requestCount}"
        }
        val deleteActivity = device.findObject(By.res("activity-card-$deleteId"))
        val deleteActivityBounds = deleteActivity.visibleBounds
        device.click(deleteActivityBounds.centerX(), deleteActivityBounds.centerY())
        check(device.wait(Until.hasObject(By.res("activity-more-options")), 5_000))
        device.findObject(By.res("activity-more-options")).click()
        val editMenuItem = By.res("activity-edit")
        val editMenuText = By.text("Edit")
        check(
            device.wait(Until.hasObject(editMenuItem), 5_000) ||
                device.wait(Until.hasObject(editMenuText), 5_000),
        ) {
            "Activity options menu did not show edit action"
        }
        device.findObject(if (device.hasObject(editMenuItem)) editMenuItem else editMenuText).click()
        check(UiScrollable(UiSelector().scrollable(true)).scrollIntoView(UiSelector().resourceId("activity-editor")))
        check(device.wait(Until.hasObject(By.res("activity-editor")), 5_000))
        UiScrollable(UiSelector().scrollable(true)).scrollToEnd(5)
        check(
            UiScrollable(UiSelector().scrollable(true)).scrollIntoView(
                UiSelector().resourceId("activity-delete"),
            ),
        )
        check(device.wait(Until.hasObject(By.res("activity-delete")), 5_000))
        device.findObject(By.res("activity-delete")).click()
        check(device.wait(Until.hasObject(By.res("delete-activity-dialog")), 5_000))

        device.findObject(By.res("delete-activity-confirm")).click()
        check(device.wait(Until.gone(By.res("delete-activity-dialog")), 10_000))
        check(device.wait(Until.hasObject(By.res("activities-feed")), 10_000))

        var deleteRequest: RecordedRequest? = null
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
        while (deleteRequest == null && System.nanoTime() < deadline) {
            val request = server.takeRequest(1, TimeUnit.SECONDS) ?: continue
            if (request.method == "DELETE" && request.url.encodedPath == "/api/v1/activities/$deleteId") {
                deleteRequest = request
            }
        }
        check(deleteRequest != null) { "No delete request received" }
    }

    private fun scrollToActivity(
        id: String,
        beginning: Boolean = false,
    ): Boolean {
        val selector = By.res("activity-card-$id")
        val scrollable = UiScrollable(UiSelector().resourceId("activities-list"))
        if (beginning) scrollable.scrollToBeginning(10)
        repeat(30) {
            if (device.wait(Until.hasObject(selector), 1_000)) return true
            if (scrollable.scrollIntoView(UiSelector().resourceId("activity-card-$id"))) return true
        }
        return device.hasObject(selector)
    }

    private fun apiDispatcher() =
        object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse =
                when {
                    request.method == "GET" && request.url.encodedPath == "/api/v1/auth/me" -> {
                        response(
                            200,
                            "{\"id\":\"offline-sync-test-user\",\"email\":\"test@example.com\",\"name\":\"Offline Test\",\"role\":\"user\"}",
                        )
                    }

                    request.method == "POST" && request.url.encodedPath == "/api/v1/upload/activity" -> {
                        response(201, "{\"byteSize\":128,\"queued\":true}")
                    }

                    request.method == "PUT" && request.url.encodedPath == "/api/v1/activities/$remoteId" -> {
                        response(200, activityJson(remoteId, "Offline test run", startedAt, startedAt))
                    }

                    request.method == "DELETE" && request.url.encodedPath == "/api/v1/activities/$deleteId" -> {
                        response(204, "")
                    }

                    request.method == "GET" && request.url.query == "limit=20" -> {
                        response(200, activityPageJson())
                    }

                    request.method == "GET" && request.url.query == "limit=50" -> {
                        response(200, activityPageJson())
                    }

                    request.method == "GET" && request.url.encodedPath == "/api/v1/activities/$remoteId" -> {
                        response(200, activityDetailJson())
                    }

                    request.method == "GET" && request.url.encodedPath == "/api/v1/activities/$deleteId" -> {
                        response(200, deleteDetailJson())
                    }

                    else -> {
                        response(404, "")
                    }
                }
        }

    private fun response(
        code: Int,
        body: String,
    ) = MockResponse(code, Headers.Builder().build(), body)

    private fun localActivityEntity() =
        ActivityEntity(
            accountKey = accountKey,
            id = "local-sync-test",
            startedAt = startedAt,
            searchableText = "offline test run run",
            payload = localActivityJson(),
            isLocal = true,
        )

    private fun localDetailEntity() =
        ActivityDetailEntity(accountKey, "local-sync-test", localDetailJson(), System.currentTimeMillis())

    private fun localActivityJson() =
        activityJson(
            id = "local-sync-test",
            name = "Offline test run",
            createdAt = startedAt,
            updatedAt = startedAt,
        )

    private fun localDetailJson() = activityDetailJson("local-sync-test", "Offline test run")

    private fun activityPageJson() =
        """{"activities":[${activityJson(
            remoteId,
            "Offline test run",
            startedAt,
            startedAt,
        )},${activityJson(
            deleteId,
            "Delete test run",
            startedAt,
            startedAt,
        )}],"nextCursor":null,"total":2}"""

    private fun remoteActivityEntity() =
        ActivityEntity(
            accountKey = accountKey,
            id = deleteId,
            startedAt = startedAt,
            searchableText = "delete test run run",
            payload = activityJson(deleteId, "Delete test run", startedAt, startedAt),
            isLocal = false,
        )

    private fun deleteDetailJson() = activityDetailJson(deleteId, "Delete test run")

    private fun activityDetailJson(
        id: String = remoteId,
        name: String = "Offline test run",
    ) =
        """{"id":"$id","uploadId":"$id","sport":"run","name":"$name","description":null,"excludeFromRankings":false,"startedAt":"$startedAt","timezoneOffsetMinutes":0,"metrics":{"elapsedTime":60.0,"movingTime":60.0,"distance":1000.0,"elevationGain":null,"elevationLoss":null,"avgSpeed":16.6,"maxSpeed":null,"avgHr":null,"maxHr":null,"avgCadence":null,"maxCadence":null,"avgPower":null,"maxPower":null,"normalizedPower":null,"calories":null},"createdAt":"$startedAt","updatedAt":"$startedAt","track":{"type":"LineString","coordinates":[[11.9,57.7],[11.91,57.71]]},"analysis":null,"bestEfforts":null,"matchedRouteCount":null}"""

    private fun activityJson(
        id: String,
        name: String,
        createdAt: String,
        updatedAt: String,
    ) =
        """{"id":"$id","uploadId":"$id","sport":"run","name":"$name","description":null,"excludeFromRankings":false,"startedAt":"$startedAt","timezoneOffsetMinutes":0,"metrics":{"elapsedTime":60.0,"movingTime":60.0,"distance":1000.0,"elevationGain":null,"elevationLoss":null,"avgSpeed":16.6,"maxSpeed":null,"avgHr":null,"maxHr":null,"avgCadence":null,"maxCadence":null,"avgPower":null,"maxPower":null,"normalizedPower":null,"calories":null},"createdAt":"$createdAt","updatedAt":"$updatedAt","topBestEfforts":null,"track":{"type":"LineString","coordinates":[[11.9,57.7],[11.91,57.71]]}}"""
}
