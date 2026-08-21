package app.kondis.ui.people

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.kondis.data.SocialRepository
import app.kondis.model.PersonSearchResult
import app.kondis.ui.feed.userMessage
import app.kondis.ui.i18n.tr
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PeopleUiState(
    val query: String = "",
    val people: List<PersonSearchResult> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class PeopleViewModel
    @Inject
    constructor(
        private val repository: SocialRepository,
    ) : ViewModel() {
        private val mutableState = MutableStateFlow(PeopleUiState())
        val state: StateFlow<PeopleUiState> = mutableState.asStateFlow()
        private var searchJob: Job? = null

        fun setQuery(query: String) {
            mutableState.value = mutableState.value.copy(query = query.take(200))
            searchJob?.cancel()
            if (query.isBlank()) {
                mutableState.value = mutableState.value.copy(people = emptyList(), loading = false, error = null)
                return
            }
            searchJob =
                viewModelScope.launch {
                    mutableState.value = mutableState.value.copy(loading = true, error = null)
                    runCatching { repository.searchPeople(query) }
                        .onSuccess { mutableState.value = mutableState.value.copy(people = it) }
                        .onFailure { mutableState.value = mutableState.value.copy(error = it.userMessage()) }
                    mutableState.value = mutableState.value.copy(loading = false)
                }
        }

        fun toggleFollow(person: PersonSearchResult) {
            viewModelScope.launch {
                runCatching {
                    when {
                        person.relation.following -> repository.unfollow(person.user.id)
                        person.relation.outgoingRequest -> repository.cancelFollowRequest(person.user.id)
                        else -> repository.follow(person.user.id)
                    }
                    repository.searchPeople(mutableState.value.query)
                }.onSuccess { mutableState.value = mutableState.value.copy(people = it) }
                    .onFailure { mutableState.value = mutableState.value.copy(error = it.userMessage()) }
            }
        }
    }

@Composable
fun PeopleRoute(
    onBack: () -> Unit,
    viewModel: PeopleViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, tr("back")) }
            Text(tr("find_people"), style = MaterialTheme.typography.titleLarge)
        }
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::setQuery,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text(tr("search_by_name")) },
        )
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) }
        if (state.loading) CircularProgressIndicator(modifier = Modifier.padding(20.dp))
        LazyColumn(
            contentPadding = PaddingValues(vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(state.people, key = { it.user.id }) { person ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(person.user.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            when {
                                person.relation.following -> tr("following")
                                person.relation.outgoingRequest -> tr("request_pending")
                                else -> ""
                            },
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    OutlinedButton(onClick = { viewModel.toggleFollow(person) }) {
                        Icon(Icons.Rounded.PersonAdd, contentDescription = null)
                        Text(
                            when {
                                person.relation.following -> tr("unfollow")
                                person.relation.outgoingRequest -> tr("common_cancel")
                                else -> tr("follow")
                            },
                            modifier = Modifier.padding(start = 6.dp),
                        )
                    }
                }
            }
        }
    }
}
