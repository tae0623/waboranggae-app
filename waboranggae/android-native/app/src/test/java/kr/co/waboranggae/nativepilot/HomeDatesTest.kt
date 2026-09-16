package kr.co.waboranggae.nativepilot
import kr.co.waboranggae.nativepilot.data.*
import org.junit.Test
import org.junit.Assert.*
import java.time.LocalDate
class HomeDatesTest {
 @Test fun blankStartAndLocalTimeAreDefaults(){val f=TravelForm();assertEquals("",f.query);assertNull(f.departure)}
 @Test fun endedOrUnknownEventsAreHidden(){
  val today=LocalDate.of(2026,9,16)
  val event=HotPlace("event","축제","담양",source="festival",eventStartDate="20260901",eventEndDate="20260915")
  assertFalse(event.visibleOnHome(today));assertFalse(event.copy(eventEndDate=null,eventStartDate=null).visibleOnHome(today))
  assertTrue(event.copy(eventEndDate="20260916").visibleOnHome(today));assertTrue(event.copy(eventStartDate="20260920",eventEndDate="20260922").visibleOnHome(today))
 }
 @Test fun undatedTouristAttractionsRemain(){assertTrue(HotPlace("p","죽녹원","담양").visibleOnHome())}
}
