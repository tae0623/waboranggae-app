package kr.co.waboranggae.nativepilot

import kotlinx.coroutines.runBlocking
import kr.co.waboranggae.nativepilot.data.*
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class RequiredVisitErrorTest {
 private val preferences=TravelForm(city="순천",departure=PlaceSuggestion("public","순천역","전남 순천시",34.95,127.5)).preferences()
 private fun failure(body:String,status:Int=422):String?=runBlocking {
  val client=OkHttpClient.Builder().addInterceptor{chain->Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(status).message("Failure").body(body.toResponseBody()).build()}.build()
  try{HttpTravelRepository("https://example.org","",client).recommend(preferences);error("Expected failure")}
  catch(e:ApiFailure){e.message}
 }
 @Test fun explicitSafeVenueMessageIsShown(){
  assertEquals("행사 기간에 방문해 주세요.",failure("""{"code":"REQUIRED_VISIT","error":"행사 기간에 방문해 주세요."}"""))
 }
 @Test fun unrelatedAndOversizedServerMessagesAreNotShown(){
  assertFalse(failure("""{"code":"UNKNOWN","error":"internal-debug-details"}""")!!.contains("internal-debug"))
  assertFalse(failure("""{"code":"REQUIRED_VISIT","error":"${"x".repeat(241)}"}""")!!.contains("xxxx"))
  assertFalse(failure("""{"code":"REQUIRED_VISIT","error":"internal-debug-details"}""",500)!!.contains("internal-debug"))
 }
}
