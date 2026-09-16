package kr.co.waboranggae.nativepilot
import kr.co.waboranggae.nativepilot.ui.*
import kr.co.waboranggae.nativepilot.data.PlaceSuggestion
import org.junit.Test
import org.junit.Assert.*

class DeviceOnlyLocationTest {
 @Test fun cachedFixMustBeRecentAndMonotonic(){
  val now=500_000_000_000L
  assertTrue(isRecentDeviceFix(now,now))
  assertTrue(isRecentDeviceFix(now-120_000_000_000L,now))
  assertFalse(isRecentDeviceFix(now-120_000_000_001L,now))
  assertFalse(isRecentDeviceFix(now+1,now))
  assertFalse(isRecentDeviceFix(0,now))
 }

 @Test fun sortsReturnedCandidatesLocallyWithoutChangingPlaceCoordinates(){
  val origin=requireNotNull(DeviceOnlyLocation.create(35.0,127.0))
  val near=PlaceSuggestion("near","가까운 곳",latitude=35.001,longitude=127.0)
  val far=near.copy(id="far",name="먼 곳",latitude=35.1)
  val sorted=sortOnDevice(listOf(far,near),origin)
  assertEquals(listOf("near","far"),sorted.map{it.place.id});assertEquals(near,sorted[0].place)
  assertTrue(sorted[0].distanceMeters!!<sorted[1].distanceMeters!!)
  assertFalse(origin.toString().contains("35.0"))
 }
 @Test fun noPermissionUsesOriginalOrderAndNoDistance(){
  val places=listOf(PlaceSuggestion("a","장소",latitude=35.0,longitude=127.0))
  assertEquals(places,sortOnDevice(places,null).map{it.place});assertNull(sortOnDevice(places,null)[0].distanceMeters)
  assertNull(DeviceOnlyLocation.create(Double.NaN,127.0));assertNull(DeviceOnlyLocation.create(91.0,127.0))
 }
 @Test fun consentedSortOrdersAllReturnedMatchesByDistance(){
  val address=PlaceSuggestion("address","입력한 주소",latitude=36.0,longitude=127.0,source="kakao-address")
  val nearby=address.copy(id="business",source="kakao",latitude=35.0)
  assertEquals("business",sortOnDevice(listOf(nearby,address),DeviceOnlyLocation.create(35.0,127.0))[0].place.id)
 }
 @Test fun exactNameBeatsNearbyPartialMatch(){
  val exact=PlaceSuggestion("exact","순천역",latitude=36.0,longitude=127.0)
  val nearby=exact.copy(id="nearby",name="순천역 카페",latitude=35.0)
  val sorted=sortOnDevice(listOf(nearby,exact),DeviceOnlyLocation.create(35.0,127.0),"순천역")
  assertEquals(listOf("exact","nearby"),sorted.map{it.place.id})
 }
 @Test fun sameRelevanceGroupUsesDistance(){
  val far=PlaceSuggestion("far","스타벅스 순천점",latitude=36.0,longitude=127.0)
  val near=far.copy(id="near",name="스타벅스 광주점",latitude=35.0)
  assertEquals(listOf("near","far"),sortOnDevice(listOf(far,near),DeviceOnlyLocation.create(35.0,127.0),"스타벅스").map{it.place.id})
 }
 @Test fun exactHouseNumberBeatsCloserDifferentNumber(){
  val exact=PlaceSuggestion("65","광주 북구 우치로100번길 65",latitude=36.0,longitude=127.0)
  val wrong=exact.copy(id="650",name="광주 북구 우치로100번길 650",latitude=35.0)
  assertEquals("65",sortOnDevice(listOf(wrong,exact),DeviceOnlyLocation.create(35.0,127.0),"우치로100번길 65").first().place.id)
 }
 @Test fun withoutLocationKeepsProviderAccuracyEvenWithQuery(){
  val places=listOf(PlaceSuggestion("provider-first","순천역 북측",latitude=36.0,longitude=127.0),PlaceSuggestion("exact","순천역",latitude=35.0,longitude=127.0))
  assertEquals(places,sortOnDevice(places,null,"순천역").map{it.place})
  assertTrue(sortOnDevice(places,null,"순천역").all{it.distanceMeters==null})
 }
}
