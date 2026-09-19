package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kr.co.waboranggae.nativepilot.data.HttpTravelRepository
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith
import java.io.File
import java.time.LocalDate

/** Store captures of current production composables. No fake POIs/results, GPS,
 * stored accounts or Kakao search/routing calls. Only public cities/home feed. */
@RunWith(AndroidJUnit4::class)
class StoreAssetsCaptureTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private fun shot(name:String){
  ui.waitForIdle()
  ui.runOnUiThread{check(ui.activity.hasWindowFocus()){"Unlock and foreground the capture activity"}}
  val bitmap=ui.onNodeWithTag("store-capture-root").captureToImage().asAndroidBitmap()
  val folder=File(ui.activity.getExternalFilesDir(null),"onestore-captures").apply{mkdirs()}
  File(folder,"$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
 }
 @Test fun captureCurrentPublicScreens(){
  lateinit var vm:TravelViewModel
  var screen by mutableIntStateOf(0)
  ui.runOnUiThread{vm=TravelViewModel(HttpTravelRepository(BuildConfig.API_BASE_URL,""))}
  ui.setContent{WaboranggaeTheme{
   val state by vm.state.collectAsState()
   Scaffold(modifier=Modifier.testTag("store-capture-root"),containerColor=Soft,
    bottomBar={if(screen==0)WebBottomBar(Page.HOME){}}){padding->
    Box(Modifier.fillMaxSize().padding(padding)){
     if(screen==0)WebHome(state,vm) else WebWizard(state.copy(wizardStep=screen),vm)
    }
   }
  }}
  ui.waitUntil(50000){vm.state.value.cities.isNotEmpty()&&!vm.state.value.hotLoading}
  Assert.assertNull(vm.state.value.hotError)
  ui.onNodeWithTag("plan-trip").assertIsDisplayed()
  // Let actual image requests finish; no extra API generation or account calls.
  android.os.SystemClock.sleep(3500)
  shot("01-home")
  ui.runOnUiThread{vm.chooseDestination("순천");vm.updateForm{it.copy(date=LocalDate.now().plusDays(7).toString(),endDate=LocalDate.now().plusDays(7).toString())};screen=2}
  ui.onNodeWithTag("destination-city").assertIsDisplayed();shot("02-plan")
  ui.onNodeWithTag("trip-date-range").performClick()
  ui.waitForIdle();android.os.SystemClock.sleep(500)
  val calendar=androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot()
  requireNotNull(calendar).let{bitmap->val folder=File(ui.activity.getExternalFilesDir(null),"onestore-captures");File(folder,"03-calendar-device.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}}
  // Dismiss only this app's date dialog; no device settings or permissions touched.
  ui.onNodeWithText("취소").performClick()
  ui.runOnUiThread{screen=3};ui.waitForIdle();shot("04-pace")
  ui.runOnUiThread{screen=4};ui.waitForIdle();shot("05-interests")
 }
}
