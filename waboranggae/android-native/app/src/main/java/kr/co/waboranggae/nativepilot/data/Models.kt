package kr.co.waboranggae.nativepilot.data

import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.LocalTime
import java.time.LocalDateTime
import java.time.Duration

@Serializable data class Coordinate(val latitude: Double, val longitude: Double) {
    fun valid() = latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0
}
@Serializable data class Origin(val name: String, val address: String = "", val latitude: Double, val longitude: Double) {
    fun coordinate() = Coordinate(latitude, longitude)
}
@Serializable data class PlaceSuggestion(
    val id: String, val name: String, val address: String = "", val latitude: Double, val longitude: Double,
    val source: String = "", val category: String = ""
)
@Serializable data class PlacesPayload(val places: List<PlaceSuggestion>)
@Serializable data class City(val name: String, val code: String)
fun sortedTravelCities(cities:List<City>)=cities.sortedWith(compareBy(java.text.Collator.getInstance(java.util.Locale.KOREAN)){city->city.name})
@Serializable data class CitiesPayload(val region: String, val cities: List<City>)
@Serializable data class HeroPhoto(val img: String? = null, val title: String? = null, val source: String? = null,val imageCredit:String?=null,val imageContentId:String?=null)
@Serializable data class HotPlace(
    val id:String, val name:String, val city:String, val category:String="", val desc:String="",
    val story:String?=null, val img:String="", val visitors:Double=0.0, val metricLabel:String?=null,
    val tags:List<String> = emptyList(), val isNew:Boolean=false, val isTrending:Boolean=false,
    val source:String?=null, val address:String?=null, val periodLabel:String?=null, val periodShort:String?=null,
    val eventStartDate:String?=null,val eventEndDate:String?=null,
    val statusLabel:String?=null, val fee:String?=null, val hours:String?=null, val eventPlace:String?=null,
    val sponsor:String?=null, val ageLimit:String?=null, val tel:String?=null, val spendTime:String?=null,
    val program:String?=null, val restDate:String?=null, val homepage:String?=null,
    val imageCredit:String?=null,val imageContentId:String?=null,val metricNote:String?=null
)
fun HotPlace.tourContentId():String?=id.removePrefix("festival-").takeIf{it.matches(Regex("\\d{1,20}"))}
fun HotPlace.travelDateError(date:String):String? {
    if(source!="festival" && category!="축제·행사")return null
    val from=eventStartDate.orEmpty().replace("-","")
    val to=eventEndDate.orEmpty().replace("-","")
    val day=date.replace("-","")
    if(!from.matches(Regex("\\d{8}")) || !to.matches(Regex("\\d{8}")))return "행사 기간을 확인할 수 없어요. 다른 장소를 선택해 주세요."
    return if(day<from || day>to)"행사 기간 안에서 여행 날짜를 선택해 주세요." else null
}
@Serializable data class HotPlacesPayload(val places:List<HotPlace>,val source:String?=null,val fetchedAt:String?=null)
@Serializable data class Place(
    val id: String, val name: String, val category: String, val address: String = "",
    val arrival: String = "", val stayMinutes: Int = 0, val description: String = "",
    val latitude: Double? = null, val longitude: Double? = null, val imageUrl: String? = null,
    val moveLabel: String = "", val moveMinutes: Int? = null, val routeSource: String? = null,
    val dataSource:String?=null, val placeUrl:String?=null
) {
    fun coordinate() = latitude?.let { lat -> longitude?.let { lng -> Coordinate(lat,lng).takeIf(Coordinate::valid) } }
}
@Serializable data class RouteSegment(
    val fromName: String, val toName: String, val source: String, val instruction: String = "",
    val totalMinutes: Int = 0, val transitMinutes:Int=0, val geometry: List<Coordinate> = emptyList(),val steps:List<TransitStep> = emptyList()
)
@Serializable data class TransitStep(val mode:String,val label:String,val minutes:Int,val route:String?=null,val fromStop:String?=null,val toStop:String?=null)
@Serializable data class Reason(val headline: String = "", val summary: String = "", val source: String = "rules", val evidence:List<String> = emptyList())
@Serializable data class ScoreParts(val transitAccess:Double=0.0,val walkingEase:Double=0.0,val nearbyLinks:Double=0.0)
@Serializable data class WalkingParts(val walk:Double,val transit:Double,val time:Double,val transfer:Double,val distance:Double,val efficiency:Double)
@Serializable data class CourseTimeBreakdown(val originToFirstMinutes:Int,val betweenPlacesMinutes:Int,val stayMinutes:Int,val waitAndRestMinutes:Int,val totalMinutes:Int,val requestedMinutes:Int?=null,val overBudgetMinutes:Int)
@Serializable data class AccessTrip(val origin:Origin,val arrival:Origin,val segment:RouteSegment?=null,val excludedFromBudget:Boolean=true,val externalUrl:String?=null)
@Serializable data class Course(
    val id: String, val city: String, val title: String, val subtitle: String = "",
    val durationHours: Double, val distanceKm: Double = 0.0,
    val walkMinutes: Int, val transitMinutes: Int, val places: List<Place>,
    val fitScore: Double = 0.0, val walkingScore: Double = 0.0,
    val preferenceScore:Double=0.0,val timeFitScore:Double=0.0,val courseQualityScore:Double=0.0,
    val metrics:ScoreParts=ScoreParts(),val scoreBreakdown:ScoreParts=ScoreParts(),
    val walkingBreakdown:WalkingParts?=null,
    val origin: Origin? = null, val routeSource: String = "estimated",
    val routeSegments: List<RouteSegment> = emptyList(), val reason: Reason = Reason(),
    val constraintPassed: Boolean = false, val validationNotes: List<String> = emptyList(),
    val constraintViolations:List<String> = emptyList(),val timeBreakdown:CourseTimeBreakdown?=null,
    val routingCheckedAt:String?=null,val timeBudgetMode:String?=null,val accessTrip:AccessTrip?=null
)
@Serializable data class RecommendPayload(
    val courses: List<Course>, val source: String, val planningSource: String = "rules",
    val fetchedAt: String? = null, val fallbackReason: String? = null
)
@Serializable data class Preferences(
    val scheduleMode:String="fixed",
    val requiredContentId:String?=null,val requiredPlaceName:String?=null,
    val region: String = "전라남도", val city: String,
    val timeBudgetMode:String="local",
    val startLocation: String, val startType: String, val startAddress: String,
    val startLatitude: Double, val startLongitude: Double,
    val travelDate: String, val startTime: String, val endTime: String?=null,
    val durationHours: Double, val mealPreference: String, val pace: String,
    val preferLocal: Boolean = false, val interests: List<String>,
    val companions: String = "혼자", val lowMobility: Boolean = false,
    val publicTransportOnly: Boolean = true, val preferredTransit: List<String> = listOf("bus"),
    val summary: String, val confidence: Double = 1.0
    ,val travelEndDate:String?=null,val meals:List<String>?=null,
    val lodgingName:String?=null,val lodgingAddress:String?=null,val lodgingLatitude:Double?=null,val lodgingLongitude:Double?=null
)
@Serializable data class RecommendRequest(val preferences: Preferences)
data class TravelForm(
    val limitEndTime:Boolean=false,
    val requiredPlace:HotPlace?=null,
    val city: String = "순천", val startType: String = "custom",
    val query: String = "", val departure: PlaceSuggestion? = null,
    val date: String = LocalDate.now().toString(), val startTime: String = "10:00",
    val hours: Int = 6, val meal: String = "auto", val pace: String = "balanced",
    val interests: Set<String> = linkedSetOf("nature", "food", "cafe"),
    val companion:String="혼자", val lowMobility:Boolean=false,
    val transitModes:Set<String> = linkedSetOf("bus"),
    val endDate:String?=null,val endTime:String="16:00",val meals:Set<String>?=null,val lodging:PlaceSuggestion?=null
) {
    fun forCurrentApp():TravelForm = copy(endDate=null,lodging=null,companion="혼자",
        interests=(interests-"photo").ifEmpty{if("photo" in interests)setOf("nature")else emptySet()})
    fun tripMinutes():Long = Duration.between(LocalDateTime.of(LocalDate.parse(date),LocalTime.parse(startTime)),LocalDateTime.of(LocalDate.parse(endDate?:date),LocalTime.parse(endTime))).toMinutes()
    fun totalHours()=tripMinutes()/60.0
    fun durationLabel():String { val minutes=tripMinutes();return listOfNotNull((minutes/60).takeIf{it>0}?.let{"${it}시간"},(minutes%60).takeIf{it>0}?.let{"${it}분"}).joinToString(" ") }
    fun availableMeals():Set<String> = runCatching {
        val start=LocalTime.parse(startTime).toSecondOfDay()/60
        val finish=if(limitEndTime)start+tripMinutes()else 1439L
        val windows=listOf(Triple("breakfast",480,570),Triple("lunch",690,810),Triple("dinner",1050,1170))
        (0..(finish/1440).toInt()).flatMap { day->windows.filter { (_,from,to)->
            val arrival=maxOf(start,day*1440+from)
            arrival<=day*1440+to && arrival+60<=finish
        }.map{it.first} }.toSet()
    }.getOrDefault(emptySet())
    fun normalizeMeals():TravelForm = if(meals==null)this else copy(meals=meals.intersect(availableMeals()),meal=if(meals.intersect(availableMeals()).isEmpty())"none" else "auto")
    fun toggleMeal(kind:String):TravelForm {
        if(kind=="auto") return if(meals==null && meal=="auto")copy(meals=emptySet(),meal="none")else copy(meals=null,meal="auto")
        if(kind !in availableMeals()) return this
        val selected=meals?:emptySet()
        val next=if(kind in selected)selected-kind else selected+kind
        return copy(meals=next,meal=if(next.isEmpty())"none" else "auto")
    }
    fun validationError(): String? = when {
        endDate!=null && endDate!=date -> "당일 여행의 시작·종료 시간을 선택해 주세요."
        city.isBlank() -> "여행 지역을 선택해 주세요."
        requiredPlace!=null && requiredPlace.tourContentId()==null -> "꼭 가볼 곳을 다시 선택해 주세요."
        requiredPlace!=null && requiredPlace.city!=city -> "꼭 가볼 곳과 여행 지역을 확인해 주세요."
        departure == null -> "검색 결과에서 출발지를 선택해 주세요."
        !Coordinate(departure.latitude, departure.longitude).valid() -> "출발지 좌표가 올바르지 않습니다."
        forCurrentApp().interests.isEmpty() -> "하고 싶은 일을 하나 이상 선택해 주세요."
        transitModes.isEmpty() -> "이용할 교통수단을 하나 이상 선택해 주세요."
        runCatching { LocalDate.parse(date) }.isFailure -> "날짜를 다시 선택해 주세요."
        runCatching { LocalTime.parse(startTime) }.isFailure -> "출발 시간을 다시 선택해 주세요."
        limitEndTime && runCatching{tripMinutes()}.isFailure -> "종료 시간을 확인해 주세요."
        limitEndTime && tripMinutes() !in 60..1439 -> "같은 날에 시작보다 1시간 이상 늦게 끝나도록 선택해 주세요."
        requiredPlace?.travelDateError(date)!=null -> requiredPlace?.travelDateError(date)
        else -> null
    }
    fun preferences(): Preferences {
        require(validationError() == null) { validationError().orEmpty() }
        val start = requireNotNull(departure)
        return Preferences(scheduleMode="course-first",requiredContentId=requiredPlace?.tourContentId(),requiredPlaceName=requiredPlace?.name?.take(160),city = city,timeBudgetMode="local", startLocation = start.name, startType = startType,
            startAddress = start.address, startLatitude = start.latitude, startLongitude = start.longitude,
            travelDate = date, startTime = startTime, endTime = endTime.takeIf{limitEndTime},
            durationHours = if(limitEndTime)totalHours()else 6.0, mealPreference = meal, pace = pace, interests = forCurrentApp().interests.sorted(),
            companions="혼자", lowMobility=lowMobility, preferredTransit=transitModes.toList(),
            summary = "$city ${start.name} 출발 $startTime 시작"+(if(limitEndTime)" · ${endTime}까지" else "")+" 대중교통·도보 여행",travelEndDate=date,meals=meals?.sorted(),
            lodgingName=null,lodgingAddress=null,lodgingLatitude=null,lodgingLongitude=null)
    }
}
data class MapStop(val id: String, val name: String, val coordinate: Coordinate, val place: Place?, val index: Int)
fun Course.mapStops(): List<MapStop> {
    val start = origin?.takeIf { it.coordinate().valid() } ?: return emptyList()
    val result = mutableListOf(MapStop("origin", start.name, start.coordinate(), null, 0))
    places.forEach { place ->
        val point = place.coordinate() ?: return@forEach
        // The origin is displayed once, even when the API also includes it as a station place.
        if (place.category == "station" && kotlin.math.abs(point.latitude-start.latitude) < 0.0001 &&
            kotlin.math.abs(point.longitude-start.longitude) < 0.0001) return@forEach
        result += MapStop(place.id, place.name, point, place, result.size)
    }
    return result
}
fun acceptedCourses(payload: RecommendPayload): List<Course> {
    require(payload.source in setOf("tour-api","kakao","mixed")) { "실제 관광정보를 가져오지 못했습니다. 예시 코스는 표시하지 않습니다." }
    return payload.courses.filter { it.constraintPassed && it.origin?.coordinate()?.valid() == true && it.mapStops().size > 1 }
}
fun Course.canPreviewRoute()=origin?.coordinate()?.valid()==true && mapStops().size>1
