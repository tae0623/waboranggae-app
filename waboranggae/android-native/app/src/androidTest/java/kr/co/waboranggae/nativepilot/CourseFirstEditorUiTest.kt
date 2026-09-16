package kr.co.waboranggae.nativepilot

import androidx.activity.ComponentActivity
import androidx.compose.runtime.*
import androidx.compose.material3.Text
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import kotlinx.serialization.json.*
import kotlinx.serialization.encodeToString
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** UI-only contract test. Fixtures are confined to the instrumentation Activity, never the app server. */
@RunWith(AndroidJUnit4::class)
class CourseFirstEditorUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Test fun removeDownToOnePlaceAndApplyRecalculation(){
  val origin=Origin("공개 출발지","전남 순천",34.95,127.49)
  val places=listOf("nature","food","cafe").mapIndexed{i,c->Place("fixture-$i","화면 검증 장소 $i",c,latitude=34.951+i*.001,longitude=127.49,stayMinutes=if(c=="food")60 else 50)}
  val original=Course("ui-fixture","순천","화면 검증용 코스",durationHours=3.0,walkMinutes=20,transitMinutes=0,places=places,origin=origin,constraintPassed=true)
  val json=Json{encodeDefaults=true;explicitNulls=false}
  var submitted:List<String>?=null
  var sentPreferences:JsonObject?=null
  var calls=0
  val repository=object:TravelRepository {
   override suspend fun cities()=listOf(City("순천","11"))
   override suspend fun hero()=HeroPhoto()
   override suspend fun hotPlaces()=HotPlacesPayload(emptyList())
   override suspend fun search(query:String)=emptyList<PlaceSuggestion>()
   override suspend fun recommend(preferences:Preferences)=RecommendPayload(listOf(original),"tour-api")
   override fun imageUrl(value:String?)=null
   override fun rememberCourse(value:JsonObject)=json.decodeFromJsonElement<Course>(value)
   override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement {
    if(path.startsWith("/api/weather/forecast"))return buildJsonObject{put("available",false)}
    assertEquals("/api/recommend/edit",path);calls++
    submitted=body!!["placeIds"]!!.jsonArray.map{it.jsonPrimitive.content}
    sentPreferences=body["preferences"]!!.jsonObject
    val course=original.copy(places=places.filter{it.id in submitted!!},durationHours=1.0,walkMinutes=10,
     timeBreakdown=CourseTimeBreakdown(10,0,50,0,60,overBudgetMinutes=0))
    return buildJsonObject{put("course",json.encodeToJsonElement(course))}
   }
  }
  lateinit var vm:TravelViewModel
  ui.runOnUiThread{
   vm=TravelViewModel(repository)
   vm.chooseDeparture(PlaceSuggestion("public","공개 출발지","전남 순천",34.95,127.49))
   vm.recommend()
  }
  ui.waitUntil(10000){vm.state.value.page==Page.RESULTS}
  ui.runOnUiThread{vm.navigate(Page.EDITOR)}
  ui.setContent{WaboranggaeTheme{
   val state by vm.state.collectAsState()
   if(state.page==Page.EDITOR)CourseEditor(state,vm)
   else Text("재계산 ${state.selectedCourse?.timeBreakdown?.totalMinutes}분 · ${state.selectedCourse?.places?.size}곳")
  }}
  repeat(2){ui.onAllNodesWithTag("remove-course-place")[0].performScrollTo().performClick();ui.waitForIdle()}
  ui.onNodeWithTag("remove-course-place").assertIsNotEnabled()
  ui.onNodeWithTag("apply-course-edit").performScrollTo().performClick()
  ui.waitUntil(10000){vm.state.value.page==Page.DETAIL}
  ui.onNodeWithText("재계산 60분 · 1곳").assertExists()
  assertEquals(listOf("fixture-2"),submitted);assertEquals(1,calls)
  assertEquals("course-first",sentPreferences!!["scheduleMode"]!!.jsonPrimitive.content)
  assertFalse(sentPreferences!!.containsKey("endTime"))
  assertNull(vm.state.value.detailError)
 }
}
