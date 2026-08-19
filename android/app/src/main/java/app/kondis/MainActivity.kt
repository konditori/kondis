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
    // hiltViewModel() inside KondisApp() resolves to this same Activity-scoped instance, so the
    // browser-launch events emitted from user interaction inside Compose are the ones collected
    // here.
    private val viewModel: AppViewModel by viewModels()

    // AuthTabIntent's launcher must be registered on an ActivityResultCaller (an Activity or
    // Fragment) unconditionally before the Activity reaches STARTED, so it lives here rather than
    // in a @Composable.
    private val authTabLauncher =
        AuthTabIntent.registerActivityResultLauncher(this) { result ->
            viewModel.handleAuthTabResult(result.resultCode, result.resultUri)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
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
