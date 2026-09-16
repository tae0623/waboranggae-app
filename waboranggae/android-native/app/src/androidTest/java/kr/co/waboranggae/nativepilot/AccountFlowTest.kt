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
/** Only a newly generated example.invalid fixture is created/deleted. No real account is used. */
@RunWith(AndroidJUnit4::class)
class AccountFlowTest {
    @get:Rule val ui=createAndroidComposeRule<MainActivity>()
    @Test fun emailLoginProfileAndLogout()=runBlocking {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        Assume.assumeTrue("Do not replace an existing user's session",SecureSession(context).read()==null)
        ui.runOnUiThread {ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
        val repo=HttpTravelRepository(BuildConfig.API_BASE_URL,BuildConfig.DEV_ACCESS_KEY)
        val optionsStore=SecureLoginOptions(context)
        val previousOptions=optionsStore.read()
        Assume.assumeTrue("Do not replace saved login preferences",previousOptions.email.isEmpty() && !previousOptions.autoLogin)
        val marker=UUID.randomUUID().toString()
        val email="native-test-$marker@example.invalid"
        val password="Test!Aa1-$marker"
        val created=repo.api("/auth/signup","POST",buildJsonObject{put("email",email);put("password",password);put("displayName","네이티브 검증");put("privacyConsent",true);put("consentVersion",kr.co.waboranggae.nativepilot.ui.NOTICE_VERSION)}).jsonObject
        repo.acceptSession(created)
        try {
            ui.runOnUiThread {ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
            ui.waitUntil(35000){ui.onAllNodesWithTag("login-page").fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithTag("login-email").performScrollTo().performTextInput(email)
            ui.onNodeWithTag("login-password").performScrollTo().performTextInput(password)
            ui.onNodeWithTag("remember-id").performScrollTo().performClick()
            ui.onNodeWithTag("auto-login").performScrollTo().performClick()
            ui.onNodeWithTag("login-submit").performScrollTo().performClick()
            ui.waitUntil(35000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithTag("privacy-consent-page").assertDoesNotExist() // Already consented: never ask again at login.
            Assert.assertTrue(optionsStore.read().autoLogin)
            Assert.assertEquals(email,optionsStore.read().email)
            Assert.assertNotNull(SecureSession(context).read())
            val restored=HttpTravelRepository(BuildConfig.API_BASE_URL,BuildConfig.DEV_ACCESS_KEY,sessionStore=SecureSession(context),loginOptionsStore=optionsStore)
            Assert.assertTrue(restored.restoreSession())
            Assert.assertEquals(created["user"]!!.jsonObject["id"],restored.api("/api/user/me",auth=true).jsonObject["id"])
            val start=repo.search("순천 종합버스터미널").first{it.name.contains("터미널")}
            val preferences=TravelForm(departure=start).preferences()
            val course=repo.recommend(preferences).courses.first{it.constraintPassed}
            repo.api("/api/user/bookmarks/add","POST",buildJsonObject{put("courseId",course.id);put("courseName",course.title);put("city",course.city);put("snapshot",repo.snapshot(course.id)!!)},true)
            val prefs=Json{encodeDefaults=true;explicitNulls=false}.encodeToJsonElement(preferences)
            val historyBody=buildJsonObject{put("query",preferences.summary);put("preferences",prefs)}
            try{repo.api("/api/user/search-history","POST",historyBody,true);Assert.fail("Missing save consent must be rejected")}catch(e:ApiFailure){Assert.assertEquals(400,e.status)}
            repo.api("/api/user/search-history","POST",JsonObject(historyBody+("saveConsent" to JsonPrimitive(true))),true)
            ui.onNodeWithTag("nav-MY_TRAVEL").performClick()
            ui.onNodeWithText("네이티브 검증 님").assertIsDisplayed()
            ui.waitUntil(35000){ui.onAllNodesWithText(course.title).fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithText(course.title).assertExists()
            ui.onNodeWithText(preferences.summary).assertExists()
            ui.onNodeWithTag("logout-current").performScrollTo().performClick()
            ui.waitUntil(35000){ui.onAllNodesWithTag("login-page").fetchSemanticsNodes().isNotEmpty()}
            Assert.assertNull(SecureSession(context).read())
            ui.onNodeWithTag("login-email").assertTextContains(email,substring=true)
            // Same restored session A is revoked; independent signup session B remains valid.
            try{restored.api("/api/user/me",auth=true);Assert.fail("Current session must be revoked")}catch(e:ApiFailure){Assert.assertEquals(401,e.status)}
            Assert.assertEquals(created["user"]!!.jsonObject["id"],repo.api("/api/user/me",auth=true).jsonObject["id"])
        } finally {
            // Reauthenticate only our generated fixture for cleanup, never an existing account.
            val auth=repo.api("/auth/login","POST",buildJsonObject{put("email",email);put("password",password)}).jsonObject
            repo.acceptSession(auth);repo.api("/api/user/me","DELETE",auth=true)
            SecureSession(context).write(null)
            optionsStore.write(previousOptions)
        }
    }
}
