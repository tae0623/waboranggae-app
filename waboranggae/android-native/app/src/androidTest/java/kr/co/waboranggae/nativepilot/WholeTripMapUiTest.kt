package kr.co.waboranggae.nativepilot
import android.graphics.Bitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kr.co.waboranggae.nativepilot.ui.*
import kr.co.waboranggae.nativepilot.data.*
import org.junit.*
import org.junit.runner.RunWith
import java.time.LocalDate
import java.time.ZoneId
import java.io.File

/** Public terminal, real API. No personal GPS, social account, or bookmark writes. */
@RunWith(AndroidJUnit4::class)
class WholeTripMapUiTest {
 @get:Rule val ui=createAndroidComposeRule<MainActivity>()
 private fun shot(name:String){
  ui.waitForIdle()
  fun appFocused():Boolean {
   val fd=InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("dumpsys window")
   val focus=android.os.ParcelFileDescriptor.AutoCloseInputStream(fd).bufferedReader().use{it.readLines().firstOrNull{line->line.contains("mCurrentFocus=")}}
   return focus?.contains(ui.activity.packageName+"/")==true
  }
  ui.waitUntil(5000){appFocused()}
  val bitmap=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
  val folder=File(ui.activity.getExternalFilesDir(null),"whole-trip-ui").apply{mkdirs()}
  File(folder,"$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
 }
 @Test fun twoDaysAreDistinctAndMapsExpandWithoutScrollReset()=runBlocking{
  ui.runOnUiThread{ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
  ui.waitUntil(35000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty()||ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty()}
  if(ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithTag("guest-login").performScrollTo().performClick()
  lateinit var vm:TravelViewModel;ui.runOnUiThread{vm=ViewModelProvider(ui.activity)[TravelViewModel::class.java]}
  val departure=vm.repository.search("광주종합버스터미널").first{it.name.contains("터미널") && it.latitude in 34.0..36.0}
  val date=LocalDate.now(ZoneId.of("Asia/Seoul"))
  ui.runOnUiThread{vm.chooseDeparture(departure);vm.chooseDestination("순천");vm.updateForm{it.copy(date=date.toString(),endDate=date.plusDays(1).toString(),limitEndTime=false)};vm.recommend()}
  ui.waitUntil(240000){!vm.state.value.loading&&vm.state.value.tripDays.isNotEmpty()}
  val state=vm.state.value
  Assert.assertEquals(state.error,2,state.courses.size);Assert.assertEquals(2,state.tripDays.size)
  val first=state.courses[0];val second=state.courses[1]
  Assert.assertTrue(first.places.map{it.id}.intersect(second.places.map{it.id}.toSet()).isEmpty())
  Assert.assertTrue(first.places.map{it.name}.intersect(second.places.map{it.name}.toSet()).isEmpty())
  Assert.assertNotNull(first.accessTrip);Assert.assertEquals(1,first.mapStops().first().index)
  Assert.assertNull(second.accessTrip)
  ui.onAllNodesWithTag("course-card")[0].performScrollTo().performClick();shot("01-detail")
  ui.onNodeWithTag("confirm-course").performClick()
  if(ui.onAllNodesWithText("저장 없이 여행하기").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithText("저장 없이 여행하기").performClick()
  ui.onNodeWithTag("map-page").assertIsDisplayed()
  ui.onAllNodesWithTag("map-expand")[0].performScrollTo()
  val before=ui.onAllNodesWithTag("native-kakao-map")[0].fetchSemanticsNode().id
  ui.onNodeWithText("DAY 2",substring=true).performScrollTo().assertIsDisplayed();shot("02-second-day")
  ui.onAllNodesWithTag("map-expand")[0].performScrollTo()
  Assert.assertEquals(before,ui.onAllNodesWithTag("native-kakao-map")[0].fetchSemanticsNode().id)
  ui.onAllNodesWithTag("map-expand")[1].performScrollTo().performClick()
  ui.onNodeWithTag("expanded-map").assertIsDisplayed()
  ui.waitUntil(30000){ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().size>=3}
  ui.onAllNodesWithTag("native-kakao-map").onLast().performTouchInput{swipeRight(durationMillis=450)}
  kotlinx.coroutines.delay(3000) // Allow provider tiles and the dialog animation to finish before visual capture.
  shot("03-expanded-map")
  ui.onNodeWithTag("map-collapse").performClick()
  ui.onNodeWithTag("expanded-map").assertDoesNotExist()
  ui.onAllNodesWithTag("map-expand")[0].performClick()
  ui.onNodeWithTag("expanded-map").assertIsDisplayed();kotlinx.coroutines.delay(3000);shot("04-reopened-map")
  ui.onNodeWithTag("map-collapse").performClick()
  ui.onNodeWithText("지도에서 보기").assertDoesNotExist()
 }
}
