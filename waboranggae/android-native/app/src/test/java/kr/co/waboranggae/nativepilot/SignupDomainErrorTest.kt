package kr.co.waboranggae.nativepilot

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kr.co.waboranggae.nativepilot.data.*
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class SignupDomainErrorTest {
    private fun failure(body:String,path:String="/auth/signup",status:Int=400):String?=runBlocking {
        val client=OkHttpClient.Builder().addInterceptor{chain->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(status).message("Failure").body(body.toResponseBody()).build()
        }.build()
        try { HttpTravelRepository("https://example.org","",client).api(path,"POST",buildJsonObject{});error("Expected failure") }
        catch(e:ApiFailure){e.message}
    }
    @Test fun signupShowsActionableDomainMessageWithoutEchoingServerDetails(){
        val text=failure("""{"code":"DISPOSABLE_EMAIL_DOMAIN","error":"internal-debug-details"}""")!!
        assertTrue(text.contains("일회용 이메일"));assertFalse(text.contains("internal-debug"))
    }
    @Test fun unrelatedResponsesKeepSafeGenericMessages(){
        for(body in listOf("not-json","""{"code":"OTHER","error":"internal-debug-details"}""", "x".repeat(3000))) {
            assertEquals("입력한 정보를 확인해 주세요.",failure(body))
        }
        assertFalse(failure("""{"code":"DISPOSABLE_EMAIL_DOMAIN"}""",path="/auth/login")!!.contains("일회용 이메일"))
        assertFalse(failure("""{"code":"DISPOSABLE_EMAIL_DOMAIN"}""",status=500)!!.contains("일회용 이메일"))
    }
}
