package kr.co.waboranggae.nativepilot
import kr.co.waboranggae.nativepilot.data.*
import org.junit.Assert.*
import org.junit.Test
class DailyScheduleTest {
 private val origin=Origin("순천 현지 거점","전남 순천",34.95,127.49)
 private val base=TravelForm(city="순천",departure=PlaceSuggestion("public","광주종합버스터미널","광주",35.16,126.84),date="2026-10-01",startTime="17:00",endTime="12:00",limitEndTime=true).withRange("2026-10-01","2026-10-03")
  .withSchedule("2026-10-01",DaySchedule("17:00","20:00"))
  .withSchedule("2026-10-02",DaySchedule("10:30","18:30"))
  .withSchedule("2026-10-03",DaySchedule("08:30","12:00"))
 @Test fun eachDayUsesItsOwnWindowAndFiltersMeals(){
  assertNull(base.validationError());val f=base.copy(meals=setOf("lunch","dinner"))
  val days=f.tripDates().map{f.forDay(it,origin).preferences()}
  assertEquals(listOf("17:00","10:30","08:30"),days.map{it.startTime})
  assertEquals(listOf("20:00","18:30","12:00"),days.map{it.endTime})
  assertEquals(listOf(3.0,8.0,3.5),days.map{it.durationHours})
  assertEquals(listOf(listOf("dinner"),listOf("dinner","lunch"),emptyList<String>()),days.map{it.meals})
  assertTrue(days.all{it.travelDate==it.travelEndDate})
 }
 @Test fun lastDayEndCanBeEarlierThanFirstStart(){assertNull(base.validationError());assertEquals("12:00",base.endTime);assertEquals("17:00",base.startTime)}
 @Test fun validatesIntermediateDayAndUnionOfMealOptions(){assertNotNull(base.withSchedule("2026-10-02",DaySchedule("10:00","10:30")).validationError());assertEquals(setOf("breakfast","lunch","dinner"),base.availableMeals())}
 @Test fun shrinkingRangeRemovesStaleWindows(){val single=base.withRange("2026-10-02","2026-10-02");assertEquals(setOf("2026-10-02"),single.daySchedules.keys);assertNull(single.endDate);assertEquals("10:30",single.startTime);assertEquals("18:30",single.endTime);assertEquals("10:30",single.forDay("2026-10-02",null).preferences().startTime)}
}
