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

/** Synthetic screen-only check. No network, real account, or saved user data. */
@RunWith(AndroidJUnit4::class)
class RoutePreviewUiTest {
    @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
    private class Fake:TravelRepository {
        override suspend fun cities()=emptyList<City>()
        override suspend fun hero()=HeroPhoto()
        override suspend fun hotPlaces()=HotPlacesPayload(emptyList())
        override suspend fun search(query:String)=emptyList<PlaceSuggestion>()
        override suspend fun recommend(preferences:Preferences)=RecommendPayload(emptyList(),"tour-api")
        override fun imageUrl(value:String?)=null
        override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean)=buildJsonObject{put("providers",JsonArray(emptyList()))}
    }
    @Test fun failedMealConditionAllowsPreviewButNotSave(){
        val repo=Fake();lateinit var model:TravelViewModel;lateinit var account:AccountViewModel
        ui.runOnUiThread{model=TravelViewModel(repo);account=AccountViewModel(repo);ui.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
        val course=Course(id="preview-fixture",city="순천",title="검사 코스",durationHours=8.0,walkMinutes=30,transitMinutes=100,
            origin=Origin("검사 출발지",latitude=34.94,longitude=127.49),
            places=listOf(Place("p","식당","food",latitude=34.95,longitude=127.5)),
            constraintPassed=false,constraintViolations=listOf("식당의 식사 시간이 점심·저녁 시간대와 맞지 않습니다."))
        val travel=TravelUiState(courses=listOf(course),selectedId=course.id,page=Page.DETAIL)
        val auth=AccountState(user=buildJsonObject{put("id","synthetic")})
        ui.setContent{WaboranggaeTheme{val current by model.state.collectAsState();if(current.page==Page.MAP)Text("지도 미리보기 도착") else CourseDetail(travel,model,auth,account)}}
        ui.onNodeWithTag("route-constraint-warning").performScrollTo().assertTextEquals("조건 확인 필요")
        ui.onNodeWithText("식당의 식사 시간이 점심·저녁 시간대와 맞지 않습니다.").assertExists()
        ui.onNodeWithText("코스 저장").performScrollTo().assertIsNotEnabled()
        ui.onNodeWithTag("course-source-notice").performScrollTo().assertTextContains("관광정보·사진: 한국관광공사",substring=true)
        Assert.assertTrue(ui.onNodeWithTag("course-source-notice").fetchSemanticsNode().boundsInRoot.top>=ui.onNodeWithTag("confirm-course").fetchSemanticsNode().boundsInRoot.bottom)
        val folder=java.io.File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
        val image=requireNotNull(androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
        java.io.File(folder,"09-source-footer-fixture.png").outputStream().use{image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}
        ui.onNodeWithTag("confirm-course").performScrollTo().assertIsEnabled().performClick()
        ui.onNodeWithText("지도 미리보기 도착").assertIsDisplayed()
    }
}
