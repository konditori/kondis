package app.kondis.model

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ApiModelTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `activity page matches the Kondis OpenAPI wire format`() {
        val page =
            json.decodeFromString<ActivityPage>(
                """
                {
                  "activities": [{
                    "id": "activity-1",
                    "uploadId": "upload-1",
                    "sport": "run",
                    "name": "Morning run",
                    "description": null,
                    "excludeFromRankings": false,
                    "startedAt": "2026-08-13T05:30:00Z",
                    "timezoneOffsetMinutes": 120,
                    "metrics": {
                      "elapsedTime": 1800,
                      "movingTime": 1750,
                      "distance": 5000.0,
                      "elevationGain": 42.0,
                      "elevationLoss": 42.0,
                      "avgSpeed": 2.857,
                      "maxSpeed": 4.1,
                      "avgHr": 145,
                      "maxHr": 168,
                      "avgCadence": 172,
                      "maxCadence": 184,
                      "avgPower": null,
                      "maxPower": null,
                      "normalizedPower": null,
                      "calories": 410
                    },
                    "createdAt": "2026-08-13T06:01:00Z",
                    "updatedAt": "2026-08-13T06:01:00Z",
                    "topBestEfforts": [{
                      "type": "power_30m",
                      "value": 287.4,
                      "overallRank": 1,
                      "yearRank": 1
                    }],
                    "track": null
                  }],
                  "nextCursor": null,
                  "total": 1
                }
                """.trimIndent(),
            )

        assertEquals(1, page.total)
        assertEquals("Morning run", page.activities.single().name)
        assertEquals(
            5_000.0,
            page.activities
                .single()
                .metrics
                ?.distance ?: 0.0,
            0.0,
        )
        assertEquals(
            287.4,
            page.activities
                .single()
                .topBestEfforts
                ?.single()
                ?.value ?: 0.0,
            0.0,
        )
        assertNull(page.nextCursor)
    }
}
