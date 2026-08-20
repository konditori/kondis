package app.kondis.ui.detail

import android.graphics.Bitmap
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityUpdate
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
    val saving: Boolean = false,
    val deleting: Boolean = false,
    val mutationError: String? = null,
    val deleted: Boolean = false,
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
            mutableState.value =
                mutableState.value.copy(
                    activity = null,
                    loading = true,
                    errorMessage = null,
                )
            observeJob =
                viewModelScope.launch {
                    repository.detail(id).collect { activity ->
                        mutableState.value =
                            mutableState.value.copy(
                                activity = activity,
                                loading = false,
                            )
                        if (activity != null && activity.id != id) switchToRemoteActivity(activity.id)
                    }
                }
            refresh()
        }

        private fun switchToRemoteActivity(remoteId: String) {
            if (remoteId == activityId) return
            activityId = remoteId
            observeJob?.cancel()
            observeJob =
                viewModelScope.launch {
                    repository.detail(remoteId).collect { activity ->
                        mutableState.value =
                            mutableState.value.copy(
                                activity = activity ?: mutableState.value.activity,
                                loading = false,
                            )
                    }
                }
            refresh()
        }

        fun refresh() {
            val id = activityId ?: return
            if (id.startsWith(LOCAL_ACTIVITY_ID_PREFIX)) return
            viewModelScope.launch {
                mutableState.value = mutableState.value.copy(loading = true, errorMessage = null)
                runCatching { repository.refreshDetail(id) }
                    .onFailure { error ->
                        mutableState.value = mutableState.value.copy(errorMessage = error.userMessage())
                    }
                mutableState.value = mutableState.value.copy(loading = false)
            }
        }

        fun update(update: ActivityUpdate) {
            val id = activityId ?: return
            if (id.startsWith(LOCAL_ACTIVITY_ID_PREFIX)) return
            viewModelScope.launch {
                mutableState.value = mutableState.value.copy(saving = true, mutationError = null)
                runCatching { repository.updateActivity(id, update) }
                    .onFailure { error ->
                        mutableState.value =
                            mutableState.value.copy(mutationError = error.userMessage())
                    }
                mutableState.value = mutableState.value.copy(saving = false)
            }
        }

        fun delete() {
            val id = activityId ?: return
            if (id.startsWith(LOCAL_ACTIVITY_ID_PREFIX)) return
            viewModelScope.launch {
                mutableState.value = mutableState.value.copy(deleting = true, mutationError = null)
                runCatching { repository.deleteActivity(id) }
                    .onSuccess { mutableState.value = mutableState.value.copy(deleted = true) }
                    .onFailure { error ->
                        mutableState.value =
                            mutableState.value.copy(mutationError = error.userMessage())
                    }

                mutableState.value = mutableState.value.copy(deleting = false)
            }
        }

        fun uploadImages(uris: List<Uri>) {
            val id = activityId ?: return
            if (id.startsWith(LOCAL_ACTIVITY_ID_PREFIX) || uris.isEmpty()) return
            viewModelScope.launch {
                runCatching { repository.uploadImages(id, uris) }
                    .onFailure { error ->
                        mutableState.value =
                            mutableState.value.copy(mutationError = error.userMessage())
                    }
            }
        }

        suspend fun loadImage(path: String): Bitmap? = repository.loadActivityImage(path)
    }

private const val LOCAL_ACTIVITY_ID_PREFIX = "local-"
