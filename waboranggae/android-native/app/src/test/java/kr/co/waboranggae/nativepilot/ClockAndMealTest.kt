package kr.co.waboranggae.nativepilot

import kr.co.waboranggae.nativepilot.data.*
import org.junit.Assert.*
import org.junit.Test

class ClockAndMealTest {
    private val departure=PlaceSuggestion("test","공개 장소","전남 순천",34.95,127.49)
    private fun form()=TravelForm(city="순천",departure=departure,date="2026-10-01",limitEndTime=true)
    @Test fun courseFirstDefaultDoesNotSendAHiddenEndTime() {
        val f=TravelForm(city="순천",departure=departure,startTime="18:00",endTime="16:00")
        assertFalse(f.limitEndTime);assertNull(f.validationError())
        assertEquals("course-first",f.preferences().scheduleMode);assertNull(f.preferences().endTime)
        assertEquals(setOf("dinner"),f.availableMeals())
        assertFalse(f.preferences().summary.contains("6시간"))
    }
    @Test fun deadlineIsOptionalAndCanBeRemovedAgain() {
        val f=TravelForm(city="순천",departure=departure,startTime="10:00",endTime="12:00",limitEndTime=true)
        assertEquals("12:00",f.preferences().endTime)
        assertNull(f.copy(limitEndTime=false).preferences().endTime)
        assertNotNull(f.copy(endTime="09:00").validationError())
        assertNull(f.copy(endTime="09:00",limitEndTime=false).validationError())
    }
    @Test fun exactClockIntervalReachesApiWithoutRounding() {
        val f=form().copy(startTime="09:15",endTime="15:40")
        assertEquals(385L,f.tripMinutes());assertEquals("6시간 25분",f.durationLabel())
        assertEquals(385/60.0,f.preferences().durationHours,0.000001)
        assertEquals("15:40",f.preferences().endTime)
        assertEquals(f.date,f.preferences().travelEndDate)
    }
    @Test fun sameDayEndMustFollowStart() {
        assertNotNull(form().copy(startTime="20:00",endTime="10:00").validationError())
        assertNotNull(form().copy(startTime="10:00",endTime="10:45").validationError())
        assertNull(form().copy(startTime="20:00",endTime="23:00").validationError())
    }
    @Test fun autoIsExclusiveAndCanBeTurnedOff() {
        val f=form();assertNull(f.meals)
        val manual=f.toggleMeal("lunch")
        assertEquals(setOf("lunch"),manual.meals)
        assertNull(manual.toggleMeal("auto").meals)
        assertEquals("none",f.toggleMeal("auto").meal)
        assertTrue(f.toggleMeal("auto").meals!!.isEmpty())
        assertEquals("none",manual.toggleMeal("lunch").meal)
    }
    @Test fun onlyMealsThatFitAreSelectable() {
        val f=form().copy(startTime="08:00",endTime="19:00")
        assertEquals(setOf("breakfast","lunch","dinner"),f.availableMeals())
        assertEquals(setOf("breakfast","lunch","dinner"),f.toggleMeal("breakfast").toggleMeal("lunch").toggleMeal("dinner").meals)
        assertEquals(setOf("lunch"),form().availableMeals())
        assertNull(form().toggleMeal("dinner").meals)
        assertEquals(emptySet<String>(),form().copy(startTime="13:20",endTime="14:00").availableMeals())
    }
    @Test fun clockChangeClearsUnavailableManualMeals() {
        val f=form().toggleMeal("lunch").copy(startTime="15:00",endTime="17:00").normalizeMeals()
        assertEquals(emptySet<String>(),f.meals);assertEquals("none",f.meal)
    }
    @Test fun multipleDaysKeepADailyWindow() {
        val f=form().copy(endDate="2026-10-02",endTime="16:30")
        assertNull(f.validationError())
        assertEquals(listOf("2026-10-01","2026-10-02"),f.tripDates())
        val current=f.forCurrentApp()
        assertEquals(390L,current.tripMinutes());assertNull(current.validationError())
        assertEquals(form().date,current.preferences().travelEndDate)
    }
    @Test fun twelveHourClockPreservesNoonMidnightAndMinutes() {
        assertEquals("00:00",kr.co.waboranggae.nativepilot.ui.clockFrom12Hour(12,0,false))
        assertEquals("12:00",kr.co.waboranggae.nativepilot.ui.clockFrom12Hour(12,0,true))
        assertEquals("01:05",kr.co.waboranggae.nativepilot.ui.clockFrom12Hour(1,5,false))
        assertEquals("13:05",kr.co.waboranggae.nativepilot.ui.clockFrom12Hour(1,5,true))
        assertEquals("오전 12:00",kr.co.waboranggae.nativepilot.ui.formatKoreanClock("00:00"))
        assertEquals("오후 12:00",kr.co.waboranggae.nativepilot.ui.formatKoreanClock("12:00"))
        assertEquals("오후 3:40",kr.co.waboranggae.nativepilot.ui.formatKoreanClock("15:40"))
        assertThrows(IllegalArgumentException::class.java){kr.co.waboranggae.nativepilot.ui.clockFrom12Hour(13,0,true)}
        assertThrows(IllegalArgumentException::class.java){kr.co.waboranggae.nativepilot.ui.clockFrom12Hour(1,60,false)}
    }
}
