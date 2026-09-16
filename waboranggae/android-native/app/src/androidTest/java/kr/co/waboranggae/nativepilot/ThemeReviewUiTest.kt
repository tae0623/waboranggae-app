package kr.co.waboranggae.nativepilot
import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class ThemeReviewUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private fun shot(name:String){
  ui.waitForIdle();android.os.SystemClock.sleep(650);val folder=File(ui.activity.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
  val bitmap=requireNotNull(InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
  File(folder,name+".png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
 }
 @Test fun themedDialogCanBeCancelled(){
  var show by mutableStateOf(true)
  ui.setContent{WaboranggaeTheme{Box(Modifier.fillMaxSize().background(Soft)){if(show)AppDialog(onDismissRequest={show=false},title={Text("뚜버기를 종료할까요?")},text={Text("여행 계획은 다음에 이어서 만들 수 있어요.")},confirmButton={TextButton({show=false}){Text("앱 종료")}},dismissButton={TextButton({show=false}){Text("취소")}})}}}
  ui.onNodeWithText("취소").assertIsDisplayed();shot("10-themed-dialog");ui.onNodeWithText("취소").performClick();ui.onNodeWithText("뚜버기를 종료할까요?").assertDoesNotExist()
 }
 @Test fun ver4ButtonsAndSharedBrandRenderWithoutAuthentication(){
  var clicked=""
  ui.setContent{WaboranggaeTheme{Column(Modifier.fillMaxSize().background(Color(0xFF174438)).padding(24.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
   Spacer(Modifier.height(30.dp));BrandMark(Modifier.size(72.dp));Text("뚜버기",color=Color.White)
   SocialProviderButton("kakao","카카오로 계속하기",true){clicked="kakao"}
   SocialProviderButton("google","구글로 계속하기",true){clicked="google"}
  }}}
  ui.onNodeWithTag("social-kakao").assertIsEnabled();ui.onNodeWithTag("social-google").assertIsEnabled();shot("11-brand-social-design")
  ui.onNodeWithTag("social-google").performClick();Assert.assertEquals("google",clicked)
 }
 @Test fun onlyTheConsentChoiceIsPersistedInAnIsolatedTestStore(){
  val name="test-location-choice-"+System.nanoTime();val context=ui.activity
  try{
   val first=DeviceLocationConsent(context,name);Assert.assertEquals(LocationChoice.UNDECIDED,first.choice)
   first.choose(LocationChoice.DECLINED);Assert.assertEquals(LocationChoice.DECLINED,DeviceLocationConsent(context,name).choice)
   first.choose(LocationChoice.ALLOWED);Assert.assertEquals(LocationChoice.ALLOWED,DeviceLocationConsent(context,name).choice)
   Assert.assertEquals(setOf("choice"),context.getSharedPreferences(name,0).all.keys)
  }finally{context.deleteSharedPreferences(name)}
 }
}
