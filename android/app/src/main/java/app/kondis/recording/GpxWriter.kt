package app.kondis.recording

import java.io.File
import javax.inject.Inject

class EmptyRecordingException : IllegalArgumentException()

class GpxWriter
    @Inject
    constructor() {
        fun write(
            destination: File,
            recording: RecordingState,
            sport: String,
            title: String = sport,
        ): File {
            if (recording.points.isEmpty()) throw EmptyRecordingException()
            val points =
                recording.points.joinToString(separator = "\n") { point ->
                    val elevation =
                        point.altitude
                            ?.let {
                                "<ele>${"%.2f".format(
                                    java.util.Locale.US,
                                    it,
                                )}</ele>"
                            }.orEmpty()
                    "      <trkpt lat=\"${point.latitude}\" lon=\"${point.longitude}\">" +
                        "$elevation<time>${point.recordedAt}</time></trkpt>"
                }
            destination.writeText(
                """<?xml version="1.0" encoding="UTF-8"?>
            |<gpx version="1.1" creator="Kondis Android" xmlns="http://www.topografix.com/GPX/1/1">
            |  <metadata><time>${recording.startedAt}</time></metadata>
            |  <trk><name>${title.xmlEscape()}</name><type>${sport.xmlEscape()}</type><trkseg>
            |$points
            |  </trkseg></trk>
            |</gpx>
            |
                """.trimMargin(),
            )
            return destination
        }

        private fun String.xmlEscape() =
            replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;")
    }
