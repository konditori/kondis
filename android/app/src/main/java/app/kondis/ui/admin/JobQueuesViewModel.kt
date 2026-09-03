package app.kondis.ui.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.JobAdminRepository
import app.kondis.data.remote.AllJobStatusResponse
import app.kondis.data.remote.JobHistoryEntryResponse
import app.kondis.ui.feed.userMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class JobQueuesUiState(
    val queues: AllJobStatusResponse? = null,
    val history: List<JobHistoryEntryResponse> = emptyList(),
    val loading: Boolean = true,
    val errorMessage: String? = null,
)

@HiltViewModel
class JobQueuesViewModel
    @Inject
    constructor(
        private val repository: JobAdminRepository,
    ) : ViewModel() {
        private val mutableState = MutableStateFlow(JobQueuesUiState())
        val state: StateFlow<JobQueuesUiState> = mutableState.asStateFlow()

        init {
            viewModelScope.launch {
                while (isActive) {
                    refresh(silent = mutableState.value.queues != null)
                    delay(5_000)
                }
            }
        }

        fun refresh() {
            viewModelScope.launch { refresh(silent = false) }
        }

        private suspend fun refresh(silent: Boolean) {
            if (!silent) mutableState.value = mutableState.value.copy(loading = true, errorMessage = null)
            runCatching { repository.snapshot() }
                .onSuccess { snapshot ->
                    mutableState.value =
                        mutableState.value.copy(
                            queues = snapshot.queues,
                            history = snapshot.history,
                            loading = false,
                            errorMessage = null,
                        )
                }.onFailure { error ->
                    if (!silent) {
                        mutableState.value =
                            mutableState.value.copy(loading = false, errorMessage = error.userMessage())
                    }
                }
        }
    }
