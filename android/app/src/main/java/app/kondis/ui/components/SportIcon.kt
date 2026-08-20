package app.kondis.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.DirectionsBike
import androidx.compose.material.icons.automirrored.rounded.DirectionsRun
import androidx.compose.material.icons.rounded.DownhillSkiing
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.Hiking
import androidx.compose.material.icons.rounded.Kayaking
import androidx.compose.material.icons.rounded.Landscape
import androidx.compose.material.icons.rounded.Pool
import androidx.compose.material.icons.rounded.Sports
import androidx.compose.ui.graphics.vector.ImageVector

fun sportIcon(sport: String): ImageVector =
    when {
        sport.contains(
            "ride",
        ) || sport == "velomobile" || sport == "handcycle" -> Icons.AutoMirrored.Rounded.DirectionsBike

        sport.contains("run") -> Icons.AutoMirrored.Rounded.DirectionsRun

        sport == "walk" || sport == "hike" || sport == "snowshoe" -> Icons.Rounded.Hiking

        sport.contains("ski") || sport == "snowboard" -> Icons.Rounded.DownhillSkiing

        sport == "swim" -> Icons.Rounded.Pool

        sport in
            setOf(
                "kayaking",
                "canoeing",
                "rowing",
                "sail",
                "surfing",
                "stand_up_paddling",
            )
        -> Icons.Rounded.Kayaking

        sport in setOf("weight_training", "crossfit", "high_intensity_interval_training") -> Icons.Rounded.FitnessCenter

        sport == "rock_climbing" -> Icons.Rounded.Landscape

        else -> Icons.Rounded.Sports
    }
