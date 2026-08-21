package app.kondis.data

import app.kondis.data.remote.KondisApiFactory
import app.kondis.data.settings.SettingsRepository
import app.kondis.model.PersonSearchResult
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SocialRepository
    @Inject
    constructor(
        private val apiFactory: KondisApiFactory,
        private val settingsRepository: SettingsRepository,
    ) {
        private suspend fun api() = apiFactory.create(settingsRepository.settings.first())

        suspend fun searchPeople(query: String): List<PersonSearchResult> = api().people(query.trim())

        suspend fun follow(id: String) = api().follow(id)

        suspend fun cancelFollowRequest(id: String) = api().cancelFollowRequest(id)

        suspend fun unfollow(id: String) = api().unfollow(id)
    }
