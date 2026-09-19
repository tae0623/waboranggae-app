package kr.co.waboranggae.nativepilot

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/** Real WebView + Cloudflare + private API. Never clicks or solves a challenge.
 * If Cloudflare requires human interaction, the run stops for manual verification.
 * Uses one disposable synthetic account, never the phone owner's session. */
@RunWith(AndroidJUnit4::class)
class SignupBotLiveTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Test fun managedWidgetAndServerVerification()=runBlocking {
  val live=HttpTravelRepository(BuildConfig.API_BASE_URL,BuildConfig.DEV_ACCESS_KEY)
  val config=live.api("/auth/signup-config").jsonObject
  Assert.assertEquals(true,config["required"]?.jsonPrimitive?.boolean)
  Assert.assertEquals(true,config["available"]?.jsonPrimitive?.boolean)
  val token=AtomicReference("")
  ui.setContent{WaboranggaeTheme{SignupBotCheck(onDismiss={},onVerified={token.set(it)})}}
  // Only the widget itself may automatically verify this device. No CAPTCHA clicks.
  ui.waitUntil(45000){token.get().isNotEmpty()}
  val marker=UUID.randomUUID().toString()
  val email="bot-check-$marker@example.invalid"
  val password="fixture!9-$marker"
  var createdId:String?=null
  try{
   val auth=live.api("/auth/signup","POST",buildJsonObject{
    put("email",email);put("password",password);put("displayName","자동가입방지 검증")
    put("privacyConsent",true);put("ageConfirmed",true);put("consentVersion",NOTICE_VERSION);put("botToken",token.getAndSet(""))
   }).jsonObject
   Assert.assertNull(auth["user"]!!.jsonObject["password"])
   createdId=auth["user"]!!.jsonObject.text("id")
   live.acceptSession(auth)
   Assert.assertEquals(createdId,live.api("/api/user/me",auth=true).jsonObject.text("id"))
   println("BOT_LIVE_VERIFIED: native_widget=true server_signup=true kakao_calls=0")
  }finally{
   if(createdId!=null){
    val own=live.api("/api/user/me",auth=true).jsonObject
    Assert.assertEquals(createdId,own.text("id"));Assert.assertEquals(email,own.text("email"))
    live.api("/api/user/me","DELETE",auth=true)
    live.clearSession()
    println("BOT_LIVE_CLEANUP: temporary_account_deleted=true")
   }
  }
 }
}
