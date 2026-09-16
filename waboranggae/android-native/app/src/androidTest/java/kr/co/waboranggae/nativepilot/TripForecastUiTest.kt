package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kr.co.waboranggae.nativepilot.ui.TravelViewModel
import org.junit.*
import org.junit.runner.RunWith
import java.io.File
import java.time.LocalDate
import java.time.ZoneId

/** Seeds tomorrow in the real Activity's form, then checks real API date-to-display wiring (not the date picker). */
@RunWith(AndroidJUnit4::class)
class TripForecastUiTest {
    @get:Rule val ui=createAndroidComposeRule<MainActivity>()
    @Test fun tomorrowForecastAppearsOnConfirmedJourney():Unit=runBlocking {
        ui.runOnUiThread{ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
        ui.waitUntil(35000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty() || ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty()}
        if(ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithTag("guest-login").performScrollTo().performClick()
        lateinit var vm:TravelViewModel
        ui.runOnUiThread{vm=ViewModelProvider(ui.activity)[TravelViewModel::class.java]}
        val date=LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(1).toString()
        val departure=vm.repository.search("순천 종합버스터미널").first{it.name.contains("터미널")}
        ui.runOnUiThread{vm.chooseDeparture(departure);vm.chooseDestination("순천");vm.updateForm{it.copy(date=date,endDate=date,startTime="10:00",hours=6)};vm.recommend()}
        ui.waitUntil(140000){ui.onAllNodesWithTag("results").fetchSemanticsNodes().isNotEmpty()}
        ui.onAllNodesWithTag("course-card")[0].performClick()
        ui.onNodeWithTag("trip-forecast").assertDoesNotExist()
        ui.runOnUiThread{vm.confirmTravel(requireNotNull(vm.state.value.selectedCourse).id)}
        ui.waitUntil(45000){ui.onAllNodesWithTag("trip-forecast").fetchSemanticsNodes().isNotEmpty()}
        ui.onNodeWithTag("trip-forecast").performScrollTo().assertExists()
        Assert.assertEquals(date,vm.state.value.weatherDate)
        ui.onNodeWithTag("trip-forecast-unavailable").assertDoesNotExist()
        ui.waitForIdle()
        val image=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
        val folder=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
        File(folder,"07-trip-forecast.png").outputStream().use{image.compress(Bitmap.CompressFormat.PNG,100,it)}
    }
}
