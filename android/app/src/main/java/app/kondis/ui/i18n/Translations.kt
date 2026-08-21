package app.kondis.ui.i18n

import android.annotation.SuppressLint
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.stringResource

private val legacyKeys =
    setOf("app_name", "recording_channel_name", "recording_channel_description", "recording_notification_title")

private fun androidResourceName(key: String) = if (key in legacyKeys) key else "i18n_$key"

/**
 * Resolves a string from the generated Android resources. Resource names are
 * the keys in the repository-level i18n catalog.
 */
@Composable
@SuppressLint("DiscouragedApi")
fun tr(
    key: String,
    vararg formatArgs: Any,
): String {
    val context = LocalContext.current
    val resourceId = LocalResources.current.getIdentifier(androidResourceName(key), "string", context.packageName)
    check(resourceId != 0) { "Unknown translation key: $key" }
    return stringResource(resourceId, *formatArgs)
}

@SuppressLint("DiscouragedApi")
fun android.content.Context.tr(
    key: String,
    vararg formatArgs: Any,
): String {
    val resourceId = resources.getIdentifier(androidResourceName(key), "string", packageName)
    check(resourceId != 0) { "Unknown translation key: $key" }
    return getString(resourceId, *formatArgs)
}
