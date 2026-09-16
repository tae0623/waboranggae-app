package kr.co.waboranggae.nativepilot

import androidx.activity.ComponentActivity
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith

/** UI fixtures only: no account, GPS, external recommendation or photo request. */
@RunWith(AndroidJUnit4::class)
class RequiredPlaceUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private val repository=object:TravelRepository {
  override suspend fun cities()=listOf(City("순천","11"))
  override suspend fun hero()=HeroPhoto()
  override suspend fun hotPlaces()=HotPlacesPayload(emptyList())
  override suspend fun search(query:String)=emptyList<PlaceSuggestion>()
  override suspend fun recommend(preferences:Preferences)=error("No fixture API")
  override fun imageUrl(value:String?)=null
 }
 @Test fun detailButtonPinsVenueUntilUserRemovesIt(){
  val place=HotPlace("1234","선택한 순천 공원","순천")
  lateinit var vm:TravelViewModel
  ui.runOnUiThread{vm=TravelViewModel(repository)}
  ui.setContent{WaboranggaeTheme{
   val state by vm.state.collectAsState()
   if(state.page==Page.CONDITIONS)WebWizard(state,vm) else WebHotDetail(state.copy(hotPlaces=listOf(place),hotId=place.id),vm)
  }}
  ui.onNodeWithTag("hot-place-plan").performScrollTo().assertTextContains("이 장소 포함해 코스 만들기").performClick()
  ui.onNodeWithTag("required-place").assertExists()
  ui.onNodeWithText(place.name).assertExists()
  ui.runOnUiThread{Assert.assertEquals("1234",vm.state.value.form.requiredPlace?.tourContentId())}
  ui.onNodeWithTag("required-place-remove").performClick()
  ui.onNodeWithTag("required-place").assertDoesNotExist()
  ui.runOnUiThread{Assert.assertNull(vm.state.value.form.requiredPlace)}
 }
 @Test fun missingProviderIdentityCannotSilentlyPlanOnlyTheCity(){
  lateinit var vm:TravelViewModel
  ui.runOnUiThread{vm=TravelViewModel(repository)}
  ui.setContent{WaboranggaeTheme{WebHotDetail(TravelUiState(hotPlaces=listOf(HotPlace("missing-id","정보 확인 중","순천")),hotId="missing-id"),vm)}}
  ui.onNodeWithTag("hot-place-plan").performScrollTo().assertIsNotEnabled()
 }
}
