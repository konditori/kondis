package app.kondis.data.remote

import app.kondis.model.Activity
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityImage
import app.kondis.model.ActivityPage
import app.kondis.model.ActivityUpdate
import app.kondis.model.BestEffortHistory
import app.kondis.model.MatchedRouteHistory
import app.kondis.model.UploadResponse
import kotlinx.serialization.Serializable
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import retrofit2.http.Url

@Serializable data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable data class LoginResponse(
    val accessToken: String,
)

@Serializable data class CurrentUserResponse(
    val id: String,
    val email: String,
    val name: String,
    val role: String,
)

interface KondisApi {
    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest,
    ): LoginResponse

    @GET("auth/me")
    suspend fun me(): CurrentUserResponse

    @GET("activities")
    suspend fun activities(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("search") search: String? = null,
    ): ActivityPage

    @GET("activities/{id}")
    suspend fun activity(
        @Path("id") id: String,
    ): ActivityDetail

    @PUT("activities/{id}")
    suspend fun updateActivity(
        @Path("id") id: String,
        @Body update: ActivityUpdate,
    ): Activity

    @DELETE("activities/{id}")
    suspend fun deleteActivity(
        @Path("id") id: String,
    )

    @GET("activities/{id}/matched-routes")
    suspend fun matchedRoutes(
        @Path("id") id: String,
    ): MatchedRouteHistory

    @GET("activities/best-efforts/{sport}/{type}")
    suspend fun bestEfforts(
        @Path("sport") sport: String,
        @Path("type") type: String,
    ): BestEffortHistory

    @Multipart
    @POST("upload/activity")
    suspend fun uploadActivity(
        @Part file: MultipartBody.Part,
    ): UploadResponse

    @Multipart
    @POST("activities/{id}/images")
    suspend fun uploadActivityImage(
        @Path("id") id: String,
        @Part file: MultipartBody.Part,
        @Part("caption") caption: RequestBody? = null,
    ): ActivityImage

    @DELETE("activities/{activityId}/images/{imageId}")
    suspend fun deleteActivityImage(
        @Path("activityId") activityId: String,
        @Path("imageId") imageId: String,
    )

    @Streaming
    @GET
    suspend fun activityImage(
        @Url path: String,
    ): ResponseBody
}
