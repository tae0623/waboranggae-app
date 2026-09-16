package kr.co.waboranggae.nativepilot
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
@RunWith(AndroidJUnit4::class)
class HomeExitUiTest {
    @get:Rule val ui=createAndroidComposeRule<MainActivity>()
    @Test fun backShowsExitAndCancelKeepsHome(){
        ui.runOnUiThread{ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
        ui.waitUntil(35000){ui.onAllNodesWithTag("home").fetchSemanticsNodes().isNotEmpty()||ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty()}
        if(ui.onAllNodesWithTag("guest-login").fetchSemanticsNodes().isNotEmpty())ui.onNodeWithTag("guest-login").performScrollTo().performClick()
        ui.onNodeWithTag("home").assertIsDisplayed()
        ui.runOnUiThread{ui.activity.onBackPressedDispatcher.onBackPressed()}
        ui.onNodeWithTag("exit-dialog").assertIsDisplayed()
        ui.onNodeWithTag("exit-confirm").assertIsDisplayed()
        ui.onNodeWithTag("exit-cancel").performClick()
        ui.onNodeWithTag("exit-dialog").assertDoesNotExist()
        ui.onNodeWithTag("home").assertIsDisplayed()
        ui.runOnUiThread{ui.activity.onBackPressedDispatcher.onBackPressed()}
        ui.onNodeWithTag("exit-confirm").performClick()
        ui.waitUntil(10000){ui.activityRule.scenario.state==androidx.lifecycle.Lifecycle.State.DESTROYED}
    }
}
