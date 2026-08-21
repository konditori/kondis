package app.kondis.ui.detail

import android.graphics.Bitmap
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.data.remote.ActivityEventClient
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityUpdate
import app.kondis.model.Comment
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
    val comments: List<Comment> = emptyList(),
    val commentsLoading: Boolean = false,
    val commenting: Boolean = false,
)

@HiltViewModel
class ActivityDetailViewModel
    @Inject
    constructor(
        private val repository: ActivityRepository,
        private val eventClient: ActivityEventClient,
    ) : ViewModel() {
        private val mutableState = MutableStateFlow(DetailUiState())
        val state: StateFlow<DetailUiState> = mutableState.asStateFlow()
        private var activityId: String? = null
        private var observeJob: Job? = null
        private var eventJob: Job? = null

        fun load(id: String) {
            if (id == activityId) return
            activityId = id
            observeJob?.cancel()
            eventJob?.cancel()
            mutableState.value =
                mutableState.value.copy(
                    activity = null,
                    loading = true,
                    errorMessage = null,
                    deleted = false,
                    mutationError = null,
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
            loadComments(id)
            if (!id.startsWith(LOCAL_ACTIVITY_ID_PREFIX)) {
                eventJob =
                    viewModelScope.launch {
                        eventClient.observe(id).collect { event ->
                            repository.refreshDetail(id)
                            if (event.type == "activity.comment.created") loadComments(id)
                        }
                    }
            }
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

        fun refreshDiscussion() {
            val id = activityId ?: return
            refresh()
            loadComments(id)
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

        fun setLiked(liked: Boolean) {
            val id = activityId ?: return
            if (id.startsWith(LOCAL_ACTIVITY_ID_PREFIX)) return
            viewModelScope.launch {
                runCatching { repository.setLiked(id, liked) }
                    .onFailure { error ->
                        mutableState.value =
                            mutableState.value.copy(mutationError = error.userMessage())
                    }
            }
        }

        private fun loadComments(id: String) {
            if (id.startsWith(LOCAL_ACTIVITY_ID_PREFIX)) return
            viewModelScope.launch {
                mutableState.value = mutableState.value.copy(commentsLoading = true)
                runCatching { repository.comments(id).comments }
                    .onSuccess { comments -> mutableState.value = mutableState.value.copy(comments = comments) }
                    .onFailure { error ->
                        mutableState.value =
                            mutableState.value.copy(mutationError = error.userMessage())
                    }
                mutableState.value = mutableState.value.copy(commentsLoading = false)
            }
        }

        fun addComment(body: String) {
            val id = activityId ?: return
            val trimmed = body.trim()
            if (id.startsWith(LOCAL_ACTIVITY_ID_PREFIX) || trimmed.isEmpty()) return
            viewModelScope.launch {
                mutableState.value = mutableState.value.copy(commenting = true, mutationError = null)
                runCatching { repository.addComment(id, trimmed) }
                    .onSuccess { loadComments(id) }
                    .onFailure { error ->
                        mutableState.value =
                            mutableState.value.copy(mutationError = error.userMessage())
                    }
                mutableState.value = mutableState.value.copy(commenting = false)
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
