package app.kondis.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val KondisAccent = Color(0xFFF6821F)
val KondisAccentDark = Color(0xFFFFB16E)
val KondisOrange = Color(0xFFA9430E)

private val LightColors =
    lightColorScheme(
        primary = KondisAccent,
        onPrimary = Color(0xFF292725),
        primaryContainer = Color(0xFFFFF0DF),
        onPrimaryContainer = Color(0xFF292725),
        secondary = Color(0xFF6B655E),
        tertiary = KondisOrange,
        background = Color(0xFFF7F6F3),
        onBackground = Color(0xFF292725),
        surface = Color(0xFFFFFEFA),
        surfaceVariant = Color(0xFFF0EEE9),
        outline = Color(0xFF6B655E),
    )

private val DarkColors =
    darkColorScheme(
        primary = KondisAccentDark,
        onPrimary = Color(0xFF292725),
        primaryContainer = Color(0xFF3A2B20),
        onPrimaryContainer = Color(0xFFFFB16E),
        secondary = Color(0xFFAAA39A),
        tertiary = Color(0xFFFFD978),
        background = Color(0xFF20201F),
        onBackground = Color(0xFFF5F2ED),
        surface = Color(0xFF292826),
        surfaceVariant = Color(0xFF46433F),
        outline = Color(0xFFAAA39A),
    )

@Composable
fun KondisTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = KondisTypography,
        content = content,
    )
}
