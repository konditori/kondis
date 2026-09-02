package app.kondis.data

import app.kondis.data.remote.AllJobStatusResponse
import app.kondis.data.remote.JobHistoryEntryResponse
import app.kondis.data.remote.KondisApiFactory
import app.kondis.data.settings.SettingsRepository
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

data class JobAdminSnapshot(
    val queues: AllJobStatusResponse,
    val history: List<JobHistoryEntryResponse>,
)

@Singleton
class JobAdminRepository
    @Inject
    constructor(
        private val apiFactory: KondisApiFactory,
        private val settingsRepository: SettingsRepository,
    ) {
        suspend fun snapshot(): JobAdminSnapshot {
            val api = apiFactory.create(settingsRepository.settings.first())
            val queues = api.jobStatus()
            val history = api.jobHistory().jobs
            return JobAdminSnapshot(queues, history)
        }
    }
