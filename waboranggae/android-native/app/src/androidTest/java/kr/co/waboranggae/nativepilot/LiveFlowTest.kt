package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kr.co.waboranggae.nativepilot.ui.TravelViewModel
import org.junit.*
import org.junit.runner.RunWith
import java.io.File

/** Real public POIs and configured API; no personal location or account credentials are entered. */
@RunWith(AndroidJUnit4::class)
class LiveFlowTest {
 @get:Rule val ui=createAndroidComposeRule<MainActivity>()
 private fun shot(name:String){
  ui.waitForIdle()
  ui.runOnUiThread{check(ui.activity.hasWindowFocus()){"Unlock and foreground the test app"}}
  val bitmap=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
  val folder=File(ui.activity.getExternalFilesDir(null),"restored-ui").apply{mkdirs()}
  File(folder,"$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
 }
 @Test fun newFlowUsesOneConfirmedCourseAndEmbeddedMap(){
  ui.runOnUiThread{ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
  ui.waitUntil(35000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty()||ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty()}
  if(ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithTag("guest-login").performScrollTo().performClick()
  ui.onNodeWithTag("home").assertIsDisplayed();shot("01-home")
  ui.onNodeWithTag("plan-trip").performClick()
  ui.onNodeWithTag("departure-query").performTextReplacement("순천 종합버스터미널")
  ui.onNodeWithContentDescription("출발지 검색").performClick()
  ui.waitUntil(35000){ui.onAllNodesWithTag("departure-result").fetchSemanticsNodes().isNotEmpty()}
  ui.onAllNodesWithTag("departure-result")[0].performScrollTo().performClick()
  ui.onNodeWithTag("departure-search-map").performScrollTo()
  ui.waitUntil(25000){ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().isNotEmpty()}
  ui.onNodeWithTag("wizard-next").performClick()
  ui.onNodeWithTag("destination-city").performScrollTo().performClick()
  ui.onNodeWithText("순천",useUnmergedTree=true).performScrollTo().performClick()
  ui.onNodeWithTag("end-time-limit").performScrollTo().assertIsOff();shot("02-destination")
  repeat(2){ui.onNodeWithTag("wizard-next").performClick()}
  ui.onNodeWithTag("recommend").performClick()
  ui.waitUntil(140000){ui.onAllNodesWithTag("results").fetchSemanticsNodes().isNotEmpty()||ui.onAllNodesWithTag("recommend-error").fetchSemanticsNodes().isNotEmpty()}
  ui.onNodeWithTag("recommend-error").assertDoesNotExist()
  lateinit var vm:TravelViewModel
  ui.runOnUiThread{vm=ViewModelProvider(ui.activity)[TravelViewModel::class.java]}
  Assert.assertTrue(vm.state.value.courses.isNotEmpty())
  ui.onNodeWithText("추천순").assertDoesNotExist();shot("03-results")
  val index=if(vm.state.value.courses.size>1)1 else 0
  val chosen=vm.state.value.courses[index].id
  ui.onAllNodesWithTag("course-card")[index].performScrollTo().performClick()
  ui.onNodeWithTag("course-detail").assertIsDisplayed()
  ui.onNodeWithTag("trip-forecast").assertDoesNotExist();shot("04-detail")
  ui.onNodeWithText("점수 분석").performScrollTo().performClick()
  ui.onNodeWithTag("walking-score-stars").performScrollTo().assertExists();shot("05-stars")
  ui.onNodeWithTag("confirm-course").performClick()
  if(ui.onAllNodesWithText("저장 없이 여행하기").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithText("저장 없이 여행하기").performClick()
  ui.onNodeWithTag("map-page").assertIsDisplayed()
  Assert.assertEquals(chosen,vm.state.value.confirmedId)
  ui.onNodeWithTag("map-course-2").assertDoesNotExist()
  ui.onNodeWithTag("trip-forecast").assertExists()
  ui.onNodeWithTag("native-kakao-map").performScrollTo()
  ui.waitUntil(25000){ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().isNotEmpty()}
  android.os.SystemClock.sleep(2500);shot("06-map")
  ui.onNodeWithTag("map-stop-1").assertDoesNotExist()
 }
}
