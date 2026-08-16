package app.kondis.ui.detail

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityImage
import app.kondis.model.ActivityMetrics
import app.kondis.model.Track
import app.kondis.model.UnitSystem
import app.kondis.ui.theme.KondisTheme
import org.junit.Rule
import org.junit.Test

class ActivityPhotoViewerTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun opensAndSwipesBetweenPhotos() {
        setScreen()

        composeRule.onNodeWithContentDescription("Open activity photos").performClick()
        composeRule.onNodeWithContentDescription("Photo 1 of 2").assertIsDisplayed()

        composeRule.onNodeWithContentDescription("Photo 1 of 2").performTouchInput { swipeLeft() }
        composeRule.onNodeWithContentDescription("Photo 2 of 2").assertIsDisplayed()
    }

    @Test
    fun closeButtonDismissesPhotoViewer() {
        setScreen()

        composeRule.onNodeWithContentDescription("Open activity photos").performClick()
        composeRule.onNodeWithContentDescription("Close photos").performClick()

        composeRule.onAllNodesWithContentDescription("Close photos").assertCountEquals(0)
        composeRule.onNodeWithContentDescription("Open activity photos").assertIsDisplayed()
    }

    @Test
    fun miniMapReturnsToActivity() {
        setScreen()

        composeRule.onNodeWithContentDescription("Open activity photos").performClick()
        composeRule.onNodeWithContentDescription("Return to activity").assertIsDisplayed().performClick()

        composeRule.onAllNodesWithContentDescription("Close photos").assertCountEquals(0)
        composeRule.onNodeWithContentDescription("Open activity photos").assertIsDisplayed()
    }

    private fun setScreen() {
        composeRule.setContent {
            KondisTheme {
                ActivityDetailScreen(
                    state = DetailUiState(activity = testActivity()),
                    units = UnitSystem.Metric,
                    onBack = {},
                    onMatchedRoutes = {},
                    onBestEfforts = { _, _ -> },
                    onDeleted = {},
                    onUpdate = {},
                    onDelete = {},
                    onRefresh = {},
                    onAddImages = {},
                    onLoadImage = { null },
                )
            }
        }
    }

    private fun testActivity() =
        ActivityDetail(
            id = "photo-viewer-test",
            uploadId = "upload",
            sport = "run",
            name = "Photo viewer test",
            description = null,
            excludeFromRankings = false,
            startedAt = "2026-08-12T20:25:00Z",
            timezoneOffsetMinutes = 0,
            metrics =
                ActivityMetrics(
                    elapsedTime = 60.0,
                    movingTime = 60.0,
                    distance = 1000.0,
                    elevationGain = 10.0,
                    elevationLoss = 10.0,
                    avgSpeed = 2.0,
                    maxSpeed = 2.0,
                    avgHr = null,
                    maxHr = null,
                    avgCadence = null,
                    maxCadence = null,
                    avgPower = null,
                    maxPower = null,
                    normalizedPower = null,
                    calories = 10.0,
                ),
            createdAt = "2026-08-12T20:25:00Z",
            updatedAt = "2026-08-12T20:25:00Z",
            track = Track("LineString", listOf(listOf(11.9, 57.7), listOf(11.91, 57.71))),
            analysis = null,
            bestEfforts = null,
            matchedRouteCount = null,
            images =
                listOf(
                    ActivityImage("one", preview = "one.jpg"),
                    ActivityImage("two", preview = "two.jpg"),
                ),
        )
}
