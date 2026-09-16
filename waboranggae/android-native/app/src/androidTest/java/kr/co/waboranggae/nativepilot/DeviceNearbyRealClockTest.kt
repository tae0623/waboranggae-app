package kr.co.waboranggae.nativepilot

import androidx.activity.compose.setContent
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Bundle
import android.os.SystemClock
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.content.ContextCompat
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Real wall-clock smoke check. Never prints/captures a location or distance. Does not grant consent. */
@RunWith(AndroidJUnit4::class)
class DeviceNearbyRealClockTest {
 private val inst=InstrumentationRegistry.getInstrumentation()
 private fun find(predicate:(AccessibilityNodeInfo)->Boolean):AccessibilityNodeInfo? {
  fun scan(n:AccessibilityNodeInfo?):AccessibilityNodeInfo? {if(n==null)return null;if(predicate(n))return n;for(i in 0 until n.childCount)scan(n.getChild(i))?.let{return it};return null}
  return scan(inst.uiAutomation.rootInActiveWindow)
 }
 private fun text(value:String)=find{it.text?.toString()?.contains(value)==true}
 private fun click(node:AccessibilityNodeInfo){var n:AccessibilityNodeInfo?=node;while(n!=null){if(n.isClickable){check(n.performAction(AccessibilityNodeInfo.ACTION_CLICK));return};n=n.parent};error("Clickable control unavailable")}
 private fun waitFor(ms:Long,predicate:()->Boolean):Boolean {val end=SystemClock.elapsedRealtime()+ms;while(SystemClock.elapsedRealtime()<end){if(predicate())return true;SystemClock.sleep(150)};return false}
 @Test fun locationWaitIsBoundedAndCandidatesRemainUsable(){
  val ctx=inst.targetContext
  assertTrue(ctx.getSharedPreferences("device_location_choice",0).getString("choice",null)=="ALLOWED")
  ActivityScenario.launch(androidx.activity.ComponentActivity::class.java).use{scenario->
   scenario.onActivity{activity->
    activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    activity.setContent{
     kr.co.waboranggae.nativepilot.ui.WaboranggaeTheme{
      kr.co.waboranggae.nativepilot.ui.DeviceLocationConsentProvider{
       kr.co.waboranggae.nativepilot.ui.NearbyDepartureCandidates(listOf(
        kr.co.waboranggae.nativepilot.data.PlaceSuggestion("public-a","공개 장소 A",latitude=35.0,longitude=127.0),
        kr.co.waboranggae.nativepilot.data.PlaceSuggestion("public-b","공개 장소 B",latitude=35.01,longitude=127.01),
       )){}
      }
     }
    }
   }
   val started=SystemClock.elapsedRealtime()
   assertTrue("Candidates must not wait for GPS",waitFor(2500){text("공개 장소 A")!=null})
   assertTrue("Location wait must finish within five seconds plus UI scheduling",waitFor(6000){text("정확도 우선 · 비슷한 결과는 가까운 순")!=null||text("위치 확인 불가 · 정확도순")!=null})
   val elapsed=SystemClock.elapsedRealtime()-started
   assertTrue("Wall-clock location wait exceeded 7 seconds",elapsed<7000)
   assertTrue(text("위치 확인 중")==null)
   assertTrue(text("공개 장소 B")!=null)
   inst.sendStatus(2,Bundle().apply{putLong("locationUiWaitMs",elapsed);putBoolean("nearbyAvailable",text("정확도 우선 · 비슷한 결과는 가까운 순")!=null);putBoolean("coordinatesOrDistancesPersisted",false)})
  }
 }
 @Test fun platformReturnsApproximateFixWithoutComposeClock(){
  val ctx=inst.targetContext
  assertTrue(ContextCompat.checkSelfPermission(ctx,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED)
  val manager=ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
  ActivityScenario.launch(MainActivity::class.java).use{scenario->
   scenario.onActivity{it.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
   SystemClock.sleep(3500)
   val signals=mutableListOf<android.os.CancellationSignal>()
   try{
    val providers=listOf("network","fused").filter{runCatching{manager.isProviderEnabled(it)}.getOrDefault(false)}
    val latch=java.util.concurrent.CountDownLatch(providers.size)
    val fixes=java.util.concurrent.ConcurrentHashMap<String,Boolean>()
    inst.runOnMainSync{providers.forEach{provider->
     val cancellation=android.os.CancellationSignal();signals.add(cancellation)
     androidx.core.location.LocationManagerCompat.getCurrentLocation(manager,provider,cancellation,ContextCompat.getMainExecutor(ctx)){fix->
      fixes[provider]=fix!=null;latch.countDown()
     }
    }}
    val completed=latch.await(45,java.util.concurrent.TimeUnit.SECONDS)
    inst.sendStatus(2,Bundle().apply{putBoolean("callbacksCompleted",completed);providers.forEach{putString(it+"Result",fixes[it]?.toString()?:"no-callback")}})
    assertTrue("No approximate fix from either platform provider",fixes.values.any{it})
   }finally{signals.forEach{it.cancel()}}
  }
 }
 @Test fun realClockShowsNearbyAfterUserConsent(){
  val ctx=inst.targetContext
  assertTrue("User must grant approximate location",ContextCompat.checkSelfPermission(ctx,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED)
  assertTrue("User must choose consent",ctx.getSharedPreferences("device_location_choice",0).getString("choice",null)=="ALLOWED")
  ActivityScenario.launch(MainActivity::class.java).use{scenario->
   scenario.onActivity{it.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
   check(waitFor(35000){text("여행 코스 만들기")!=null||text("게스트로 이용하기")!=null})
   text("게스트로 이용하기")?.let{click(it)}
   check(waitFor(10000){text("여행 코스 만들기")!=null});click(requireNotNull(text("여행 코스 만들기")))
   check(waitFor(5000){find{it.isEditable}!=null})
   val input=requireNotNull(find{it.isEditable});check(input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,Bundle().apply{putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,"광주종합버스터미널")}))
   // Includes both bounded provider attempts (45s + 2s + 45s), not just the first.
   val received=waitFor(100000){text("정확도 우선 · 비슷한 결과는 가까운 순")!=null}
   inst.sendStatus(2,Bundle().apply{
       putBoolean("nearbyLabel",received)
       putBoolean("accuracyLabel",text("정확도순")!=null)
       putBoolean("locatingLabel",text("위치 확인 중")!=null)
       putBoolean("publicCandidateVisible",text("광주종합")!=null)
   })
   // Clear the dropdown before leaving the test; no UI tree or screenshot is persisted.
   find{it.isEditable}?.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,Bundle().apply{putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,"")})
   val manager=ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
   val network=runCatching{manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)}.getOrDefault(false)
   val fused=android.os.Build.VERSION.SDK_INT>=31&&runCatching{manager.isProviderEnabled(LocationManager.FUSED_PROVIDER)}.getOrDefault(false)
   assertTrue("No nearby fix on real clock; networkEnabled=$network; fusedEnabled=$fused",received)
  }
 }
}
