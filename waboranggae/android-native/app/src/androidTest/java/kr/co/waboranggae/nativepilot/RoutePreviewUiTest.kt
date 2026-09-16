package kr.co.waboranggae.nativepilot

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith

/** Isolated UI fixture: no real account or external writes. */
@RunWith(AndroidJUnit4::class)
class RoutePreviewUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private class Fake:TravelRepository {
  var writes=0
  val course=Course("fixture","순천","테스트 코스",durationHours=4.0,walkMinutes=30,transitMinutes=15,
   origin=Origin("현지 출발","전남 순천",34.94,127.49),places=listOf(Place("p","공개 관광지","nature",latitude=34.95,longitude=127.5)),
   constraintPassed=true,walkingScore=82.0,walkingBreakdown=WalkingParts(80.0,81.0,82.0,83.0,84.0,85.0))
  override suspend fun cities()=listOf(City("순천","11"))
  override suspend fun hero()=HeroPhoto()
  override suspend fun hotPlaces()=HotPlacesPayload(listOf(HotPlace("1","첫 장소","순천",periodLabel="지역수요 2026-09-01"),HotPlace("2","다른 장소","순천")))
  override suspend fun search(query:String)=emptyList<PlaceSuggestion>()
  override suspend fun recommend(preferences:Preferences)=RecommendPayload(listOf(course),"tour-api")
  override fun imageUrl(value:String?)=null
  override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement{if(path.contains("bookmarks/add"))writes++;return buildJsonObject{put("providers",JsonArray(emptyList()))}}
 }
 @Test fun confirmationOffersOptionalSaveAndNoHistoryAction(){
  val repo=Fake();lateinit var model:TravelViewModel;lateinit var account:AccountViewModel
  ui.runOnUiThread{model=TravelViewModel(repo);account=AccountViewModel(repo);model.chooseDeparture(PlaceSuggestion("p","출發","주소",34.94,127.49));model.chooseDestination("순천");model.recommend()}
  ui.waitUntil(5000){model.state.value.courses.isNotEmpty()}
  ui.runOnUiThread{model.openDetails(repo.course.id)}
  val auth=AccountState(user=buildJsonObject{put("id","fixture-user")})
  ui.setContent{WaboranggaeTheme{val state by model.state.collectAsState();if(state.page==Page.MAP)Text("확정한 동선")else CourseDetail(state,model,auth,account)}}
  ui.onNodeWithText("최근 여행에 조건 저장").assertDoesNotExist();ui.onNodeWithTag("trip-forecast").assertDoesNotExist()
  ui.onNodeWithTag("confirm-course").performClick()
  ui.onNodeWithText("이 코스로 여행 확정").assertIsDisplayed();ui.onNodeWithText("코스 저장").assertIsDisplayed()
  ui.onNodeWithText("저장 없이 여행하기").performClick();ui.onNodeWithText("확정한 동선").assertIsDisplayed()
  Assert.assertEquals(0,repo.writes);Assert.assertEquals(repo.course.id,model.state.value.confirmedId)
 }
 @Test fun relatedPlaceOpensAnotherDetailAndPermanentPlaceShowsAlwaysOpen(){
  val repo=Fake();lateinit var model:TravelViewModel
  ui.runOnUiThread{model=TravelViewModel(repo)}
  ui.waitUntil(5000){model.state.value.hotPlaces.size==2}
  ui.runOnUiThread{model.openHotPlace("1")}
  ui.setContent{WaboranggaeTheme{val state by model.state.collectAsState();WebHotDetail(state,model)}}
  ui.onNodeWithText("상시개장").assertExists();ui.onNodeWithText("지표 기준").assertDoesNotExist()
  ui.onNodeWithText("다른 장소").performScrollTo().performClick()
  Assert.assertEquals("2",model.state.value.hotId)
 }
}
