package app.kondis.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.kondis.data.ActivityRepository
import app.kondis.model.BestEffortHistory
import app.kondis.ui.feed.userMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class BestEffortsUiState(
    val history: BestEffortHistory? = null,
    val loading: Boolean = true,
    val errorMessage: String? = null,
)

@HiltViewModel
class BestEffortsViewModel
    @Inject
    constructor(
        private val repository: ActivityRepository,
    ) : ViewModel() {
        private val mutableState = MutableStateFlow(BestEffortsUiState())
        val state: StateFlow<BestEffortsUiState> = mutableState.asStateFlow()

        fun load(
            sport: String,
            type: String,
        ) {
            viewModelScope.launch {
                mutableState.value = BestEffortsUiState(loading = true)
                runCatching { repository.bestEfforts(sport, type) }
                    .onSuccess { history ->
                        mutableState.value = BestEffortsUiState(history = history, loading = false)
                    }.onFailure { error ->
                        mutableState.update { it.copy(loading = false, errorMessage = error.userMessage()) }
                    }
            }
        }
    }
