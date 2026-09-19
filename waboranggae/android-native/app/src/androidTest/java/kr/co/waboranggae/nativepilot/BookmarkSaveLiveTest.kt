package kr.co.waboranggae.nativepilot

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith
import java.util.UUID

/** Real private server, disposable account, synthetic dense route. Zero provider calls.
 * Uses a separate in-memory session; never reads/replaces the phone owner's login. */
@RunWith(AndroidJUnit4::class)
class BookmarkSaveLiveTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private fun equivalent(a:JsonElement?,b:JsonElement?):Boolean=when{
  a is JsonObject&&b is JsonObject->a.keys==b.keys&&a.all{(key,value)->equivalent(value,b[key])}
  a is JsonArray&&b is JsonArray->a.size==b.size&&a.zip(b).all{(x,y)->equivalent(x,y)}
  a is JsonPrimitive&&b is JsonPrimitive&&!a.isString&&!b.isString&&a.doubleOrNull!=null&&b.doubleOrNull!=null->kotlin.math.abs(a.double-b.double)<1e-9
  else->a==b
 }
 @Test fun oversizedCourseSavesAndOpensRouteWithRealServer()=runBlocking {
  val live=HttpTravelRepository(BuildConfig.API_BASE_URL,BuildConfig.DEV_ACCESS_KEY)
  val marker=UUID.randomUUID().toString();val email="native-save-$marker@example.invalid";val password="test!9-$marker"
  val auth=live.api("/auth/signup","POST",buildJsonObject{put("email",email);put("password",password);put("displayName","저장 검증");put("privacyConsent",true);put("ageConfirmed",true);put("consentVersion",NOTICE_VERSION)}).jsonObject
  live.acceptSession(auth)
  val ownerId=auth["user"]!!.jsonObject.text("id")
  try{
   val context=InstrumentationRegistry.getInstrumentation().context
   val fixture=Json.parseToJsonElement(context.assets.open("recommend-response.json").bufferedReader().use{it.readText()}).jsonObject["courses"]!!.jsonArray.first().jsonObject
   val geometry=buildJsonArray{repeat(2900){i->add(buildJsonObject{put("latitude",34.9+i*.000001);put("longitude",127.5+kotlin.math.sin(i*.001)*.002)})}}
   val raw=JsonObject(fixture+mapOf("id" to JsonPrimitive("native-save-$marker"),"routeSource" to JsonPrimitive("kakao"),"routingCheckedAt" to JsonPrimitive(java.time.Instant.now().toString()),"routeSegments" to JsonArray(fixture["routeSegments"]!!.jsonArray.map{JsonObject(it.jsonObject+("geometry" to geometry))})))
   val course=live.rememberCourse(raw)
   val oldBody=buildJsonObject{put("courseId",course.id);put("courseName",course.title);put("city",course.city);put("snapshot",raw)}
   Assert.assertTrue(oldBody.toString().toByteArray().size>128*1024)
   // Do not send the known-oversized body: some mobile HTTP/2 connections time out
   // while the server rejects its upload. The desktop probe covers the 413 status.
   Assert.assertTrue(bookmarkPayload(course,raw).toString().toByteArray().size<=110000)
   val repo=object:TravelRepository by live {
    override suspend fun cities()=listOf(City(course.city,"test"))
    override suspend fun hotPlaces()=HotPlacesPayload(emptyList())
    override suspend fun hero()=HeroPhoto()
    override fun imageUrl(value:String?)=null
    override suspend fun recommend(preferences:Preferences)=RecommendPayload(listOf(course),"mixed")
    override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement =
     if(path.startsWith("/api/weather/"))buildJsonObject{put("available",false)}
     else if(path=="/api/recommend/refresh-route")buildJsonObject{put("course",raw)}
     else live.api(path,method,body,auth)
   }
   lateinit var vm:TravelViewModel;lateinit var account:AccountViewModel
   ui.runOnUiThread{
    vm=TravelViewModel(repo);account=AccountViewModel(repo)
    vm.chooseDeparture(PlaceSuggestion("public-fixture","테스트 출발지",latitude=34.9,longitude=127.5));vm.chooseDestination(course.city);vm.updateForm{it.copy(date=java.time.LocalDate.now().plusDays(1).toString())};vm.recommend()
   }
   ui.waitUntil(15000){!account.state.value.checking&&vm.state.value.courses.isNotEmpty()}
   ui.runOnUiThread{account.login(email,password,"",false,false)}
   ui.waitUntil(30000){!account.state.value.busy&&account.state.value.user!=null}
   Assert.assertNull(account.state.value.message)
   ui.runOnUiThread{vm.openDetails(course.id)}
   ui.setContent{WaboranggaeTheme{val s by vm.state.collectAsState();val a by account.state.collectAsState();if(s.page==Page.MAP)Text("저장 후 여행 동선")else CourseDetail(s,vm,a,account)}}
   ui.onNodeWithTag("confirm-course").performClick();ui.onNodeWithText("코스 저장").performClick()
   ui.waitUntil(35000){vm.state.value.page==Page.MAP||account.state.value.saveError!=null}
   Assert.assertNull(account.state.value.saveError)
   ui.onNodeWithText("저장 후 여행 동선").assertIsDisplayed()
   ui.waitUntil(20000){!account.state.value.busy}
   val saved=live.api("/api/user/bookmarks",auth=true).jsonArray.single{it.jsonObject.text("courseId")==course.id}.jsonObject["snapshot"]!!.jsonObject
   // JSONB/JavaScript normalise floating-point map display coordinates at ~1e-13.
   Assert.assertTrue("Saved stops, schedules and descriptions must be retained",equivalent(raw["places"],saved["places"]))
   Assert.assertEquals(raw["fitScore"],saved["fitScore"])
   Assert.assertTrue(saved["savedRouteGeometrySimplified"]!!.jsonPrimitive.boolean)
   println("BOOKMARK_LIVE_OK originalBytes=${oldBody.toString().toByteArray().size} savedBytes=${saved.toString().toByteArray().size} providerCalls=0")
  }finally{
   val me=live.api("/api/user/me",auth=true).jsonObject
   check(me.text("id")==ownerId&&me.text("email")==email)
   live.api("/api/user/me","DELETE",auth=true)
   println("BOOKMARK_LIVE_TEMP_ACCOUNT_REMOVED")
  }
 }
}
