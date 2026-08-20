package app.kondis

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.browser.auth.AuthTabIntent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import app.kondis.ui.AppViewModel
import app.kondis.ui.KondisApp
import app.kondis.ui.theme.KondisTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel: AppViewModel by viewModels()

    private val authTabLauncher =
        AuthTabIntent.registerActivityResultLauncher(this) { result ->
            viewModel.handleAuthTabResult(result.resultCode, result.resultUri)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { viewModel.settings.value == null }
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.browserLaunch.collect { launch ->
                    AuthTabIntent
                        .Builder()
                        .build()
                        .launch(authTabLauncher, launch.authorizationUri, launch.redirectScheme)
                }
            }
        }
        setContent {
            KondisTheme {
                KondisApp(viewModel = viewModel)
            }
        }
    }
}
