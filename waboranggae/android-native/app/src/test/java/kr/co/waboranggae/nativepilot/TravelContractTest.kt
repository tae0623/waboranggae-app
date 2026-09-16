package kr.co.waboranggae.nativepilot

import kr.co.waboranggae.nativepilot.data.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class TravelContractTest {
    @Test fun sixComponentWalkingScoreIsPreservedFromServer() {
        val raw="""{"id":"score-check","city":"순천","title":"실제 서버 점수 계약","durationHours":6,"distanceKm":3.5,"walkMinutes":37,"transitMinutes":10,"places":[],"walkingScore":81,"fitScore":73,"walkingBreakdown":{"walk":63,"transit":87,"time":87,"transfer":100,"distance":81,"efficiency":100}}"""
        val course=Json { ignoreUnknownKeys=true }.decodeFromString<kr.co.waboranggae.nativepilot.data.Course>(raw)
        assertEquals(81.0,course.walkingScore,0.0);assertEquals(73.0,course.fitScore,0.0)
        val b=requireNotNull(course.walkingBreakdown)
        assertEquals(listOf(63.0,87.0,87.0,100.0,81.0,100.0),listOf(b.walk,b.transit,b.time,b.transfer,b.distance,b.efficiency))
    }
    private val terminal=PlaceSuggestion("terminal","순천종합버스터미널","전남 순천시 장천3길",34.94561,127.49713)
    @Test fun typedPlaceIsNotAResolvedDeparture() {
        assertNotNull(TravelForm(query="순천역").validationError())
    }
    @Test fun exactTerminalCoordinatesAreSent() {
        val p=TravelForm(departure=terminal,startType="terminal").preferences()
        assertEquals("terminal",p.startType); assertEquals(terminal.name,p.startLocation)
        assertEquals(terminal.latitude,p.startLatitude,0.00000001)
        assertEquals(terminal.longitude,p.startLongitude,0.00000001)
        assertEquals("course-first",p.scheduleMode);assertNull(p.endTime)
    }
    @Test fun shortTripKeepsCafeAndFoodChoices() {
        val p=TravelForm(departure=terminal,endTime="12:00",limitEndTime=true,interests=setOf("food","cafe")).preferences()
        assertEquals(listOf("cafe","food"),p.interests)
        assertTrue(p.publicTransportOnly)
    }
    @Test fun emptyInterestsAreRejected() {
        assertNotNull(TravelForm(departure=terminal,interests=emptySet()).validationError())
    }
    @Test fun removedCompanionIsNeutralButWalkingAndTransitChoicesReachAPI() {
        val p=TravelForm(departure=terminal,companion="가족과 함께",lowMobility=true,transitModes=setOf("bus","train")).preferences()
        assertEquals("혼자",p.companions);assertTrue(p.lowMobility)
        assertEquals(listOf("bus","train"),p.preferredTransit)
        assertNotNull(TravelForm(departure=terminal,transitModes=emptySet()).validationError())
    }
    @Test fun hotPlaceResponseDecodesAndUsesAuthenticatedAPI()=runBlocking {
        val body="""{"places":[{"id":"tour:1","name":"전남 축제","city":"담양","visitors":0,"img":"/api/media/tour-image?url=x","periodShort":"9.15~9.20","unknownFutureField":true}],"source":"tour-api","fetchedAt":"2026-09-15"}"""
        var apiPath:String?=null
        val client=OkHttpClient.Builder().addInterceptor { chain->
            apiPath=chain.request().url.encodedPath
            assertEquals("test-only",chain.request().header("X-Dev-Access-Key"))
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK").body(body.toResponseBody()).build()
        }.build()
        val payload=HttpTravelRepository("https://example.com","test-only",client).hotPlaces()
        assertEquals("/api/hot-places",apiPath)
        assertEquals("담양",payload.places.single().city);assertEquals("9.15~9.20",payload.places.single().periodShort)
    }
    @Test fun overnightIsNotSilentlyWrapped() {
        assertNotNull(TravelForm(departure=terminal,startTime="20:00",limitEndTime=true).validationError())
    }
    @Test fun invalidCoordinatesAreRejected() {
        assertNotNull(TravelForm(departure=terminal.copy(latitude=Double.NaN)).validationError())
    }
    @Test fun requestPreservesAPIEnvelope() {
        val text=Json.encodeToString(RecommendRequest(TravelForm(departure=terminal).preferences()))
        assertTrue(text.startsWith("{\"preferences\":"));assertTrue(text.contains("\"startLatitude\""))
    }
    @Test fun actualRepositorySendsServerRequiredDefaults() = runBlocking {
        var sent: String? = null
        val fixture=javaClass.getResourceAsStream("/recommend-response.json")!!.bufferedReader().use{it.readText()}
        val client=OkHttpClient.Builder().addInterceptor { chain ->
            val buffer=okio.Buffer()
            chain.request().body!!.writeTo(buffer)
            sent=buffer.readUtf8()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("OK").body(fixture.toResponseBody()).build()
        }.build()
        HttpTravelRepository("https://example.com","",client).recommend(TravelForm(departure=terminal).preferences())
        val p=Json.parseToJsonElement(requireNotNull(sent)).jsonObject.getValue("preferences").jsonObject
        assertEquals("전라남도",p.getValue("region").jsonPrimitive.content)
        assertEquals("혼자",p.getValue("companions").jsonPrimitive.content)
        assertEquals("false",p.getValue("lowMobility").jsonPrimitive.content)
        assertEquals("true",p.getValue("publicTransportOnly").jsonPrimitive.content)
        assertEquals("1.0",p.getValue("confidence").jsonPrimitive.content)
        assertEquals("course-first",p.getValue("scheduleMode").jsonPrimitive.content)
        assertFalse(p.containsKey("endTime"))
    }
    @Test fun realServerResponseDecodesWithoutLosingOrigin() {
        val stream=javaClass.getResourceAsStream("/recommend-response.json")!!
        val payload=Json { ignoreUnknownKeys=true }.decodeFromString<RecommendPayload>(stream.bufferedReader().use{it.readText()})
        val courses=acceptedCourses(payload)
        assertTrue(courses.size>1)
        courses.forEach { course ->
            assertEquals("순천종합버스터미널",course.mapStops().first().name)
            assertEquals(6.0,course.durationHours,0.01)
            assertEquals(course.origin!!.latitude,course.mapStops().first().coordinate.latitude,0.00000001)
        }
        assertNotEquals(courses[0].places.map{it.id},courses[1].places.map{it.id})
    }
    @Test fun demoPayloadIsNeverAcceptedAsReal() {
        assertThrows(IllegalArgumentException::class.java) { acceptedCourses(RecommendPayload(emptyList(),"demo")) }
    }
    @Test fun kakaoAndMixedSourcesUseTheSameValidationAsTourApi() {
        val stream=javaClass.getResourceAsStream("/recommend-response.json")!!
        val payload=Json { ignoreUnknownKeys=true }.decodeFromString<RecommendPayload>(stream.bufferedReader().use{it.readText()})
        val expected=acceptedCourses(payload)
        listOf("kakao","mixed").forEach { source -> assertEquals(expected,acceptedCourses(payload.copy(source=source))) }
        assertThrows(IllegalArgumentException::class.java) { acceptedCourses(payload.copy(source="unknown")) }
    }
    @Test fun invalidCourseDoesNotAppear() {
        val invalid=Course("bad","순천","bad",durationHours=6.0,walkMinutes=0,transitMinutes=0,places=emptyList(),constraintPassed=false)
        assertTrue(acceptedCourses(RecommendPayload(listOf(invalid),"tour-api")).isEmpty())
    }
    @Test fun nonHttpsApiIsRejected() {
        assertThrows(IllegalArgumentException::class.java) { HttpTravelRepository("http://example.com","") }
    }
    @Test fun touristImagesUseProxyWithoutPrivateHeadersInUrl() {
        val repository=HttpTravelRepository("https://example.com","private-test-only")
        val url=repository.imageUrl("http://tong.visitkorea.or.kr/cms/resource/12/image.jpg")!!
        assertTrue(url.startsWith("https://example.com/api/media/tour-image?"));assertFalse(url.contains("private-test-only"))
        assertNull(repository.imageUrl("file:///etc/passwd"))
        assertNull(repository.imageUrl("http://insecure.example.com/img.jpg"))
    }
}
