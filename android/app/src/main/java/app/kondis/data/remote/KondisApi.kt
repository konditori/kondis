package app.kondis.data.remote

import app.kondis.model.Activity
import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityImage
import app.kondis.model.ActivityPage
import app.kondis.model.ActivityUpdate
import app.kondis.model.BestEffortHistory
import app.kondis.model.Comment
import app.kondis.model.CommentPage
import app.kondis.model.LikeState
import app.kondis.model.MatchedRouteHistory
import app.kondis.model.PersonSearchResult
import app.kondis.model.UploadResponse
import kotlinx.serialization.Serializable
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
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
    val user: LoginUserResponse,
)

@Serializable data class LoginUserResponse(
    val id: String,
)

@Serializable data class CurrentUserResponse(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val role: String,
)

@Serializable data class LiveWorkoutCreateRequest(
    val clientSessionId: String,
    val sport: String,
    val startedAt: String,
)

@Serializable data class LivePointRequest(
    val sequence: Int,
    val recordedAt: String,
    val latitude: Double,
    val longitude: Double,
    val altitude: Double? = null,
    val accuracyMeters: Float,
)

@Serializable data class LiveWorkoutPointsRequest(
    val points: List<LivePointRequest>,
    val elapsedSeconds: Long,
    val distanceMeters: Double,
)

@Serializable data class LiveWorkoutStateRequest(
    val status: String,
    val elapsedSeconds: Long,
    val distanceMeters: Double,
)

@Serializable data class LiveWorkoutResponse(
    val id: String,
    val lastSequence: Int,
)

@Serializable data class LiveWorkoutShareResponse(
    val token: String,
    val expiresAt: String? = null,
)

@Serializable data class CommentCreateRequest(
    val body: String,
)

interface KondisApi {
    @POST("auth/login")
    suspend fun login(
        @Body request: LoginRequest,
    ): LoginResponse

    @GET("auth/me")
    suspend fun me(): CurrentUserResponse

    @POST("live-workouts")
    suspend fun createLiveWorkout(
        @Body request: LiveWorkoutCreateRequest,
    ): LiveWorkoutResponse

    @POST("live-workouts/{id}/points")
    suspend fun uploadLivePoints(
        @Path("id") id: String,
        @Body request: LiveWorkoutPointsRequest,
    ): LiveWorkoutResponse

    @PATCH("live-workouts/{id}")
    suspend fun updateLiveWorkout(
        @Path("id") id: String,
        @Body request: LiveWorkoutStateRequest,
    ): LiveWorkoutResponse

    @POST("live-workouts/{id}/share")
    suspend fun createLiveWorkoutShare(
        @Path("id") id: String,
    ): LiveWorkoutShareResponse

    @DELETE("live-workouts/{id}")
    suspend fun discardLiveWorkout(
        @Path("id") id: String,
    )

    @GET("activities")
    suspend fun activities(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("search") search: String? = null,
    ): ActivityPage

    @GET("feed")
    suspend fun feed(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("search") search: String? = null,
    ): ActivityPage

    @GET("activities/{id}")
    suspend fun activity(
        @Path("id") id: String,
    ): ActivityDetail

    @PUT("activities/{id}/like")
    suspend fun like(
        @Path("id") id: String,
    ): LikeState

    @DELETE("activities/{id}/like")
    suspend fun unlike(
        @Path("id") id: String,
    ): LikeState

    @GET("activities/{id}/comments")
    suspend fun comments(
        @Path("id") id: String,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50,
    ): CommentPage

    @POST("activities/{id}/comments")
    suspend fun comment(
        @Path("id") id: String,
        @Body request: CommentCreateRequest,
    ): Comment

    @GET("people")
    suspend fun people(
        @Query("query") query: String,
    ): List<PersonSearchResult>

    @POST("people/{id}/follow-request")
    suspend fun follow(
        @Path("id") id: String,
    )

    @DELETE("people/{id}/follow-request")
    suspend fun cancelFollowRequest(
        @Path("id") id: String,
    )

    @DELETE("people/{id}/follow")
    suspend fun unfollow(
        @Path("id") id: String,
    )

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
