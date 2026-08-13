package app.kondis.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val KondisGreen = Color(0xFF166534)
val KondisGreenDark = Color(0xFF8DDBA4)
val KondisOrange = Color(0xFFE96A3A)

private val LightColors = lightColorScheme(
    primary = KondisGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD2F6DC),
    onPrimaryContainer = Color(0xFF082E17),
    secondary = Color(0xFF46644D),
    tertiary = KondisOrange,
    background = Color(0xFFF8F8F4),
    onBackground = Color(0xFF1A1C1A),
    surface = Color(0xFFFFFEFA),
    surfaceVariant = Color(0xFFE1E4DD),
    outline = Color(0xFF747970),
)

private val DarkColors = darkColorScheme(
    primary = KondisGreenDark,
    onPrimary = Color(0xFF00391A),
    primaryContainer = Color(0xFF005227),
    onPrimaryContainer = Color(0xFFA9F2BE),
    secondary = Color(0xFFB4CCB8),
    tertiary = Color(0xFFFFB59B),
    background = Color(0xFF111411),
    onBackground = Color(0xFFE1E4DE),
    surface = Color(0xFF171A17),
    surfaceVariant = Color(0xFF414942),
    outline = Color(0xFF8B938B),
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

