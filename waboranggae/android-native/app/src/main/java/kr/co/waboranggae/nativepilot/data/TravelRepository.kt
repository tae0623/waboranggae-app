package kr.co.waboranggae.nativepilot.data

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

interface TravelRepository {
    suspend fun cities(): List<City>
    suspend fun hero(): HeroPhoto
    suspend fun hotPlaces(): HotPlacesPayload
    suspend fun search(query: String): List<PlaceSuggestion>
    suspend fun recommend(preferences: Preferences): RecommendPayload
    fun imageUrl(value: String?): String?
    suspend fun api(path:String, method:String="GET", body:JsonObject?=null, auth:Boolean=false): JsonElement = throw ApiFailure("현재 연결에서 지원하지 않는 기능입니다.")
    fun snapshot(id:String):JsonObject? = null
    fun rememberCourse(value:JsonObject):Course = throw ApiFailure("코스를 불러올 수 없습니다.")
    suspend fun restoreSession():Boolean = false
    suspend fun acceptSession(value:JsonObject) {}
    suspend fun clearSession() {}
    fun loginOptions():LoginOptions = LoginOptions()
    suspend fun setLoginOptions(value:LoginOptions) {}
    suspend fun logoutCurrentSession() { api("/auth/logout/current","POST",auth=true);clearSession() }
}
class ApiFailure(message: String, val status:Int=0) : IOException(message)
class HttpTravelRepository(
    baseUrl: String, private val devKey: String,
    private val client: OkHttpClient = OkHttpClient.Builder().connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(130, TimeUnit.SECONDS).callTimeout(135, TimeUnit.SECONDS)
        .followRedirects(false).followSslRedirects(false).build(),
    private val sessionStore:SessionStore?=null,
    private val loginOptionsStore:LoginOptionsStore?=null
) : TravelRepository {
    private val base = baseUrl.trimEnd('/').toHttpUrl()
    private val basePath = base.encodedPath.trimEnd('/')
    private fun endpoint(path:String) = (base.toString().trimEnd('/') + path).toHttpUrl()
    private fun relativeApiPath(url:HttpUrl) = url.encodedPath.removePrefix(basePath)
    private var options=loginOptionsStore?.read()?:LoginOptions()
    override fun loginOptions()=options
    override suspend fun setLoginOptions(value:LoginOptions)=sessionMutex.withLock {
        val next=value.copy(email=if(value.rememberId)value.email.trim().take(254)else "")
        loginOptionsStore?.write(next);options=next
        sessionStore?.write(if(next.autoLogin)refresh else null);Unit
    }
    private var access:String?=null
    private var refresh:String?=null
    private val sessionMutex=Mutex()
    private val snapshots=linkedMapOf<String,JsonObject>()
    // The server requires region, companions, lowMobility, publicTransportOnly and confidence,
    // even when their values equal the Kotlin defaults.
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
    init { require(base.isHttps && base.username.isEmpty() && base.password.isEmpty() && base.query==null && base.fragment==null) { "인증정보가 포함되지 않은 HTTPS API 주소가 필요합니다." } }
    private fun request(path: String, body: String? = null, method:String=if(body==null) "GET" else "POST", token:String?=null): Request {
        require(path.startsWith("/api/") || path.startsWith("/auth/") || path=="/legal/config")
        val url = endpoint(path)
        require(url.scheme == base.scheme && url.host == base.host && url.port == base.port)
        return Request.Builder().url(url).header("Accept", "application/json")
            .apply { if (devKey.isNotEmpty()) header("X-Dev-Access-Key", devKey) }
            .apply { if(token!=null) header("Authorization","Bearer $token") }
            .method(method,if(method in listOf("GET","HEAD")) null else (body?:"{}").toRequestBody("application/json; charset=utf-8".toMediaType())).build()
    }
    private suspend fun response(request: Request): String = suspendCancellableCoroutine { continuation ->
        val call = client.newCall(request)
        call.timeout().timeout(when(relativeApiPath(request.url)) { "/api/recommend","/api/recommend/edit"->135; "/api/recommend/refresh-route"->60; "/api/explain"->100; "/api/hot-places"->40; else->30 },TimeUnit.SECONDS)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(ApiFailure(
                    if (e is java.io.InterruptedIOException) "서버 응답이 지연됩니다. 잠시 후 다시 시도해 주세요."
                    else "서비스에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요."))
            }
            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!continuation.isActive) return
                    if (!it.isSuccessful) {
                        val message = when (it.code) {
                            400 -> if(relativeApiPath(request.url).startsWith("/auth/social")) "로그인 요청이 만료되었거나 취소되었습니다. 다시 시작해 주세요." else "입력한 정보를 확인해 주세요."
                            401 -> "로그인 정보가 올바르지 않거나 만료되었습니다. 다시 로그인해 주세요."
                            403 -> "접근 권한 또는 개인정보 동의 상태를 확인해 주세요."
                            413 -> if(relativeApiPath(request.url)=="/api/user/bookmarks/add") "저장할 코스 정보가 너무 큽니다. 코스를 나누거나 장소를 줄인 뒤 다시 저장해 주세요." else "전송할 정보가 너무 큽니다."
                            429 -> "요청이 많습니다. 잠시 후 다시 시도해 주세요."
                            503 -> "지도·관광정보 서비스를 일시적으로 사용할 수 없어요. 나중에 다시 시도해 주세요."
                            in 300..399 -> "API 주소가 다른 곳으로 이동했습니다. 서버 주소를 확인해 주세요."
                            else -> "요청을 처리하지 못했습니다 (HTTP ${it.code})."
                        }
                        val signupDetail=if(relativeApiPath(request.url)=="/auth/signup" && it.code==400)runCatching{
                            val body=it.peekBody(2049).string()
                            if(body.length>2048)null else when(json.parseToJsonElement(body).jsonObject["code"]?.jsonPrimitive?.contentOrNull){
                                "DISPOSABLE_EMAIL_DOMAIN" -> "일회용 이메일로는 가입할 수 없어요. 계속 사용할 이메일 주소를 입력해 주세요."
                                else -> null
                            }
                        }.getOrNull() else null
                        val detail=if(relativeApiPath(request.url)=="/api/recommend" && it.code in listOf(422,503))runCatching{
                            val body=it.body?.string().orEmpty()
                            if(body.length>2048)null else json.parseToJsonElement(body).jsonObject.let{error->
                                error["error"]?.jsonPrimitive?.contentOrNull?.takeIf{value->error["code"]?.jsonPrimitive?.contentOrNull=="REQUIRED_VISIT" && value.length in 1..240}
                            }
                        }.getOrNull() else null
                        continuation.resumeWithException(ApiFailure(signupDetail?:detail?:message,it.code)); return
                    }
                    val text = try { it.body?.string() } catch (_: IOException) {
                        if(continuation.isActive) continuation.resumeWithException(ApiFailure("응답을 받는 중 연결이 끊겼습니다. 다시 시도해 주세요."))
                        return
                    }
                    if(!continuation.isActive) return
                    if (text == null || text.length > 4_000_000) continuation.resumeWithException(ApiFailure("서버 응답 형식이 올바르지 않습니다."))
                    else continuation.resume(text)
                }
            }
        })
    }
    override suspend fun cities() = json.decodeFromString<CitiesPayload>(response(request("/api/regions/jeonnam-cities"))).cities
    override suspend fun hero() = json.decodeFromString<HeroPhoto>(response(request("/api/login-photo")))
    override suspend fun hotPlaces() = json.decodeFromString<HotPlacesPayload>(response(request("/api/hot-places")))
    override suspend fun search(query: String): List<PlaceSuggestion> {
        val encoded = java.net.URLEncoder.encode(query.take(80), "UTF-8")
        return json.decodeFromString<PlacesPayload>(response(request("/api/places/search?q=$encoded"))).places
            .filter { Coordinate(it.latitude,it.longitude).valid() }
    }
    override suspend fun recommend(preferences: Preferences):RecommendPayload {
        val raw=api("/api/recommend","POST",json.encodeToJsonElement(RecommendRequest(preferences)).jsonObject).jsonObject
        raw["courses"]?.jsonArray?.forEach { rememberCourse(it.jsonObject) }
        return json.decodeFromJsonElement(raw)
    }
    override fun snapshot(id:String)=snapshots[id]
    override fun rememberCourse(value:JsonObject):Course {
        val course=json.decodeFromJsonElement<Course>(value)
        snapshots[course.id]=value
        while(snapshots.size>100) snapshots.remove(snapshots.keys.first())
        return course
    }
    override suspend fun acceptSession(value:JsonObject) = sessionMutex.withLock {
        val a=value["accessToken"]!!.jsonPrimitive.content
        val r=value["refreshToken"]!!.jsonPrimitive.content
        sessionStore?.write(if(options.autoLogin)r else null);access=a;refresh=r
    }
    override suspend fun clearSession() = sessionMutex.withLock { access=null;refresh=null;snapshots.clear();sessionStore?.write(null);Unit }
    override suspend fun restoreSession():Boolean = sessionMutex.withLock {
        if(!options.autoLogin){sessionStore?.write(null);return@withLock false}
        refresh=sessionStore?.read() ?: return@withLock false
        refreshLocked();true
    }
    private suspend fun refreshLocked() {
        val previous=refresh ?: throw ApiFailure("다시 로그인해 주세요.",401)
        try {
            val raw=json.parseToJsonElement(response(request("/auth/refresh",buildJsonObject{put("refreshToken",previous)}.toString()))).jsonObject
            val next=raw["refreshToken"]!!.jsonPrimitive.content
            sessionStore?.write(if(options.autoLogin)next else null);refresh=next;access=raw["accessToken"]!!.jsonPrimitive.content
        } catch(e:ApiFailure) { if(e.status==401) { access=null;refresh=null;sessionStore?.write(null) };throw e }
    }
    override suspend fun logoutCurrentSession() {
        // Upgrade legacy pre-session-id tokens before current-device revocation.
        sessionMutex.withLock { refreshLocked() }
        api("/auth/logout/current","POST",auth=true)
        clearSession()
    }
    override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement {
        val before=if(auth) access else null
        if(auth && before==null) throw ApiFailure("로그인이 필요합니다.",401)
        val text=try { response(request(path,body?.toString(),method,before)) }
        catch(e:ApiFailure) {
            if(!auth || e.status!=401) throw e
            sessionMutex.withLock { if(access==before) refreshLocked() }
            response(request(path,body?.toString(),method,access ?: throw ApiFailure("다시 로그인해 주세요.",401)))
        }
        return json.parseToJsonElement(text)
    }
    override fun imageUrl(value: String?): String? {
        if (value.isNullOrBlank()) return null
        if (value.startsWith("/api/media/tour-image?")) return endpoint(value).toString()
        val url = runCatching { value.toHttpUrl() }.getOrNull() ?: return null
        if (url.host == "tong.visitkorea.or.kr") {
            return endpoint("/api/media/tour-image").newBuilder().addQueryParameter("url", value).build().toString()
        }
        return value.takeIf { url.isHttps }
    }
}
