package app.kondis.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.model.ActivityDetail
import app.kondis.ui.feed.userMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DetailUiState(
    val activity: ActivityDetail? = null,
    val loading: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class ActivityDetailViewModel
    @Inject
    constructor(
        private val repository: ActivityRepository,
    ) : ViewModel() {
        private val mutableState = MutableStateFlow(DetailUiState())
        val state: StateFlow<DetailUiState> = mutableState.asStateFlow()
        private var activityId: String? = null
        private var observeJob: Job? = null

        fun load(id: String) {
            if (id == activityId) return
            activityId = id
            observeJob?.cancel()
            observeJob =
                viewModelScope.launch {
                    repository.detail(id).collect { activity ->
                        mutableState.value = mutableState.value.copy(activity = activity)
                    }
                }
            refresh()
        }

        fun refresh() {
            val id = activityId ?: return
            viewModelScope.launch {
                mutableState.value = mutableState.value.copy(loading = true, errorMessage = null)
                runCatching { repository.refreshDetail(id) }
                    .onFailure { error ->
                        mutableState.value = mutableState.value.copy(errorMessage = error.userMessage())
                    }
                mutableState.value = mutableState.value.copy(loading = false)
            }
        }
    }
