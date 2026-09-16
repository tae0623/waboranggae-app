package kr.co.waboranggae.nativepilot
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import org.junit.Assert.*
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class RequiredPlaceAndLocationTest {
 private val festival=HotPlace("festival-1234","선택한 축제","순천",category="축제·행사",eventStartDate="20260919",eventEndDate="20260921")
 private val origin=PlaceSuggestion("public","순천터미널","전남 순천시",34.95,127.5)
 @Test fun requiredPlaceIsSentAndFestivalDateIsValidated(){
  val form=TravelForm(requiredPlace=festival,departure=origin,date="2026-09-20")
  assertNull(form.validationError());assertEquals("1234",form.preferences().requiredContentId)
  assertEquals(festival.name,form.preferences().requiredPlaceName)
  assertNotNull(form.copy(date="2026-09-22").validationError())
  assertNotNull(form.copy(city="담양").validationError())
  assertNotNull(form.copy(requiredPlace=festival.copy(id="unknown")).validationError())
  assertNull(form.copy(requiredPlace=null,date="2026-09-22").validationError())
 }
 @Test fun unavailableLocationStopsAfterFiveSecondsWithoutRetry()=runTest {
  var attempts=0;var cancelled=false
  val value=withinDeviceLocationBudget{attempts++;try{delay(60000);DeviceOnlyLocation.create(35.0,127.0)}finally{cancelled=true}}
  assertNull(value);assertEquals(1,attempts);assertTrue(cancelled);assertEquals(5000L,testScheduler.currentTime)
 }
 @Test fun recentLocationDoesNotWaitForTimeout()=runTest {
  val value=withinDeviceLocationBudget{DeviceOnlyLocation.create(35.0,127.0)}
  assertNotNull(value);assertEquals(0L,testScheduler.currentTime)
 }
}
