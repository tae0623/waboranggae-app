package kr.co.waboranggae.nativepilot
import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kr.co.waboranggae.nativepilot.data.PlaceSuggestion
import kr.co.waboranggae.nativepilot.ui.NearbyDepartureCandidates
import org.junit.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NearbyPrivacyUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Test fun withoutConsentDropdownKeepsAccuracyOrderAndSelection(){
  var selected:String?=null
  ui.setContent{MaterialTheme{Column{NearbyDepartureCandidates(listOf(PlaceSuggestion("p","일반 검색 결과",latitude=35.0,longitude=127.0))){selected=it.id}}}}
  ui.onNodeWithTag("departure-dropdown").assertIsDisplayed()
  ui.onNodeWithTag("departure-sort-label").assertTextEquals("정확도순")
  ui.onNodeWithTag("departure-result").performClick()
  Assert.assertEquals("p",selected)
 }
}
