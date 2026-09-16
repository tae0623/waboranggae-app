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

/** The user's departure is supplied at runtime, never committed to source or saved in screenshots. */
@RunWith(AndroidJUnit4::class)
class IntercityAutocompleteUiTest {
    @get:Rule val ui=createAndroidComposeRule<MainActivity>()
    @Test fun autocompleteToIntercityCourseAndMap(){
        val query=requireNotNull(InstrumentationRegistry.getArguments().getString("departureQuery")){"departureQuery argument required"}
        ui.runOnUiThread{ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
        ui.waitUntil(35000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty()||ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty()}
        if(ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithTag("guest-login").performScrollTo().performClick()
        ui.onNodeWithTag("plan-trip").performScrollTo().performClick()
        ui.onNodeWithTag("departure-query").assert(SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.EditableText,androidx.compose.ui.text.AnnotatedString("")))
        ui.onNodeWithTag("departure-query").performTextReplacement(query)
        // Deliberately do not tap search or send the IME search action.
        ui.waitUntil(35000){ui.onAllNodesWithTag("departure-result").fetchSemanticsNodes().isNotEmpty()}
        if(InstrumentationRegistry.getArguments().getString("expectNearby")=="true"){
            ui.waitUntil(24000){ui.onAllNodesWithText("정확도 우선 · 비슷한 결과는 가까운 순").fetchSemanticsNodes().isNotEmpty()}
            ui.onNodeWithTag("departure-sort-label").assertTextEquals("정확도 우선 · 비슷한 결과는 가까운 순")
        }
        ui.onAllNodesWithTag("departure-result")[0].performScrollTo().performClick()
        ui.onNodeWithTag("selected-departure").assertExists()
        lateinit var vm:TravelViewModel
        ui.runOnUiThread{vm=ViewModelProvider(ui.activity)[TravelViewModel::class.java];vm.chooseDestination("나주");vm.updateForm{it.copy(endTime="18:00",startTime="10:00")}}
        repeat(3){ui.onNodeWithTag("wizard-next").performClick()}
        ui.onNodeWithTag("recommend").performClick()
        ui.waitUntil(140000){ui.onAllNodesWithTag("results").fetchSemanticsNodes().isNotEmpty()}
        Assert.assertTrue(vm.state.value.courses.size in 1..3)
        Assert.assertTrue(vm.state.value.courses.all{it.routeSource=="kakao" && it.routingCheckedAt!=null})
        ui.onAllNodesWithTag("course-card")[0].performClick()
        ui.onNodeWithTag("routing-loading").assertDoesNotExist()
        ui.waitUntil(65000){ui.onAllNodesWithTag("routing-loading").fetchSemanticsNodes().isEmpty()}
        ui.onNodeWithTag("route-constraint-warning").assertDoesNotExist()
        val course=requireNotNull(vm.state.value.selectedCourse);val time=requireNotNull(course.timeBreakdown)
        Assert.assertTrue(course.constraintPassed);Assert.assertTrue(time.totalMinutes>0)
        Assert.assertEquals("local",course.timeBudgetMode);Assert.assertNotNull(course.accessTrip);Assert.assertTrue(course.accessTrip!!.excludedFromBudget);Assert.assertEquals(0,time.overBudgetMinutes)
        Assert.assertEquals(time.totalMinutes,time.originToFirstMinutes+time.betweenPlacesMinutes+time.stayMinutes+time.waitAndRestMinutes)
        ui.onNodeWithTag("access-trip").performScrollTo().assertExists()
        ui.waitForIdle()
        val folder=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
        val screenshot=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
        File(folder,"08-intercity-time-breakdown.png").outputStream().use{screenshot.compress(Bitmap.CompressFormat.PNG,100,it)}
        ui.onNodeWithTag("confirm-course").performScrollTo().assertIsEnabled().performClick()
        ui.onNodeWithTag("map-page").assertIsDisplayed()
        ui.waitUntil(25000){ui.onAllNodesWithTag("map-state-ready").fetchSemanticsNodes().isNotEmpty()}
    }
}
