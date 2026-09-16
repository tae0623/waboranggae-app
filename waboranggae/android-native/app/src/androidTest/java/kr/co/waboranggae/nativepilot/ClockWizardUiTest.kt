package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.Density
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith
import java.io.File

/** UI-only fixtures, no device location reads or provider API calls. */
@RunWith(AndroidJUnit4::class)
class ClockWizardUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private val repository=object:TravelRepository {
  override suspend fun cities()=listOf(City("순천","11"))
  override suspend fun hero()=HeroPhoto()
  override suspend fun hotPlaces()=HotPlacesPayload(emptyList())
  override suspend fun search(query:String)=emptyList<PlaceSuggestion>()
  override suspend fun recommend(preferences:Preferences)=error("Not a live API test")
  override fun imageUrl(value:String?)=null
 }
 private fun shot(name:String){
  ui.waitForIdle()
  val bitmap=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
  val dir=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
  File(dir,name+".png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
 }
 @Test fun blankDepartureHasNoPresetsOrGpsMap(){
  lateinit var vm:TravelViewModel
  ui.runOnUiThread{vm=TravelViewModel(repository)}
  ui.setContent{WaboranggaeTheme{val state by vm.state.collectAsState();WebWizard(state,vm)}}
  ui.onNodeWithTag("departure-query").assert(SemanticsMatcher.expectValue(androidx.compose.ui.semantics.SemanticsProperties.EditableText,androidx.compose.ui.text.AnnotatedString("")))
  listOf("터미널","역","직접 검색","자주 이용하는 출발지").forEach{ui.onNodeWithText(it).assertDoesNotExist()}
  ui.onNodeWithTag("departure-map-empty").performScrollTo().assertIsDisplayed()
  ui.onNodeWithTag("native-kakao-map").assertDoesNotExist()
  shot("12-blank-departure")
 }
 @Test fun exactClockAndExclusiveMeals(){
  lateinit var vm:TravelViewModel
  ui.runOnUiThread{
   vm=TravelViewModel(repository)
   vm.chooseDeparture(PlaceSuggestion("public-test","검증 장소","전남 순천",34.95,127.49))
   vm.updateForm{it.copy(date="2026-10-01",startTime="09:15",endTime="15:40")}
   vm.nextWizardStep()
  }
  ui.setContent{WaboranggaeTheme{val state by vm.state.collectAsState();WebWizard(state,vm)}}
  ui.onNodeWithText("오전 9:15 현지 여행 시작").assertExists()
  ui.onNodeWithTag("travel-end-time").assertDoesNotExist()
  ui.onNodeWithTag("end-time-limit").performScrollTo().assertIsOff().performClick().assertIsOn()
  ui.onNodeWithText("오후 3:40까지").performScrollTo().assertIsDisplayed()
  ui.onNodeWithTag("end-time-limit").performClick().assertIsOff()
  ui.onNodeWithTag("travel-end-time").assertDoesNotExist()
  shot("13a-course-first-clock")
  ui.onNodeWithTag("end-time-limit").performClick()
  listOf("여러 날","여러날","숙소").forEach{ui.onNodeWithText(it).assertDoesNotExist()}
  shot("13-clock-window")
  ui.onNodeWithTag("wizard-next").performClick()
  listOf("함께","혼자","가족과 함께","연인과 함께").forEach{ui.onNodeWithText(it).assertDoesNotExist()}
  ui.onNodeWithTag("wizard-next").performClick()
  ui.onNodeWithText("사진").assertDoesNotExist()
  ui.onNodeWithText("가고 싶은 곳과 식사 계획을 골라주세요").assertExists()
  ui.onNodeWithText("방문 전 가게의 영업시간을 확인해 주세요.").assertExists()
  ui.onNodeWithTag("meal-auto").performScrollTo().assertIsSelected()
  ui.onNodeWithTag("meal-dinner").assertIsNotEnabled()
  ui.onNodeWithTag("meal-lunch").performClick().assertIsSelected()
  ui.onNodeWithTag("meal-auto").assertIsNotSelected()
  ui.onNodeWithTag("meal-lunch").performClick()
  ui.onNodeWithText("식사 제외").assertExists()
  ui.onNodeWithTag("recommend").assertIsDisplayed()
  shot("14-meal-selection")
 }
 @Test fun timePeriodButtonsMatchBlackDialogAction(){
  ui.setContent{WaboranggaeTheme{TravelTimeDialog("09:15",{},{})}}
  fun assertBlack(tag:String){
   val pixels=ui.onNodeWithTag(tag).assertIsSelected().captureToImage().toPixelMap()
   var black=0
   for(y in 0 until pixels.height)for(x in 0 until pixels.width){
    val color=pixels[x,y]
    if(kotlin.math.abs(color.red-28/255f)<.02f && kotlin.math.abs(color.green-28/255f)<.02f && kotlin.math.abs(color.blue-30/255f)<.02f)black++
   }
   Assert.assertTrue("Selected period should match the black dialog action",black>pixels.width*pixels.height*.2)
  }
  assertBlack("time-am")
  ui.onNodeWithTag("time-pm").performClick()
  ui.onNodeWithTag("time-am").assertIsNotSelected()
  assertBlack("time-pm")
  shot("20-themed-time-period")
 }
 @Test fun twelveHourPickerSelectsNoonAndRejectsInvalidHour(){
  var selected=""
  ui.setContent{WaboranggaeTheme{TravelTimeDialog("09:15",{selected=it},{})}}
  ui.onNodeWithTag("time-hour").performTextReplacement("13")
  ui.onNodeWithTag("time-confirm").assertIsNotEnabled()
  ui.onNodeWithTag("time-hour").performTextReplacement("12")
  ui.onNodeWithTag("time-minute").performTextReplacement("00")
  ui.onNodeWithTag("time-pm").performClick().assertIsSelected()
  ui.onNodeWithTag("time-confirm").assertIsEnabled()
  ui.runOnUiThread{ui.activity.getSystemService(android.view.inputmethod.InputMethodManager::class.java).hideSoftInputFromWindow(ui.activity.window.decorView.windowToken,0)}
  ui.waitForIdle()
  shot("16-twelve-hour-picker")
  ui.onNodeWithTag("time-confirm").performClick()
  Assert.assertEquals("12:00",selected)
 }
 @Test fun longCourseTitleWrapsWithoutEllipsis(){
  val title="순천 아주긴이름의생태문화자연관찰공원·역사문화예술이함께하는복합문화관 자연·역사길"
  lateinit var vm:TravelViewModel
  ui.runOnUiThread{vm=TravelViewModel(repository)}
  val course=Course("long-title","순천",title,durationHours=6.0,walkMinutes=30,transitMinutes=20,places=emptyList())
  ui.setContent{WaboranggaeTheme{WebCourses(TravelUiState(courses=listOf(course)),vm)}}
  val layouts=mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
  ui.onNodeWithTag("course-title",useUnmergedTree=true).performScrollTo().assertTextEquals(title)
    .performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult){it(layouts)}
  Assert.assertTrue(layouts.single().lineCount>1)
  Assert.assertFalse(layouts.single().hasVisualOverflow)
  repeat(layouts.single().lineCount){Assert.assertFalse(layouts.single().isLineEllipsized(it))}
  shot("17-full-course-title")
 }
 @Test fun calendarFitsAtLargeTextAndLastDayCanBeSelected(){
  var selected=""
  ui.setContent{
   val density=LocalDensity.current
   CompositionLocalProvider(LocalDensity provides Density(density.density,1.3f)){
    WaboranggaeTheme{TravelDateDialog("2026-10-01",{selected=it},{})}
   }
  }
  ui.onNodeWithTag("calendar-day-31").performScrollTo().assertIsDisplayed().performClick()
  ui.onNodeWithTag("calendar-confirm").performScrollTo().assertIsDisplayed()
  val calendar=ui.onNodeWithTag("travel-calendar").fetchSemanticsNode().boundsInRoot
  val last=ui.onNodeWithTag("calendar-day-31").fetchSemanticsNode().boundsInRoot
  Assert.assertTrue(last.left>=calendar.left && last.right<=calendar.right)
  shot("15-responsive-calendar")
  ui.onNodeWithTag("calendar-confirm").performClick()
  Assert.assertEquals("2026-10-31",selected)
 }
}
