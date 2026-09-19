package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith
import java.io.File

/** Device UI tests with an in-memory repository: no network, GPS or personal account. */
@RunWith(AndroidJUnit4::class)
class FinalUxUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private class Fixture:TravelRepository {
  val json=Json{encodeDefaults=true;ignoreUnknownKeys=true}
  val courses=mutableMapOf<String,Course>();var saved=0;var edited=emptyList<String>()
  override suspend fun cities()=listOf(City("순천","11"))
  override suspend fun hero()=HeroPhoto()
  override suspend fun hotPlaces()=HotPlacesPayload(emptyList())
  override suspend fun search(query:String)=emptyList<PlaceSuggestion>()
  override fun imageUrl(value:String?)=null
  override suspend fun restoreSession()=true
  override fun snapshot(id:String)=courses[id]?.let{json.encodeToJsonElement(Course.serializer(),it).jsonObject}
  override fun rememberCourse(value:JsonObject)=json.decodeFromJsonElement<Course>(value)
  override suspend fun recommend(preferences:Preferences):RecommendPayload {
   val date=preferences.travelDate;val second=date.endsWith("02")
   val places=(1..4).map{Place("$date-$it",listOf("정원","박물관","식당","추가 공원")[it-1]+date,"nature",stayMinutes=40,latitude=34.95+it*.001,longitude=127.49+it*.001)}
   val first=Course(date,"순천","순천의 하루",durationHours=3.0,walkMinutes=20,transitMinutes=10,places=places.take(3),fitScore=if(second)72.0 else 91.0,walkingScore=if(second)68.0 else 88.0,constraintPassed=true,origin=Origin("현지 도착지",latitude=34.95,longitude=127.49),routeSource="kakao",routingCheckedAt=java.time.Instant.now().toString())
   val alternative=first.copy(id=date+"-alt",places=listOf(places[0],places[3]))
   listOf(first,alternative).forEach{courses[it.id]=it}
   return RecommendPayload(listOf(first,alternative),"mixed")
  }
  override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement=when(path){
   "/auth/signup-config"->buildJsonObject{put("required",true);put("available",true)}
   "/api/user/me"->buildJsonObject{put("id","fixture");put("displayName","검증용 여행자");put("email","tester@example.invalid");put("consentVersion",NOTICE_VERSION);put("consentedAt","2026-09-18")}
   "/auth/social/providers"->buildJsonObject{put("providers",JsonArray(emptyList()))}
   "/api/user/bookmarks/add"->{saved++;buildJsonObject{put("ok",true)}}
   "/api/user/bookmarks"->throw ApiFailure("목록 재조회 실패 검증")
   "/api/recommend/edit"->{edited=body!!["placeIds"]!!.jsonArray.map{it.jsonPrimitive.content};val id=body.text("courseId");val pool=courses.values.flatMap{it.places}.associateBy{it.id};val editedCourse=courses.getValue(id).copy(places=edited.map{pool.getValue(it)});buildJsonObject{put("course",json.encodeToJsonElement(Course.serializer(),editedCourse))}}
   "/api/weather/forecast"->buildJsonObject{put("available",false)}
   else->throw ApiFailure("Fixture does not implement $path")
  }
 }
 private lateinit var vm:TravelViewModel
 private lateinit var account:AccountViewModel
 private val repo=Fixture()
 private fun prepare(multiple:Boolean){
  ui.runOnUiThread{vm=TravelViewModel(repo);account=AccountViewModel(repo);vm.chooseDeparture(PlaceSuggestion("fixture","공개 테스트 출발지",latitude=34.95,longitude=127.49));vm.chooseDestination("순천");vm.updateForm{it.copy(date="2026-10-01",endDate=if(multiple)"2026-10-02" else null)};vm.recommend()}
  ui.waitUntil(10000){vm.state.value.courses.isNotEmpty()&&!vm.state.value.loading&&!account.state.value.checking}
 }
 private fun shot(name:String){
  ui.waitForIdle()
  // Compose can be idle before the platform dialog window finishes animating.
  val automation=InstrumentationRegistry.getInstrumentation().uiAutomation
  automation.waitForIdle(500,5000)
  val bitmap=requireNotNull(automation.takeScreenshot())
  val dir=File(ui.activity.getExternalFilesDir(null),"final-ux-ui").apply{mkdirs()}
  File(dir,"$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
 }
 @Test fun allDaysAppearInOneCard(){
  prepare(true)
  ui.setContent{WaboranggaeTheme{val s by vm.state.collectAsState();WebCourses(s,vm)}}
  ui.onAllNodesWithTag("course-card").assertCountEquals(1)
  ui.onNodeWithText("DAY 2").performScrollTo().assertIsDisplayed()
  ui.onNodeWithText("72점").assertExists();ui.onNodeWithText("68점").assertExists()
  shot("01-whole-trip-card")
 }
 @Test fun appInfoShowsInstalledVersionAndSettingsKeepAttributions(){
  prepare(false)
  ui.setContent{WaboranggaeTheme{val a by account.state.collectAsState();MyTravel(a,account,vm)}}
  ui.onNodeWithTag("app-settings").performClick()
  ui.onNodeWithText("앱 정보").performScrollTo().performClick()
  ui.onNodeWithTag("app-version").assertTextEquals("앱 버전 v${BuildConfig.VERSION_NAME}").assertIsDisplayed()
  shot("04-app-version")
  ui.onNodeWithText("닫기").performClick()
  ui.onNodeWithText("개인정보·데이터·오픈소스 안내").performScrollTo().performClick()
  ui.onNodeWithText("데이터·오픈소스 출처 및 이용 조건").performScrollTo().assertIsDisplayed()
 }
 @Test fun loginHasNoAttributionAndSignupStillRequiresPrivacyConsent(){
  prepare(false)
  ui.setContent{WaboranggaeTheme{val s by vm.state.collectAsState();val a by account.state.collectAsState();LoginScreen(s,vm,a.copy(user=null,showLogin=true),account,botDialog={_,verified->androidx.compose.material3.TextButton({verified("fixture-token")}){Text("테스트 확인 완료")}})}}
  ui.onNodeWithText("개인정보·데이터 출처 자세히 보기").assertDoesNotExist()
  ui.onNodeWithTag("signup-privacy-details").assertDoesNotExist()
  ui.onNodeWithText("회원가입").performClick()
  ui.onNodeWithTag("signup-name").performTextInput("검증 여행자")
  ui.onNodeWithTag("login-email").performTextInput("test@example.invalid")
  ui.onNodeWithTag("login-password").performTextInput("samplepass9!")
  ui.onNodeWithTag("login-submit").assertIsNotEnabled()
  ui.onNodeWithTag("signup-consent").performScrollTo().performClick()
  ui.onNodeWithTag("login-submit").assertIsNotEnabled()
  ui.onNodeWithTag("signup-bot-check").performScrollTo().performClick()
  ui.onNodeWithText("테스트 확인 완료").performClick()
  ui.onNodeWithTag("login-submit").assertIsEnabled()
  ui.onNodeWithTag("signup-privacy-details").performScrollTo().performClick()
  ui.onNodeWithText("계정 관리: 이메일 가입은",substring=true).assertExists()
  ui.onNodeWithText("데이터·오픈소스 출처 및 이용 조건").assertDoesNotExist()
  ui.onNodeWithText("글꼴: Pretendard",substring=true).assertDoesNotExist()
 }
 @Test fun savingAllDaysNavigatesEvenWhenRefreshFails(){
  prepare(true);ui.runOnUiThread{vm.openDetails(vm.state.value.courses.first().id)}
  ui.setContent{WaboranggaeTheme{val s by vm.state.collectAsState();val a by account.state.collectAsState();if(s.page==Page.MAP)Text("여행 동선 도착")else CourseDetail(s,vm,a,account)}}
  ui.onNodeWithText("점수 분석").performScrollTo().performClick()
  ui.onNodeWithText("DAY 2 · 2026-10-02").performScrollTo().assertIsDisplayed()
  ui.onNodeWithText("72",useUnmergedTree=true).assertExists()
  shot("02-daily-score")
  ui.onNodeWithTag("confirm-course").performClick()
  ui.onNodeWithText("코스 저장").performClick()
  ui.waitUntil(5000){vm.state.value.page==Page.MAP}
  ui.onNodeWithText("여행 동선 도착").assertIsDisplayed()
  Assert.assertEquals(2,repo.saved)
 }
 @Test fun staleLoginMessageCannotBecomeASaveDialog(){
  prepare(false);ui.runOnUiThread{vm.openDetails(vm.state.value.courses.first().id)}
  ui.setContent{WaboranggaeTheme{val s by vm.state.collectAsState();val a by account.state.collectAsState();CourseDetail(s,vm,a.copy(message="인증 창에서 로그인을 진행해 주세요."),account)}}
  ui.onNodeWithText("저장 확인").assertDoesNotExist()
  ui.onNodeWithText("코스를 저장하지 못했어요").assertDoesNotExist()
  ui.onNodeWithText("인증 창에서 로그인을 진행해 주세요.").assertDoesNotExist()
  ui.onNodeWithTag("confirm-course").assertIsEnabled()
 }
 @Test fun dragDeleteAndRouteNearbyAddition(){
  prepare(false);ui.runOnUiThread{vm.openDetails(vm.state.value.courses.first().id);vm.navigate(Page.EDITOR)}
  ui.setContent{WaboranggaeTheme{val s by vm.state.collectAsState();CourseEditor(s,vm)}}
  val first=ui.onNodeWithTag("drag-place-2026-10-01-1").fetchSemanticsNode().boundsInRoot
  val second=ui.onNodeWithTag("drag-place-2026-10-01-2").fetchSemanticsNode().boundsInRoot
  ui.onNodeWithTag("drag-place-2026-10-01-1").performTouchInput{swipe(center,center+Offset(0f,second.center.y-first.center.y+12f),600)}
  ui.onAllNodesWithTag("remove-course-place")[2].performClick()
  ui.onNodeWithText("+  장소 추가").performScrollTo().performClick()
  ui.onNodeWithText("추가 공원2026-10-01").performScrollTo().performClick()
  shot("03-editor")
  ui.onNodeWithTag("apply-course-edit").performClick()
  ui.waitUntil(5000){repo.edited.isNotEmpty()}
  Assert.assertTrue(repo.edited.indexOf("2026-10-01-2")<repo.edited.indexOf("2026-10-01-1"))
  Assert.assertTrue("2026-10-01-4" in repo.edited);Assert.assertFalse("2026-10-01-3" in repo.edited)
 }
}
