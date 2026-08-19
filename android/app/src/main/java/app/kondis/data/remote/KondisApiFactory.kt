package app.kondis.data.remote

import app.kondis.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KondisApiFactory
    @Inject
    constructor(
        private val client: OkHttpClient,
        private val json: Json,
    ) {
        fun create(
            baseUrl: String,
            accessToken: String? = null,
        ): KondisApi =
            Retrofit
                .Builder()
                .baseUrl(normalizeBaseUrl(baseUrl))
                .client(
                    client
                        .newBuilder()
                        .addInterceptor { chain ->
                            chain.proceed(
                                chain
                                    .request()
                                    .newBuilder()
                                    .apply {
                                        if (accessToken !=
                                            null
                                        ) {
                                            header("Authorization", "Bearer $accessToken")
                                        }
                                    }.build(),
                            )
                        }.build(),
                ).addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
                .create(KondisApi::class.java)

        companion object {
            fun normalizeBaseUrl(
                value: String,
                allowCleartext: Boolean = BuildConfig.DEBUG,
            ): String {
                val trimmed = value.trim()
                require(trimmed.startsWith("https://") || (allowCleartext && trimmed.startsWith("http://"))) {
                    if (allowCleartext) {
                        "Server URL must start with http:// or https://"
                    } else {
                        "Release builds require an HTTPS server URL"
                    }
                }
                return trimmed.trimEnd('/') + "/"
            }
        }
    }
