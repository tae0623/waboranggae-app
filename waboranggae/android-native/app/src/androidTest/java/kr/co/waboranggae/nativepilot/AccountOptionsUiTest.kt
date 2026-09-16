package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import java.io.File
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import android.app.Instrumentation
import android.content.Intent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import kotlinx.serialization.json.*
import org.junit.*
import org.junit.runner.RunWith

/** All local UI fixtures: no personal credentials, location reads or real social authorization. */
@RunWith(AndroidJUnit4::class)
class AccountOptionsUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private class Repo:TravelRepository {
  var options=LoginOptions(true,false,"fixture@example.invalid");var loggedOut=false
  override fun loginOptions()=options
  override suspend fun setLoginOptions(value:LoginOptions){options=value}
  override suspend fun logoutCurrentSession(){loggedOut=true}
  override suspend fun cities()=listOf("화순","구례","강진","고흥","광양").map{City(it,it)}
  override suspend fun hero()=HeroPhoto()
  override suspend fun hotPlaces()=HotPlacesPayload(emptyList())
  override suspend fun search(query:String)=emptyList<PlaceSuggestion>()
  override suspend fun recommend(preferences:Preferences)=error("UI fixture")
  override fun imageUrl(value:String?)=null
  override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement=
   buildJsonObject{put("providers",buildJsonArray{for(id in listOf("kakao","google"))add(buildJsonObject{put("id",id);put("enabled",true)})})}
 }
 @Test fun loginShowsSavedIdOptionalAutoLoginAndOfficialArtworkWithPhoto(){
  val repo=Repo();lateinit var vm:TravelViewModel;lateinit var account:AccountViewModel
  ui.runOnUiThread{vm=TravelViewModel(repo);account=AccountViewModel(repo)}
  ui.setContent{WaboranggaeTheme{val s by account.state.collectAsState();val travel by vm.state.collectAsState();LoginScreen(travel,vm,s,account)}}
  ui.onNodeWithTag("login-email").assertTextContains("fixture@example.invalid",substring=true)
  ui.onNodeWithTag("remember-id").assertIsOn().performClick()
  ui.waitUntil(5000){!repo.options.rememberId};Assert.assertEquals("",repo.options.email)
  ui.onNodeWithTag("auto-login").assertIsOff().performClick()
  ui.waitUntil(5000){repo.options.autoLogin}
  ui.onNodeWithText("사진 제공",substring=true).assertDoesNotExist()
  ui.waitUntil(25000){ui.onAllNodesWithTag("login-photo-loaded",useUnmergedTree=true).fetchSemanticsNodes().isNotEmpty()}
  ui.onNodeWithTag("login-photo-credit").assertDoesNotExist()
  ui.onNodeWithTag("official-kakao-logo",useUnmergedTree=true).performScrollTo().assertExists()
  ui.onNodeWithTag("official-google-logo",useUnmergedTree=true).performScrollTo().assertExists()
  Assert.assertTrue(ui.activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE !=0)
 }
 @Test fun destinationSheetIsAlphabetical(){
  val repo=Repo();lateinit var vm:TravelViewModel
  ui.runOnUiThread{vm=TravelViewModel(repo);vm.chooseDeparture(PlaceSuggestion("public","공개 장소","",34.9,127.5));vm.nextWizardStep()}
  ui.setContent{WaboranggaeTheme{val s by vm.state.collectAsState();WebWizard(s,vm)}}
  ui.waitUntil(5000){vm.state.value.cities.size==5}
  ui.onNodeWithTag("destination-city").performClick()
  val names=ui.onAllNodesWithTag("destination-option").fetchSemanticsNodes().map{it.config[androidx.compose.ui.semantics.SemanticsProperties.Text].joinToString(""){t->t.text}}
  Assert.assertEquals(listOf("강진","고흥","광양","구례","화순"),names)
  ui.onNode(hasTestTag("destination-option") and hasText("고흥")).performClick()
  ui.waitUntil(5000){vm.state.value.form.city=="고흥"}
  ui.onNodeWithTag("destination-picker").assertDoesNotExist()
 }
 private fun shot(name:String){
  ui.waitForIdle()
  val bitmap=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
  val dir=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
  File(dir,name+".png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
 }
 private val allCities=listOf("강진","고흥","곡성","광양","구례","나주","담양","목포","무안","보성","순천","신안","여수","영광","영암","완도","장성","장흥","진도","함평","해남","화순").map{City(it,it)}
 @Test fun themedDestinationShowsSelectedCityAndCanClose(){
  var closed=false
  ui.setContent{WaboranggaeTheme{DestinationPicker(allCities,"순천",{}, {closed=true})}}
  ui.onNode(hasTestTag("destination-option") and hasText("순천")).assertIsSelected()
  ui.onNodeWithText("전남 22개 지역 · 가나다순").assertIsDisplayed()
  shot("18-themed-destination")
  ui.onNodeWithTag("destination-close").performClick()
  Assert.assertTrue(closed)
 }
 @Test fun destinationAtLargeTextCanReachLastCity(){
  var selected=""
  ui.setContent{
   val density=LocalDensity.current
   CompositionLocalProvider(LocalDensity provides Density(density.density,1.5f)){
    WaboranggaeTheme{DestinationPicker(allCities,"순천",{selected=it},{})}
   }
  }
  ui.onNodeWithTag("destination-grid").performScrollToNode(hasText("화순"))
  val last=ui.onNode(hasTestTag("destination-option") and hasText("화순"))
  last.assertIsDisplayed()
  val bounds=ui.onNodeWithTag("destination-picker").fetchSemanticsNode().boundsInRoot
  val item=last.fetchSemanticsNode().boundsInRoot
  Assert.assertTrue(item.left>=bounds.left && item.right<=bounds.right && item.bottom<=bounds.bottom)
  shot("19-large-text-destination")
  last.performClick()
  Assert.assertEquals("화순",selected)
 }
 @Test fun socialButtonsShareSizeAndAlignmentWithoutChangingActions(){
  var enabled by mutableStateOf(true)
  val actions=mutableListOf<String>()
  ui.setContent{WaboranggaeTheme{
   Column(Modifier.fillMaxWidth().padding(24.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
    SocialProviderButton("kakao","카카오 로그인",enabled){actions.add("kakao")}
    SocialProviderButton("google","Google 로그인",enabled){actions.add("google")}
   }
  }}
  val kakao=ui.onNodeWithTag("social-kakao").fetchSemanticsNode().boundsInRoot
  val google=ui.onNodeWithTag("social-google").fetchSemanticsNode().boundsInRoot
  Assert.assertEquals(kakao.left,google.left,.5f)
  Assert.assertEquals(kakao.width,google.width,.5f)
  Assert.assertEquals(kakao.height,google.height,.5f)
  val logo=ui.onNodeWithTag("official-google-logo",useUnmergedTree=true).fetchSemanticsNode().boundsInRoot
  val text=ui.onNodeWithText("Google 로그인",useUnmergedTree=true).fetchSemanticsNode().boundsInRoot
  Assert.assertTrue("Provider symbol stays on the left",logo.right<google.left+google.width*.25f)
  Assert.assertTrue("Login label stays centered",kotlin.math.abs(text.center.x-google.center.x)<google.width*.06f)
  shot("21-unified-social-buttons")
  ui.onNodeWithTag("social-kakao").performClick()
  ui.onNodeWithTag("social-google").performClick()
  Assert.assertEquals(listOf("kakao","google"),actions)
  ui.runOnUiThread{enabled=false}
  ui.onNodeWithTag("social-kakao").assertIsNotEnabled()
  ui.onNodeWithTag("social-google").assertIsNotEnabled()
 }
 @Test fun myTravelOffersCurrentLogoutOnly(){
  val repo=Repo();lateinit var vm:TravelViewModel;lateinit var account:AccountViewModel
  ui.runOnUiThread{vm=TravelViewModel(repo);account=AccountViewModel(repo)}
  val user=buildJsonObject{put("id","fixture");put("displayName","검증")}
  ui.setContent{WaboranggaeTheme{MyTravel(AccountState(checking=false,user=user),account,vm)}}
  ui.onNodeWithText("모든 기기에서 로그아웃").assertDoesNotExist()
  ui.onNodeWithTag("logout-current").performScrollTo().assertTextContains("로그아웃",substring=true).performClick()
  ui.waitUntil(5000){repo.loggedOut}
 }
 @Test fun embeddedJourneyShowsEndpointsWithoutLaunchingKakao(){
  val repo=Repo()
  val course=Course("c","순천","검증",durationHours=2.0,walkMinutes=15,transitMinutes=0,
   origin=Origin("공개 터미널","",34.95,127.49),
   places=listOf(Place("a","공개 관광지","nature",latitude=34.96,longitude=127.50)),
   routeSegments=listOf(RouteSegment("공개 터미널","공개 관광지","kakao",steps=listOf(TransitStep("walk","관광지까지 도보",15)))))
  ui.setContent{WaboranggaeTheme{JourneyTimeline(course,repo)}}
  ui.onNodeWithText("공개 터미널").assertExists();ui.onNodeWithText("공개 관광지").assertExists()
  ui.onNodeWithText("관광지까지 도보").assertExists();ui.onNodeWithTag("kakao-directions").assertDoesNotExist()
 }
}
