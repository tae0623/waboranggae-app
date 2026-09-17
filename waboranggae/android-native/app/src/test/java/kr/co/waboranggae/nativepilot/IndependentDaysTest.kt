package kr.co.waboranggae.nativepilot
import kr.co.waboranggae.nativepilot.data.*
import org.junit.Assert.*
import org.junit.Test
class IndependentDaysTest {
 private val outside=PlaceSuggestion("public","광주 출발","광주",35.16,126.84)
 private val local=Origin("나주 현지 출발","전남 나주시",35.03,126.71)
 private val base=TravelForm(city="나주",departure=outside,date="2026-10-01",endDate="2026-10-03",limitEndTime=true,startTime="10:00",endTime="16:30")
 @Test fun destinationStartsEmptyAndMustBeChosen(){assertEquals("",TravelForm().city);assertNotNull(TravelForm(departure=outside).validationError())}
 @Test fun rangeIsLimitedToSevenValidDays(){assertEquals(3,base.tripDates().size);assertEquals(7,base.copy(endDate="2026-10-07").tripDates().size);assertTrue(base.copy(endDate="2026-10-08").tripDates().isEmpty());assertTrue(base.copy(endDate="2026-09-30").tripDates().isEmpty())}
 @Test fun nextDaysKeepRegionAndDailyClockNotPreviousDestination(){
  for(day in listOf("2026-10-02","2026-10-03")){
   val p=base.forDay(day,local).preferences()
   assertEquals("나주",p.city);assertEquals(local.name,p.startLocation);assertEquals(local.latitude,p.startLatitude,0.0)
   assertEquals(day,p.travelDate);assertEquals(day,p.travelEndDate);assertEquals("09:00",p.startTime);assertEquals(if(day=="2026-10-03")7.5 else 6.0,p.durationHours,0.0);assertEquals(if(day=="2026-10-03")"16:30" else null,p.endTime)
  }
 }
 @Test fun firstDayRetainsOutsideOriginButLaterDaysDropRequiredVenue(){
  val b=base.copy(requiredPlace=HotPlace("123","첫날 방문지","나주"))
  assertEquals(outside,b.forDay(base.date,local).departure)
  assertEquals("123",b.forDay(base.date,local).preferences().requiredContentId)
  assertNull(b.forDay("2026-10-02",local).preferences().requiredContentId)
 }
 @Test fun aLaterDayCannotStartWithoutLocalOriginOrOutsideRange(){assertThrows(IllegalArgumentException::class.java){base.forDay("2026-10-02",null)};assertThrows(IllegalArgumentException::class.java){base.forDay("2026-11-01",local)}}
}
