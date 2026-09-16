package kr.co.waboranggae.nativepilot
import android.graphics.Bitmap
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith
import java.io.File

/** Real Compose interactions, synthetic repository; no stored session or real user is touched. */
@RunWith(AndroidJUnit4::class)
class PrivacyConsentUiTest {
    @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
    private class ConsentRepository:TravelRepository by HttpTravelRepository("https://example.org","") {
        var accepted=0;var cleared=false
        private fun user()=buildJsonObject{put("id","synthetic-consent-ui");if(accepted>0){put("consentVersion",NOTICE_VERSION);put("consentedAt","2026-09-15T00:00:00Z")}}
        override suspend fun restoreSession()=true
        override suspend fun clearSession(){cleared=true}
        override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement=when(path){
            "/api/user/me"->user()
            "/auth/consent"->{Assert.assertTrue(body!!["privacyConsent"]!!.jsonPrimitive.boolean);accepted++;user()}
            "/auth/social/providers"->buildJsonObject{put("providers",JsonArray(emptyList()))}
            else->JsonArray(emptyList())
        }
    }
    private fun setup(repo:ConsentRepository) {
        lateinit var model:AccountViewModel
        ui.runOnUiThread{ui.activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);model=AccountViewModel(repo)}
        ui.setContent{WaboranggaeTheme{val state by model.state.collectAsState();if(state.needsConsent)AccountConsentScreen(state,model) else if(!state.checking)Text(if(state.user==null)"게스트 확인" else "동의 완료 확인")}}
        ui.waitUntil(15000){ui.onAllNodesWithTag("privacy-consent-page").fetchSemanticsNodes().isNotEmpty()}
    }
    @Test fun firstConsentRequiresAnUncheckedCheckboxAndSubmitsOnce(){
        val repo=ConsentRepository();setup(repo)
        ui.onNodeWithTag("privacy-agree-checkbox").performScrollTo().assertIsOff()
        ui.onNodeWithTag("privacy-agree-submit").performScrollTo().assertIsNotEnabled()
        val directory=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
        val shot=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
        File(directory,"06-first-privacy-consent.png").outputStream().use{shot.compress(Bitmap.CompressFormat.PNG,100,it)}
        ui.onNodeWithTag("privacy-agree-checkbox").performScrollTo().performClick()
        ui.onNodeWithTag("privacy-agree-submit").performScrollTo().assertIsEnabled().performClick()
        ui.waitUntil(15000){ui.onAllNodesWithText("동의 완료 확인").fetchSemanticsNodes().isNotEmpty()}
        Assert.assertEquals(1,repo.accepted)
    }
    @Test fun decliningConsentStillAllowsGuest(){
        val repo=ConsentRepository();setup(repo)
        ui.onNodeWithText("동의하지 않고 게스트로 이용").performScrollTo().performClick()
        ui.waitUntil(15000){ui.onAllNodesWithText("게스트 확인").fetchSemanticsNodes().isNotEmpty()}
        Assert.assertEquals(0,repo.accepted);Assert.assertTrue(repo.cleared)
    }
}
