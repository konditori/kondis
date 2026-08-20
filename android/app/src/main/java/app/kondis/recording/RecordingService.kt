package app.kondis.recording

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import app.kondis.MainActivity
import app.kondis.R
import app.kondis.ui.i18n.tr
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class RecordingService :
    Service(),
    LocationListener {
    @Inject lateinit var recordingManager: RecordingManager

    @Inject lateinit var liveTracking: LiveTrackingRepository

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var locationManager: LocationManager
    private var ticker: Job? = null

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(LocationManager::class.java)
        createNotificationChannel()
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        when (intent?.action) {
            ACTION_START -> start(intent.getStringExtra(EXTRA_SPORT) ?: "run")
            ACTION_PAUSE -> pause()
            ACTION_RESUME -> resume()
            ACTION_STOP -> stop()
            else -> restoreAfterProcessDeath()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onLocationChanged(location: Location) = recordingManager.addLocation(location)

    @Deprecated("Required by LocationListener below API 31")
    override fun onStatusChanged(
        provider: String?,
        status: Int,
        extras: Bundle?,
    ) = Unit

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) = Unit

    override fun onDestroy() {
        stopLocationUpdates()
        ticker?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    private fun start(sport: String) {
        val created = recordingManager.start()
        startForeground(NOTIFICATION_ID, notification())
        startLocationUpdates()
        startTicker()
        if (created) {
            recordingManager.state.value.startedAt?.let { startedAt ->
                scope.launch(Dispatchers.IO) {
                    runCatching { liveTracking.start(sport, startedAt) }
                }
            }
        }
    }

    private fun restoreAfterProcessDeath() {
        when (recordingManager.state.value.mode) {
            RecordingMode.Recording -> {
                startForeground(NOTIFICATION_ID, notification())
                startLocationUpdates()
                startTicker()
            }

            RecordingMode.Paused -> {
                startForeground(NOTIFICATION_ID, notification())
                startTicker()
            }

            else -> {
                stopSelf()
            }
        }
    }

    private fun pause() {
        recordingManager.pause()
        stopLocationUpdates()
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
        scope.launch(Dispatchers.IO) {
            runCatching { liveTracking.updateState("paused", recordingManager.state.value) }
        }
    }

    private fun resume() {
        recordingManager.resume()
        startLocationUpdates()
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
        scope.launch(Dispatchers.IO) {
            runCatching { liveTracking.updateState("recording", recordingManager.state.value) }
        }
    }

    private fun stop() {
        stopLocationUpdates()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startTicker() {
        if (ticker?.isActive == true) return
        ticker =
            scope.launch {
                while (isActive) {
                    recordingManager.tick()
                    if (recordingManager.state.value.elapsedSeconds % LIVE_SYNC_SECONDS == 0L) {
                        scope.launch(Dispatchers.IO) {
                            runCatching { liveTracking.sync(recordingManager.state.value) }
                        }
                    }
                    delay(1_000)
                }
            }
    }

    private fun startLocationUpdates() {
        val fine = ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        if (fine != PackageManager.PERMISSION_GRANTED) {
            recordingManager.fail("Precise location is required to record a GPS workout")
            stop()
            return
        }
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                1_000L,
                1f,
                this,
                Looper.getMainLooper(),
            )
        } catch (error: IllegalArgumentException) {
            recordingManager.fail(error.message ?: "GPS is unavailable")
            stop()
        } catch (_: SecurityException) {
            recordingManager.fail("Precise location permission was removed")
            stop()
        }
    }

    private fun stopLocationUpdates() = locationManager.removeUpdates(this)

    private fun notification(): Notification {
        val contentIntent =
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        return NotificationCompat
            .Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(getString(R.string.recording_notification_title))
            .setContentText(
                if (recordingManager.state.value.mode ==
                    RecordingMode.Paused
                ) {
                    tr("activity_paused")
                } else {
                    tr("tap_to_view_activity")
                },
            ).setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .build()
    }

    private fun createNotificationChannel() {
        val channel =
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.recording_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { description = getString(R.string.recording_channel_description) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val ACTION_START = "app.kondis.recording.START"
        const val ACTION_PAUSE = "app.kondis.recording.PAUSE"
        const val ACTION_RESUME = "app.kondis.recording.RESUME"
        const val ACTION_STOP = "app.kondis.recording.STOP"
        const val EXTRA_SPORT = "app.kondis.recording.SPORT"
        private const val CHANNEL_ID = "workout_recording"
        private const val NOTIFICATION_ID = 2293
        private const val LIVE_SYNC_SECONDS = 10L
    }
}
