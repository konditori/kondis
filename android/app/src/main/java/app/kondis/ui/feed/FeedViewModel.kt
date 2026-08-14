package app.kondis.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.data.QueuedWorkout
import app.kondis.model.Activity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FeedUiState(
    val activities: List<Activity> = emptyList(),
    val search: String = "",
    val total: Int? = null,
    val nextCursor: String? = null,
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
    val queuedWorkouts: List<QueuedWorkout> = emptyList(),
)

private data class FeedMeta(
    val total: Int? = null,
    val nextCursor: String? = null,
    val refreshing: Boolean = false,
    val loadingMore: Boolean = false,
    val errorMessage: String? = null,
)

@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
@HiltViewModel
class FeedViewModel
    @Inject
    constructor(
        private val repository: ActivityRepository,
    ) : ViewModel() {
        private val search = MutableStateFlow("")
        private val meta = MutableStateFlow(FeedMeta())
        private val activities = search.flatMapLatest(repository::activities)

        val state: StateFlow<FeedUiState> =
            combine(activities, search, meta, repository.queuedWorkouts()) { activities, query, meta, queuedWorkouts ->
                FeedUiState(
                    activities = activities,
                    search = query,
                    total = meta.total,
                    nextCursor = meta.nextCursor,
                    refreshing = meta.refreshing,
                    loadingMore = meta.loadingMore,
                    errorMessage = meta.errorMessage,
                    queuedWorkouts = queuedWorkouts,
                )
            }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), FeedUiState())

        init {
            viewModelScope.launch {
                search.debounce(350).distinctUntilChanged().collect { refresh() }
            }
        }

        fun setSearch(value: String) {
            search.value = value.take(200)
        }

        fun refresh() {
            if (meta.value.refreshing) return
            viewModelScope.launch {
                meta.update { it.copy(refreshing = true, errorMessage = null) }
                runCatching { repository.refresh(search.value) }
                    .onSuccess { page -> meta.update { it.copy(total = page.total, nextCursor = page.nextCursor) } }
                    .onFailure { error -> meta.update { it.copy(errorMessage = error.userMessage()) } }
                meta.update { it.copy(refreshing = false) }
            }
        }

        fun loadMore() {
            val cursor = meta.value.nextCursor ?: return
            if (meta.value.loadingMore) return
            viewModelScope.launch {
                meta.update { it.copy(loadingMore = true, errorMessage = null) }
                runCatching { repository.loadMore(cursor, search.value) }
                    .onSuccess { page -> meta.update { it.copy(total = page.total, nextCursor = page.nextCursor) } }
                    .onFailure { error -> meta.update { it.copy(errorMessage = error.userMessage()) } }
                meta.update { it.copy(loadingMore = false) }
            }
        }

        fun syncQueuedWorkouts() {
            repository.requestQueuedWorkoutSync()
        }
    }

internal fun Throwable.userMessage(): String =
    when (this) {
        is java.net.ConnectException -> "Can't reach your Kondis server"
        is java.net.UnknownHostException -> "Server hostname couldn't be resolved"
        is java.net.SocketTimeoutException -> "The server took too long to respond"
        else -> message ?: "Something went wrong"
    }
