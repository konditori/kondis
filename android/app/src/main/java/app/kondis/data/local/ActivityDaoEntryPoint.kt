package app.kondis.data.local

import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface ActivityDaoEntryPoint {
    fun activityDao(): ActivityDao
}
