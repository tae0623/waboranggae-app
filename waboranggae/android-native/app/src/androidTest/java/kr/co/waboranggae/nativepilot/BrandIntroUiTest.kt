package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kr.co.waboranggae.nativepilot.ui.BrandIntro
import kr.co.waboranggae.nativepilot.ui.WaboranggaeTheme
import java.io.File
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BrandIntroUiTest {
    @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
    @Test fun originalMapAndFootprintsDisplay() {
        ui.runOnUiThread { ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
        // Keep the presentation visible for a screenshot; the real app transitions after 2.5 seconds.
        ui.setContent { WaboranggaeTheme { BrandIntro {} } }
        ui.waitUntil(10000) { ui.onAllNodesWithTag("intro-art-loaded").fetchSemanticsNodes().isNotEmpty() }
        ui.onNodeWithText("전남 뚜벅이 여행").assertIsDisplayed()
        ui.onNodeWithTag("skip-intro").assertDoesNotExist()
        ui.onNodeWithText("건너뛰기").assertDoesNotExist()
        ui.runOnUiThread { check(ui.activity.hasWindowFocus()) }
        val directory=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
        val screenshot=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
        File(directory,"00-brand-intro.png").outputStream().use{screenshot.compress(Bitmap.CompressFormat.PNG,100,it)}
    }
}
