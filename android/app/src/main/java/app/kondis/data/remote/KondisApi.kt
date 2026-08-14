package app.kondis.data.remote

import app.kondis.model.ActivityDetail
import app.kondis.model.ActivityPage
import app.kondis.model.UploadResponse
import okhttp3.MultipartBody
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface KondisApi {
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

    @Multipart
    @POST("upload/activity")
    suspend fun uploadActivity(
        @Part file: MultipartBody.Part,
    ): UploadResponse
}
