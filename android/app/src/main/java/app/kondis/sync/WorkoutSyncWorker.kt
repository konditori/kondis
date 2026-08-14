package app.kondis.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import app.kondis.data.ActivityRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class WorkoutSyncWorker
    @AssistedInject
    constructor(
        @Assisted context: Context,
        @Assisted params: WorkerParameters,
        private val repository: ActivityRepository,
    ) : CoroutineWorker(context, params) {
        override suspend fun doWork(): Result =
            if (repository.syncQueuedWorkouts()) Result.retry() else Result.success()
    }
