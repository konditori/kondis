package app.kondis.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.model.MatchedRouteHistory
import app.kondis.ui.feed.userMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MatchedRoutesUiState(
    val history: MatchedRouteHistory? = null,
    val loading: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class MatchedRoutesViewModel
    @Inject
    constructor(
        private val repository: ActivityRepository,
    ) : ViewModel() {
        private val mutableState = MutableStateFlow(MatchedRoutesUiState())
        val state: StateFlow<MatchedRoutesUiState> = mutableState.asStateFlow()
        private var activityId: String? = null

        fun load(id: String) {
            if (id == activityId && mutableState.value.history != null) return
            activityId = id
            viewModelScope.launch {
                mutableState.value = MatchedRoutesUiState(loading = true)
                runCatching { repository.matchedRoutes(id) }
                    .onSuccess { history -> mutableState.value = MatchedRoutesUiState(history = history) }
                    .onFailure { error ->
                        mutableState.value = MatchedRoutesUiState(errorMessage = error.userMessage())
                    }
            }
        }
    }
