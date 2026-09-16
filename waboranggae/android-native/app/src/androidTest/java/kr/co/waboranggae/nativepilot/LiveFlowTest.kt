package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import org.junit.Assert.assertNotEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Runs on an unlocked connected test phone; uses the real configured development API, never a fake course. */
@RunWith(AndroidJUnit4::class)
class LiveFlowTest {
    @get:Rule val ui=createAndroidComposeRule<MainActivity>()
    @Test fun homeToRealCoursesAndSecondMap() {
        try { runLiveFlow() } catch (failure: Throwable) {
            runCatching { if(ui.onAllNodesWithTag("departure-dropdown").fetchSemanticsNodes().isEmpty()) screenshot("99-failure") }
            throw failure
        }
    }
    private fun runLiveFlow() {
        // Only this instrumentation Activity stays awake; no phone setting is changed.
        ui.runOnUiThread { ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
        ui.waitUntil(35000) { ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty() || ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty() }
        if(ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithTag("guest-login").performScrollTo().performClick()
        ui.onNodeWithTag("home").assertIsDisplayed()
        ui.waitUntil(45000) { ui.onAllNodesWithTag("hot-place-card").fetchSemanticsNodes().isNotEmpty() }
        ui.waitUntil(25000) { ui.onAllNodes(hasTestTag("photo-loaded") and hasAnyAncestor(hasTestTag("hero-photo")),useUnmergedTree=true).fetchSemanticsNodes().isNotEmpty() }
        screenshot("01-home")
        ui.onAllNodesWithTag("hot-place-card")[0].performScrollTo().performClick()
        ui.onNodeWithTag("hot-place-detail").assertIsDisplayed()
        waitForPhoto()
        screenshot("01b-hot-place-detail")
        ui.onNodeWithTag("nav-HOME").performClick()
        ui.onNodeWithTag("plan-trip").performClick()
        ui.onNodeWithTag("departure-query").performTextReplacement("순천 종합버스터미널")
        ui.onNodeWithContentDescription("출발지 검색").performClick()
        ui.waitUntil(35000) {
            ui.onAllNodesWithTag("departure-result").fetchSemanticsNodes().isNotEmpty() ||
                ui.onAllNodesWithTag("departure-error").fetchSemanticsNodes().isNotEmpty()
        }
        ui.onNodeWithTag("departure-error").assertDoesNotExist()
        ui.onAllNodesWithTag("departure-result")[0].performScrollTo().performClick()
        ui.waitUntil(5000) { ui.onAllNodesWithTag("selected-departure").fetchSemanticsNodes().isNotEmpty() }
        ui.onNodeWithTag("selected-departure").assertTextContains("터미널",substring=true)
        screenshot("02-conditions")
        ui.onNodeWithTag("departure-search-map").performScrollTo()
        ui.waitUntil(25000){ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().isNotEmpty()}
        android.os.SystemClock.sleep(1800)
        screenshot("02a-selected-place-map")
        ui.onNodeWithTag("wizard-next").performClick()
        ui.onNodeWithTag("wizard-step").assertTextContains("2 / 4",substring=true)
        ui.onNodeWithTag("end-time-limit").performScrollTo().assertIsOff()
        ui.onNodeWithTag("travel-end-time").assertDoesNotExist()
        screenshot("02b-date-and-region")
        repeat(2){ui.onNodeWithTag("wizard-next").performClick()}
        ui.onNodeWithTag("wizard-step").assertTextContains("4 / 4",substring=true)
        screenshot("02c-transit")
        ui.onNodeWithTag("recommend").performClick()
        ui.waitUntil(140000) {
            ui.onAllNodesWithTag("results").fetchSemanticsNodes().isNotEmpty() ||
                ui.onAllNodesWithTag("recommend-error").fetchSemanticsNodes().isNotEmpty()
        }
        ui.onNodeWithTag("recommend-error").assertDoesNotExist()
        ui.onAllNodesWithText("실제 관광정보",substring=true)[0].assertExists()
        waitForPhoto()
        screenshot("03-results")
        ui.onAllNodesWithTag("course-routing-status",useUnmergedTree=true)[0].performScrollTo().assertTextContains("카카오 길찾기 확인",substring=true)
        ui.onAllNodesWithTag("course-card")[0].performClick()
        ui.onNodeWithTag("course-detail").assertIsDisplayed()
        ui.waitUntil(65000){ui.onAllNodesWithTag("routing-loading").fetchSemanticsNodes().isEmpty()}
        ui.onNodeWithTag("routing-source").assertTextContains("카카오",substring=true)
        screenshot("03b-course-detail")
        ui.onNodeWithTag("course-source-notice").performScrollTo().assertTextContains("장소: 한국관광공사·카카오",substring=true)
        val buttonBottom=ui.onNodeWithTag("confirm-course").fetchSemanticsNode().boundsInRoot.bottom
        val creditTop=ui.onNodeWithTag("course-source-notice").fetchSemanticsNode().boundsInRoot.top
        org.junit.Assert.assertTrue(creditTop>=buttonBottom)
        screenshot("09-course-source-footer")
        ui.onNodeWithTag("confirm-course").performScrollTo().performClick()
        ui.onNodeWithTag("map-page").assertIsDisplayed()
        val first=ui.onNodeWithTag("map-course-title").fetchSemanticsNode().config[androidx.compose.ui.semantics.SemanticsProperties.Text].joinToString()
        ui.onNodeWithTag("map-course-2").performClick()
        val second=ui.onNodeWithTag("map-course-title").fetchSemanticsNode().config[androidx.compose.ui.semantics.SemanticsProperties.Text].joinToString()
        assertNotEquals(first,second)
        ui.waitUntil(65000){ui.onAllNodesWithTag("routing-loading").fetchSemanticsNodes().isEmpty()}
        ui.waitUntil(25000) {
            ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().isNotEmpty() ||
                ui.onAllNodesWithTag("map-state-error").fetchSemanticsNodes().isNotEmpty() ||
                ui.onAllNodesWithTag("map-key-missing").fetchSemanticsNodes().isNotEmpty()
        }
        // The native GL surface finishes camera animation / tiles after onMapReady.
        android.os.SystemClock.sleep(4000)
        screenshot("04-second-course-map")
        val status=if(ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().isNotEmpty()) "SDK ready; visual tile inspection still required" else "Map not ready; inspect Kakao configuration or network"
        File(ui.activity.getExternalFilesDir(null),"native-pilot-screens/map-status.txt").writeText(status)
        ui.onNodeWithTag("map-state-ready").assertExists()
        ui.onNodeWithTag("map-state-error").assertDoesNotExist()
        ui.onNodeWithTag("map-stop-2").performScrollTo().performClick()
        ui.onNodeWithTag("map-place-info").performScrollTo()
        // Kakao-only entries can legitimately have no photo. Assert loading only when a photo exists.
        if(ui.onAllNodesWithTag("map-place-photo").fetchSemanticsNodes().isNotEmpty())waitForPhoto()
        ui.onNodeWithTag("kakao-directions").assertIsEnabled()
        screenshot("05-map-place-photo")
        ui.runOnUiThread { ui.activity.onBackPressedDispatcher.onBackPressed() }
        ui.onNodeWithTag("edit-course").performScrollTo().performClick()
        while(ui.onAllNodesWithTag("remove-course-place").fetchSemanticsNodes().size>1){
            val count=ui.onAllNodesWithTag("remove-course-place").fetchSemanticsNodes().size
            ui.onAllNodesWithTag("remove-course-place")[count-1].performScrollTo().performClick()
            ui.waitForIdle()
        }
        ui.onNodeWithTag("remove-course-place").assertIsNotEnabled()
        ui.onNodeWithTag("apply-course-edit").performScrollTo().performClick()
        ui.waitUntil(140000){ui.onAllNodesWithTag("course-detail").fetchSemanticsNodes().isNotEmpty()}
        screenshot("31-course-first-single-place")
        ui.onNodeWithTag("confirm-course").performScrollTo().performClick()
        ui.onNodeWithTag("map-stop-1").performScrollTo().assertExists()
        ui.onNodeWithTag("map-stop-2").assertDoesNotExist()
        ui.waitUntil(25000){ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().isNotEmpty()}
        android.os.SystemClock.sleep(2000)
        screenshot("32-course-first-single-map")
        // Authentication/rendering of Kakao's native map must also be inspected visually.
        // Merely finding the native view is deliberately NOT treated as successful map authentication.
    }
    private fun waitForPhoto() {
        ui.waitUntil(25000) { ui.onAllNodesWithTag("photo-loaded",useUnmergedTree=true).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun screenshot(name:String) {
        val directory=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
        // A whole-window test screenshot also captures Kakao's native rendering surface.
        ui.runOnUiThread { check(ui.activity.hasWindowFocus()) { "Test app is not foreground" } }
        ui.waitForIdle()
        android.os.SystemClock.sleep(200)
        val image=InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
            ?: ui.onRoot().captureToImage().asAndroidBitmap()
        File(directory,"$name.png").outputStream().use{image.compress(Bitmap.CompressFormat.PNG,100,it)}
    }
}
