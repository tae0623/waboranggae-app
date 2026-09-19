package kr.co.waboranggae.nativepilot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.Assert.*
@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class FinalUxTest {
 @Before fun setup(){Dispatchers.setMain(StandardTestDispatcher())}
 @After fun teardown(){Dispatchers.resetMain()}
 private fun place(id:String,lng:Double)=Place(id,id,"nature",latitude=35.0,longitude=lng)
 private fun course(id:String)=Course(id,"순천","테스트",durationHours=2.0,walkMinutes=20,transitMinutes=10,places=listOf(place("a",127.0)))
 private class Fake(val writeFails:Boolean=false,val failureStatus:Int=0):TravelRepository by HttpTravelRepository("https://example.invalid",""){
  var saved=0
  override suspend fun restoreSession()=false
  override fun snapshot(id:String)=buildJsonObject{put("id",id)}
  override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement=when(path){
   "/auth/social/providers"->buildJsonObject{put("providers",JsonArray(emptyList()))}
   "/api/user/bookmarks/add"->{assertTrue(auth);if(writeFails)throw ApiFailure("저장 실패",failureStatus);saved++;buildJsonObject{put("ok",true)}}
   "/api/user/bookmarks"->throw ApiFailure("목록 재조회 실패")
   "/api/user/profile"->{assertTrue(auth);buildJsonObject{put("id","same-user");put("displayName",body!!.text("displayName"))}}
   else->error("Unexpected request")
  }
 }
 @Test fun successfulSaveNavigatesEvenIfListReloadFails()=runTest{
  val repo=Fake();val vm=AccountViewModel(repo,StandardTestDispatcher(testScheduler));advanceUntilIdle();var navigated=false
  vm.saveTrip(listOf(course("d1"),course("d2"))){navigated=true};advanceUntilIdle()
  assertTrue(navigated);assertEquals(2,repo.saved);assertFalse(vm.state.value.busy);assertNull(vm.state.value.message)
 }
 @Test fun failedWriteDoesNotClaimSuccess()=runTest{
  val vm=AccountViewModel(Fake(true),StandardTestDispatcher(testScheduler));advanceUntilIdle();var navigated=false
  vm.save(course("d1")){navigated=true};advanceUntilIdle()
  assertFalse(navigated);assertNotNull(vm.state.value.saveError);assertNull(vm.state.value.message);assertNull(vm.state.value.notice)
 }
 @Test fun nicknameUsesAccountProfileAndPopupNotice()=runTest{
  val vm=AccountViewModel(Fake());advanceUntilIdle();vm.updateName(" 새 닉네임 ");advanceUntilIdle()
  assertEquals("same-user",vm.state.value.user!!.text("id"));assertEquals("새 닉네임",vm.state.value.user!!.text("displayName"))
  assertNotNull(vm.state.value.notice);vm.dismissNotice();assertNull(vm.state.value.notice)
 }
 @Test fun saveErrorsAreSeparateFromLoginStatusAndCanBeDismissed()=runTest{
  val vm=AccountViewModel(Fake(true,413),StandardTestDispatcher(testScheduler));advanceUntilIdle()
  vm.save(course("d1"));advanceUntilIdle()
  assertEquals(413,vm.state.value.saveErrorStatus);assertNull(vm.state.value.message)
  vm.clearSaveError();assertNull(vm.state.value.saveError);assertEquals(0,vm.state.value.saveErrorStatus)
 }
 @Test fun insertionUsesDetourAndExcludesOtherDays(){
  val picks=nearbyAdditions(listOf(place("A",127.0),place("B",127.02)),listOf(place("far",128.0),place("near",127.01),place("visited",127.001)),Coordinate(35.0,126.99),setOf("visited"))
  assertEquals("near",picks.first().place.id);assertEquals(1,picks.first().index);assertEquals(2,picks.size)
 }
}
