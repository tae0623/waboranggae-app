package kr.co.waboranggae.nativepilot
import kr.co.waboranggae.nativepilot.data.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.*
import org.junit.Test
class SessionContractTest {
    @Test fun debugImageKeyStaysOnExactApiImageEndpoint() {
        val base="https://example.org/functions/v1/waboranggae-api".toHttpUrl()
        assertTrue(mayAttachDebugImageKey(base,(base.toString()+"/api/media/tour-image?url=x").toHttpUrl()))
        for(url in listOf("https://other.org/api/media/tour-image","http://example.org/functions/v1/waboranggae-api/api/media/tour-image",
            "https://example.org/api/media/tour-image","https://example.org/functions/v1/another/api/media/tour-image",
            "https://example.org/functions/v1/waboranggae-api/auth/login")){
            assertFalse(mayAttachDebugImageKey(base,url.toHttpUrl()))
        }
    }
    @Test fun edgeBasePathIsKeptForApiAndImages()=runBlocking {
        val prefix="/functions/v1/waboranggae-api"
        val client=OkHttpClient.Builder().addInterceptor{chain->
            val request=chain.request()
            assertEquals(prefix+"/api/places/search",request.url.encodedPath)
            Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(200).message("test").body("{}".toResponseBody()).build()
        }.build()
        val repo=HttpTravelRepository("https://example.org"+prefix,"",client)
        repo.api("/api/places/search?q=test")
        assertEquals("https://example.org"+prefix+"/api/media/tour-image?url=test",repo.imageUrl("/api/media/tour-image?url=test"))
    }
    private class MemoryStore:SessionStore { var value:String?=null;override fun read()=value;override fun write(refresh:String?){value=refresh} }
    @Test fun onlyRefreshPersistsAndUnauthorizedRequestRenews()=runBlocking {
        val store=MemoryStore();var refreshCalls=0;var protectedCalls=0
        val client=OkHttpClient.Builder().addInterceptor{chain->
            val request=chain.request()
            val (code,body)=if(request.url.encodedPath=="/auth/refresh") {
                refreshCalls++;assertNull(request.header("Authorization"));200 to """{"accessToken":"access-new","refreshToken":"refresh-new"}"""
            } else {
                protectedCalls++
                if(request.header("Authorization")=="Bearer access-new")200 to "{}" else 401 to "{}"
            }
            Response.Builder().request(request).protocol(Protocol.HTTP_1_1).code(code).message("test").body(body.toResponseBody()).build()
        }.build()
        val repo=HttpTravelRepository("https://example.org","dev",client,store)
        repo.setLoginOptions(LoginOptions(autoLogin=true))
        repo.acceptSession(buildJsonObject{put("accessToken","access-old");put("refreshToken","refresh-old")})
        assertEquals("refresh-old",store.value)
        repo.api("/api/user/me",auth=true)
        assertEquals(1,refreshCalls);assertEquals(2,protectedCalls);assertEquals("refresh-new",store.value)
        repo.clearSession();assertNull(store.value)
        try{repo.api("/api/user/me",auth=true);fail("Guest must not call account API")}catch(e:ApiFailure){assertEquals(401,e.status)}
    }
    @Test fun rawSnapshotRetainsServerFieldsForExplanationAndSaving() {
        val json=Json.parseToJsonElement(javaClass.getResourceAsStream("/recommend-response.json")!!.bufferedReader().use{it.readText()}).jsonObject
        val raw=json["courses"]!!.jsonArray[0].jsonObject
        val repo=HttpTravelRepository("https://example.org","")
        val c=repo.rememberCourse(raw)
        assertEquals(raw,repo.snapshot(c.id))
        assertTrue(repo.snapshot(c.id)!!.containsKey("scoreBreakdown"))
    }
    @Test fun legacyMultiDayAndCompanionFieldsAreRemovedWithoutChangingOrigin() {
        val terminal=PlaceSuggestion("1","터미널","주소",34.9,127.5)
        val lodging=terminal.copy(id="hotel",name="선택 숙소",latitude=34.91)
        val old=TravelForm(departure=terminal,date="2026-10-01",startTime="10:00",endDate="2026-10-02",endTime="18:00",limitEndTime=true,lodging=lodging,companion="가족과 함께",interests=setOf("photo"),meals=setOf("breakfast","dinner"))
        assertNotNull(old.validationError())
        val form=old.forCurrentApp().normalizeMeals()
        assertNull(form.validationError())
        val p=form.preferences()
        assertEquals(8.0,p.durationHours,0.0);assertEquals("2026-10-01",p.travelEndDate)
        assertEquals("터미널",p.startLocation);assertEquals("혼자",p.companions)
        assertNull(p.lodgingName);assertNull(p.lodgingLatitude);assertNull(p.lodgingLongitude)
        assertEquals(listOf("nature"),p.interests);assertEquals(emptyList<String>(),p.meals)
    }
}
