package kr.co.waboranggae.nativepilot

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import org.junit.*
import org.junit.runner.RunWith
import java.util.UUID

/** Real UI + real configured API. Only this newly generated synthetic account is deleted. */
@RunWith(AndroidJUnit4::class)
class SignupFlowTest {
    @get:Rule val ui=createAndroidComposeRule<MainActivity>()
    @Test fun signupConsentLoginAndLogout()=runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        Assume.assumeTrue("Preserve an existing user session",SecureSession(context).read()==null)
        ui.runOnUiThread{ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
        val marker=UUID.randomUUID().toString()
        val email="native-signup-$marker@example.invalid"
        val password="Test!Aa1-$marker"
        val repo=HttpTravelRepository(BuildConfig.API_BASE_URL,BuildConfig.DEV_ACCESS_KEY)
        try {
            ui.waitUntil(35000){ui.onAllNodesWithTag("login-page").fetchSemanticsNodes().isNotEmpty()}
            ui.waitUntil(20000){ui.onAllNodes(hasTestTag("social-kakao") and isEnabled()).fetchSemanticsNodes().isNotEmpty() && ui.onAllNodes(hasTestTag("social-google") and isEnabled()).fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithTag("social-kakao").assertIsEnabled()
            ui.onNodeWithTag("social-google").assertIsEnabled()
            ui.onNodeWithText("회원가입").performScrollTo().performClick()
            ui.onNodeWithTag("signup-name").performScrollTo().performTextInput("회원가입 검증")
            ui.onNodeWithTag("login-email").performScrollTo().performTextInput(email)
            ui.onNodeWithTag("login-password").performScrollTo().performTextInput(password)
            ui.onNodeWithTag("login-submit").performScrollTo().assertIsNotEnabled()
            ui.onNodeWithTag("signup-consent").performScrollTo().assertIsOff().performClick()
            ui.onNodeWithTag("login-submit").performScrollTo().assertIsEnabled().performClick()
            ui.waitUntil(45000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithTag("privacy-consent-page").assertDoesNotExist()
            ui.onNodeWithTag("nav-MY_TRAVEL").performClick()
            ui.onNodeWithText("회원가입 검증 님").assertIsDisplayed()
            // Account lists are still loading immediately after signup; wait for the real button to become enabled.
            ui.waitUntil(35000){ui.onAllNodes(hasText("모든 기기에서 로그아웃") and isEnabled()).fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithText("모든 기기에서 로그아웃").performScrollTo().performClick()
            ui.waitUntil(35000){ui.onAllNodesWithTag("login-page").fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithTag("login-email").performScrollTo().performTextInput(email)
            ui.onNodeWithTag("login-password").performScrollTo().performTextInput(password)
            ui.onNodeWithTag("login-submit").performScrollTo().performClick()
            ui.waitUntil(35000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithTag("privacy-consent-page").assertDoesNotExist()
            ui.onNodeWithTag("nav-MY_TRAVEL").performClick()
            ui.waitUntil(35000){ui.onAllNodes(hasText("모든 기기에서 로그아웃") and isEnabled()).fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithText("모든 기기에서 로그아웃").performScrollTo().performClick()
            ui.waitUntil(35000){ui.onAllNodesWithTag("login-page").fetchSemanticsNodes().isNotEmpty()}
            Assert.assertNull(SecureSession(context).read())
        } finally {
            // No credentials from the real user or persistent demo account are used here.
            try {
                val result=repo.api("/auth/login","POST",buildJsonObject{put("email",email);put("password",password)}).jsonObject
                repo.acceptSession(result);repo.api("/api/user/me","DELETE",auth=true)
            } catch(e:ApiFailure) { if(e.status!=401)throw e }
            SecureSession(context).write(null)
        }
    }
}
