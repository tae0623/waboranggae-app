package kr.co.waboranggae.nativepilot.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kr.co.waboranggae.nativepilot.data.*
import kotlinx.serialization.json.*

enum class Page { HOME, CONDITIONS, RESULTS, MAP, HOT_PLACE, MY_TRAVEL, DETAIL, EDITOR }
data class TripDay(val date:String,val preferences:Preferences,val courseId:String?=null,val error:String?=null)
data class TravelUiState(
    val candidatePools:Map<String,List<Place>> = emptyMap(),val tripDays:List<TripDay> = emptyList(),val generationProgress:String="",
    val page: Page = Page.HOME, val form: TravelForm = TravelForm(),
    val cities: List<City> = emptyList(), val cityError: String? = null,
    val hero: HeroPhoto? = null, val searching: Boolean = false,
    val suggestions: List<PlaceSuggestion> = emptyList(), val searchError: String? = null,val searchNotice:String?=null,
    val loading: Boolean = false, val error: String? = null,
    val courses: List<Course> = emptyList(), val selectedId: String? = null,
    val elapsedMs: Long = 0, val fetchedAt: String? = null,
    val hotPlaces:List<HotPlace> = emptyList(),val hotLoading:Boolean=true,
    val hotError:String?=null,val hotUpdated:String?=null,val hotId:String?=null,val wizardStep:Int=1,
    val preferences:Preferences?=null,val detailBusy:Boolean=false,val detailError:String?=null,
    val weather:JsonObject?=null,val weatherDate:String?=null,val weatherLoading:Boolean=false,
    val routingBusyId:String?=null,val routingError:String?=null,
    val activeDay:String?=null,val confirmedId:String?=null,
    val mapChoice:PlaceSuggestion?=null,val mapResolving:Boolean=false
) {
    val selectedCourse get() = courses.find { it.id == selectedId }
    val selectedHotPlace get() = hotPlaces.find { it.id==hotId }
    val confirmedCourse get() = courses.find { it.id==confirmedId }
}
class TravelViewModel(val repository: TravelRepository) : ViewModel() {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }
    private val mutable = MutableStateFlow(TravelUiState())
    val state = mutable.asStateFlow()
    private var searchJob: Job? = null
    private var searchVersion=0L
    private val suggestionCache=linkedMapOf<String,Pair<Long,List<PlaceSuggestion>>>()
    private var recommendationJob: Job? = null
    private var hotJob:Job?=null
    private var weatherJob:Job?=null
    private var routingJob:Job?=null
    private val routedIds=mutableSetOf<String>()
    private var multiDayForm:TravelForm?=null
    private var localDayOrigin:Origin?=null
    private val dayCache=mutableMapOf<String,Pair<List<Course>,Preferences>>()
    private var mapPointJob:Job?=null
    private var mapPointVersion=0L
    init {
        loadCities()
        loadHotPlaces()
    }
    fun loadCities() {
        mutable.update { it.copy(cityError=null) }
        viewModelScope.launch {
            try {
                val cities = repository.cities()
                mutable.update { it.copy(cities=sortedTravelCities(cities), cityError=if(cities.isEmpty()) "지역 정보가 없습니다." else null) }
            } catch (e: Exception) { if(e is CancellationException) throw e; mutable.update { it.copy(cityError="지역 목록을 불러오지 못했습니다. 다시 시도해 주세요.") } }
        }
    }
    fun loadHotPlaces() {
        hotJob?.cancel()
        mutable.update { it.copy(hotLoading=true,hotError=null) }
        hotJob=viewModelScope.launch {
            try { val payload=repository.hotPlaces(); mutable.update { it.copy(hotLoading=false,hotPlaces=payload.places.filter{it.visibleOnHome()},hotUpdated=payload.fetchedAt) } }
            catch(e:Exception) { if(e is CancellationException) throw e; mutable.update { it.copy(hotLoading=false,hotError="여행 소식을 불러오지 못했어요. 다시 시도해 주세요.") } }
        }
    }
    fun openHotPlace(id:String) { if(mutable.value.hotPlaces.any{it.id==id}) mutable.update { it.copy(hotId=id,page=Page.HOT_PLACE) } }
    fun planFromHotPlace(place:HotPlace) {
        if(place.tourContentId()==null){mutable.update{it.copy(error="선택한 장소의 관광정보를 확인할 수 없습니다.")};return}
        searchJob?.cancel()
        val tags=place.tags.mapNotNull { when { it.contains("카페")->"cafe";it.contains("맛집")->"food";it.contains("역사")->"history";it.contains("시장")->"market";it.contains("자연")->"nature";else->null } }.toSet()
        mutable.update { it.copy(page=Page.CONDITIONS,wizardStep=1,form=it.form.copy(requiredPlace=place,city=place.city,departure=null,query="",startType="custom",interests=tags.ifEmpty{setOf("nature")}),suggestions=emptyList(),searching=false,searchError=null,error=null) }
    }
    fun navigate(page: Page) { if(page!=Page.CONDITIONS)dismissMapChoice();mutable.update { it.copy(page=page,selectedId=if(page==Page.MAP)it.confirmedId else it.selectedId,wizardStep=if(page==Page.CONDITIONS) 1 else it.wizardStep) };if(page==Page.MAP && mutable.value.confirmedId!=null)loadTravelWeather(mutable.value.preferences?.travelDate) }
    fun confirmTravel(id:String){if(mutable.value.courses.none{it.id==id&&it.canPreviewRoute()})return;mutable.update{it.copy(confirmedId=id,selectedId=id,page=Page.MAP,preferences=it.tripDays.find{d->d.courseId==id}?.preferences?:it.preferences)};refreshRouting(id);loadTravelWeather(mutable.value.preferences?.travelDate)}
    fun changeTripConditions(){mutable.update{it.copy(page=Page.CONDITIONS,wizardStep=2,error=null)}}
    fun nextWizardStep() {
        val s=mutable.value
        val issue=when(s.wizardStep) {
            1->if(s.form.departure==null) "검색 결과에서 출발지를 선택해 주세요." else null
            // Later steps may still be empty; they must not hide an invalid date or duration here.
            2->s.form.copy(interests=setOf("nature"),transitModes=setOf("bus")).validationError()
            4->if(s.form.interests.isEmpty()) "여행 목적을 하나 이상 선택해 주세요." else null
            else->null
        }
        if(issue!=null) mutable.update{it.copy(error=issue)}
        else mutable.update{it.copy(wizardStep=(it.wizardStep+1).coerceAtMost(4),error=null)}
    }
    fun clearRequiredPlace(){mutable.update{it.copy(form=it.form.copy(requiredPlace=null),error=null)}}
    fun chooseDestination(city:String) {
        val required=mutable.value.form.requiredPlace
        if(required!=null && required.city!=city){mutable.update{it.copy(error="다른 지역으로 변경하려면 꼭 가볼 곳을 먼저 제외해 주세요.")};return}
        mutable.update { it.copy(form=it.form.copy(city=city),error=null) }
    }
    fun back() {
        dismissMapChoice()
        if (mutable.value.loading) cancelRecommendation()
        if(mutable.value.page==Page.CONDITIONS && mutable.value.wizardStep>1) { mutable.update{it.copy(wizardStep=it.wizardStep-1,error=null)};return }
        mutable.update { it.copy(page=when(it.page) { Page.MAP,Page.EDITOR->Page.DETAIL;Page.DETAIL->Page.RESULTS; Page.RESULTS->Page.CONDITIONS; else->Page.HOME },wizardStep=1) }
    }
    fun updateForm(change: (TravelForm)->TravelForm) { mutable.update { it.copy(form=change(it.form).forCurrentApp().normalizeMeals(), error=null) } }
    fun changeCity(city: String) {
        searchJob?.cancel()
        mutable.update { val type=it.form.startType; it.copy(form=it.form.copy(city=city, departure=null,
            query=""), suggestions=emptyList(), searching=false) }
    }
    fun changeStartType(type: String) {
        searchJob?.cancel()
        mutable.update { it.copy(form=it.form.copy(startType=type,departure=null,
            query=""), suggestions=emptyList(),searching=false) }
    }
    fun changeQuery(query: String) {
        searchJob?.cancel()
        mutable.update { it.copy(form=it.form.copy(query=query.take(80),departure=null), suggestions=emptyList(), searchError=null,searching=false) }
        scheduleSearch(450)
    }
    fun chooseDeparture(place: PlaceSuggestion) {
        dismissMapChoice();searchJob?.cancel();searchVersion++
        val type=if(place.name.contains("터미널"))"terminal" else if(place.name.endsWith("역"))"station" else "custom"
        mutable.update { it.copy(form=it.form.copy(departure=place,query=place.name,startType=type),suggestions=emptyList(),searchError=null,searching=false,mapChoice=null) }
    }
    fun dismissMapChoice(){mapPointVersion++;mapPointJob?.cancel();mutable.update{it.copy(mapChoice=null,mapResolving=false)}}
    fun resolveMapPoint(point:Coordinate,name:String?) {
        if(!point.valid()||point.latitude !in 32.0..40.0||point.longitude !in 123.0..133.0)return
        val version=++mapPointVersion
        mapPointJob?.cancel();mutable.update{it.copy(mapResolving=true,mapChoice=null,searchError=null)}
        mapPointJob=viewModelScope.launch{try{
            val response=repository.api("/api/places/resolve","POST",buildJsonObject{put("selectionSource","map-tap");put("latitude",point.latitude);put("longitude",point.longitude);name?.takeIf{it.isNotBlank()}?.let{put("name",it.take(80))}}).jsonObject
            val place=json.decodeFromJsonElement<PlaceSuggestion>(response["place"]!!)
            if(version==mapPointVersion)mutable.update{it.copy(mapChoice=place)}
        }catch(e:Exception){if(e is CancellationException)throw e;if(version==mapPointVersion)mutable.update{it.copy(searchError="선택한 장소를 확인하지 못했어요. 다시 선택해 주세요.")}}
        finally{if(version==mapPointVersion)mutable.update{it.copy(mapResolving=false)}}}
    }
    fun dismissSearchNotice(){mutable.update{it.copy(searchNotice=null)}}
    fun search()=scheduleSearch(0)
    private fun scheduleSearch(debounceMs:Long) {
        val query = mutable.value.form.query.trim()
        searchJob?.cancel()
        val version=++searchVersion
        val minimumLength=if(debounceMs>0)2 else 1
        if(query.length < minimumLength || query.all{it in 'ㄱ'..'ㅣ'||it.isWhitespace()})return
        fun stillCurrent()=searchVersion==version&&mutable.value.form.query.trim()==query&&mutable.value.form.departure==null
        searchJob=viewModelScope.launch {
            try {
                if(debounceMs>0)delay(debounceMs)
                if(!stillCurrent())return@launch
                mutable.update{it.copy(searching=true,searchError=null)}
                val cached=suggestionCache[query]?.takeIf{System.nanoTime()-it.first<60_000_000_000L}
                val result=cached?.second?:repository.search(query)
                if(!stillCurrent())return@launch
                if(suggestionCache.size>=20)suggestionCache.remove(suggestionCache.keys.first())
                suggestionCache[query]=System.nanoTime() to result
                mutable.update { it.copy(searching=false,suggestions=result,searchError=if(result.isEmpty()) "검색 결과가 없습니다. 장소명이나 주소를 더 입력해 주세요." else null) }
            } catch(e: Exception) {
                if(e is CancellationException) throw e
                if(stillCurrent())mutable.update { val limited=e is ApiFailure && e.status in listOf(429,503);it.copy(searching=false,searchError=if(limited)"장소 검색을 잠시 사용할 수 없어요." else "검색에 연결하지 못했습니다. 검색 버튼으로 다시 시도해 주세요.",searchNotice=if(limited)"지도 서비스의 호출 한도 또는 일시적인 연결 문제로 검색이 중단됐어요. 잠시 후 다시 이용해 주세요. 일일 한도에 도달했다면 다음 날 다시 이용할 수 있어요." else null) }
            }
        }
    }
    fun recommend() {
        if(mutable.value.loading) return
        val form=mutable.value.form
        val error=form.validationError()
        if(error!=null) { mutable.update { it.copy(error=error) }; return }
        multiDayForm=form;localDayOrigin=null;dayCache.clear()
        routingJob?.cancel();weatherJob?.cancel();routedIds.clear()
        mutable.update{it.copy(loading=true,error=null,courses=emptyList(),tripDays=emptyList(),confirmedId=null)}
        recommendationJob=viewModelScope.launch{
            val started=System.nanoTime();val dates=form.tripDates()
            val visited=mutableListOf<VisitedPlace>();val all=mutableListOf<Course>();val days=mutableListOf<TripDay>();val pools=mutableMapOf<String,List<Place>>()
            try{
                for((index,date) in dates.withIndex()){
                    mutable.update{it.copy(generationProgress="DAY ${index+1} / ${dates.size}")}
                    var preferences=form.preferences().copy(travelDate=date,travelEndDate=date)
                    try{
                        preferences=form.forDay(date,localDayOrigin).preferences().copy(visitedPlaces=visited.toList())
                        val response=repository.recommend(preferences)
                        val accepted=acceptedCourses(response).filter{c->preferences.requiredContentId==null||c.places.any{it.id.removePrefix("tour-")==preferences.requiredContentId}}
                        pools[date]=accepted.flatMap{it.places}.distinctBy{it.id}
                        val courses=if(dates.size>1)accepted.take(1)else accepted
                        require(courses.isNotEmpty()){response.fallbackReason?:"이 날짜의 새 코스를 찾지 못했어요."}
                        if(index==0)localDayOrigin=courses.first().origin
                        dayCache[date]=courses to preferences;all.addAll(courses)
                        days+=TripDay(date,preferences,courses.first().id)
                        visited+=courses.first().places.map{VisitedPlace(it.id,it.name,it.latitude,it.longitude)}
                    }catch(e:Exception){if(e is CancellationException)throw e;days+=TripDay(date,preferences,error=e.message?:"코스를 불러오지 못했어요.")}
                }
                mutable.update{it.copy(loading=false,courses=all.toList(),candidatePools=pools.toMap(),tripDays=days.toList(),activeDay=form.date,
                    selectedId=all.firstOrNull()?.id,page=Page.RESULTS,preferences=days.firstOrNull{d->d.courseId!=null}?.preferences,
                    elapsedMs=(System.nanoTime()-started)/1_000_000,error=days.filter{d->d.error!=null}.joinToString("\n"){d->"${d.date}: ${d.error}"}.ifBlank{null},
                    weather=null,weatherLoading=false,routingBusyId=null,routingError=null,generationProgress="")}
            }finally{mutable.update{it.copy(loading=false,generationProgress="")}}
        }
    }
    fun cancelRecommendation() { recommendationJob?.cancel(); mutable.update { it.copy(loading=false,generationProgress="") } }
    fun selectDay(date:String,force:Boolean=false) {
        if(force){recommend();return}
        val day=mutable.value.tripDays.find{it.date==date}?:return
        mutable.update{it.copy(activeDay=date,selectedId=day.courseId,preferences=day.preferences,page=Page.RESULTS)}
    }
    fun clearPersonalTravel() { dismissMapChoice();multiDayForm=null;localDayOrigin=null;dayCache.clear();suggestionCache.clear();searchVersion++;recommendationJob?.cancel();searchJob?.cancel();routingJob?.cancel();weatherJob?.cancel();routedIds.clear();mutable.update{it.copy(candidatePools=emptyMap(),tripDays=emptyList(),generationProgress="",form=TravelForm(),courses=emptyList(),selectedId=null,confirmedId=null,activeDay=null,preferences=null,page=Page.HOME,loading=false,error=null,detailError=null,weather=null,suggestions=emptyList(),routingBusyId=null,routingError=null)} }
    private fun selectCourse(id: String) {
        if(mutable.value.courses.none { it.id==id }) return
        mutable.update { it.copy(selectedId=id,preferences=it.tripDays.find{d->d.courseId==id}?.preferences?:it.preferences,activeDay=it.tripDays.find{d->d.courseId==id}?.date?:it.activeDay) }
    }
    fun openDetails(id:String) {
        selectCourse(id);mutable.update{it.copy(page=Page.DETAIL,detailError=null,weather=null)}
        refreshRouting(id)
    }
    fun loadTravelWeather(date:String?) {
        weatherJob?.cancel()
        val s=mutable.value;val course=s.selectedCourse?:return;val p=s.preferences
        mutable.update{it.copy(weather=null,weatherDate=date,weatherLoading=date!=null && p!=null)}
        if(date==null||p==null)return
        val point=course.places.firstNotNullOfOrNull{it.coordinate()}?:course.origin?.coordinate()?:return
        val from=if(date==p.travelDate)p.startTime else "00:00"
        val actualMinutes=course.timeBreakdown?.totalMinutes ?: (course.durationHours*60).toInt()
        val until=if(date==p.travelDate)java.time.LocalTime.parse(p.startTime).plusMinutes(actualMinutes.toLong()).toString() else "23:59"
        weatherJob=viewModelScope.launch {
            try{
                val result=repository.api("/api/weather/forecast?lat=${point.latitude}&lng=${point.longitude}&date=$date&startTime=$from&endTime=$until").jsonObject
                if(mutable.value.selectedId==course.id && mutable.value.weatherDate==date)mutable.update{it.copy(weather=result)}
            }catch(e:Exception){if(e is CancellationException)throw e}
            finally{if(mutable.value.selectedId==course.id && mutable.value.weatherDate==date)mutable.update{it.copy(weatherLoading=false)}}
        }
    }
    fun refreshRouting(id:String,force:Boolean=false) {
        val s=mutable.value;val p=s.preferences?:return;val course=s.courses.find{it.id==id}?:return
        val fresh=course.routeSource=="kakao" && runCatching{java.time.Duration.between(java.time.Instant.parse(course.routingCheckedAt),java.time.Instant.now()).seconds in 0..299}.getOrDefault(false)
        if(!force && fresh)return
        if((!force && id in routedIds)||s.routingBusyId==id)return
        routingJob?.cancel();mutable.update{it.copy(routingBusyId=id,routingError=null)}
        routingJob=viewModelScope.launch {
            try{
                val raw=repository.api("/api/recommend/refresh-route","POST",buildJsonObject{put("preferences",json.encodeToJsonElement(p));put("courseId",id);put("placeIds",JsonArray(course.places.map{JsonPrimitive(it.id)}))}).jsonObject["course"]!!.jsonObject
                if(mutable.value.preferences==p && mutable.value.courses.any{it.id==id}){
                    val updated=repository.rememberCourse(raw);routedIds.add(id)
                    mutable.update{it.copy(courses=it.courses.map{c->if(c.id==id)updated else c})}
                    dayCache[p.travelDate]=mutable.value.courses.filter{c->mutable.value.tripDays.find{d->d.date==p.travelDate}?.courseId==c.id || mutable.value.tripDays.size<=1} to p
                    if(mutable.value.page==Page.MAP&&mutable.value.selectedId==id)loadTravelWeather(p.travelDate)
                }
            }catch(e:Exception){if(e is CancellationException)throw e;if(mutable.value.selectedId==id)mutable.update{it.copy(routingError="길찾기 시간을 확인하지 못했습니다. 추정 시간으로 표시합니다.")}}
            finally{if(mutable.value.routingBusyId==id)mutable.update{it.copy(routingBusyId=null)}}
        }
    }
    fun openSaved(snapshot:JsonObject) {
        runCatching{
            val course=repository.rememberCourse(snapshot)
            require(course.constraintPassed && course.mapStops().size>1){"저장된 코스의 위치·검증 정보가 부족합니다. 다시 추천받아 주세요."}
            recommendationJob?.cancel();routingJob?.cancel();weatherJob?.cancel();multiDayForm=null;localDayOrigin=null;dayCache.clear();routedIds.clear()
            mutable.update{it.copy(tripDays=emptyList(),courses=listOf(course),selectedId=course.id,preferences=null,activeDay=null,confirmedId=null,weather=null,routingBusyId=null,routingError=null)}
            openDetails(course.id)
        }.onFailure{e->mutable.update{it.copy(error=e.message)}}
    }
    fun explain() {
        val s=mutable.value;val course=s.selectedCourse?:return;val p=s.preferences?:return
        if(s.detailBusy)return
        val raw=repository.snapshot(course.id)?:return
        mutable.update{it.copy(detailBusy=true,detailError=null)}
        viewModelScope.launch {
            try {
                val response=repository.api("/api/explain","POST",buildJsonObject{put("preferences",json.encodeToJsonElement(p));put("course",raw)}).jsonObject
                val reason=json.decodeFromJsonElement<Reason>(response["reason"]!!)
                repository.rememberCourse(JsonObject(raw + ("reason" to response["reason"]!!)))
                mutable.update{it.copy(courses=it.courses.map{c->if(c.id==course.id)c.copy(reason=reason)else c})}
            }catch(e:Exception){if(e is CancellationException)throw e;mutable.update{it.copy(detailError=e.message)}}
            finally{mutable.update{it.copy(detailBusy=false)}}
        }
    }
    fun edit(ids:List<String>) {
        val s=mutable.value;val p=s.preferences?:return;val id=s.selectedId?:return
        if(s.detailBusy)return
        mutable.update{it.copy(detailBusy=true,detailError=null)}
        viewModelScope.launch {
            try{
                val raw=repository.api("/api/recommend/edit","POST",buildJsonObject{put("preferences",json.encodeToJsonElement(p));put("courseId",id);put("placeIds",JsonArray(ids.map{JsonPrimitive(it)}))}).jsonObject["course"]!!.jsonObject
                val course=repository.rememberCourse(raw)
                require(course.constraintPassed && course.mapStops().size>1){"조건을 충족하지 못하는 코스입니다."}
                mutable.update{it.copy(courses=it.courses.map{c->if(c.id==id)course else c},selectedId=course.id,page=Page.DETAIL)}
                routedIds.add(id);dayCache[p.travelDate]=mutable.value.courses.filter{c->mutable.value.tripDays.find{d->d.date==p.travelDate}?.courseId==c.id || mutable.value.tripDays.size<=1} to p
            }catch(e:Exception){if(e is CancellationException)throw e;mutable.update{it.copy(detailError=if((e as? ApiFailure)?.status==400)"여행 시간·이동·식사/카페 순서 조건에 맞지 않거나 추천이 만료되었습니다. 원래 코스는 유지됩니다."else e.message)}}
            finally{mutable.update{it.copy(detailBusy=false)}}
        }
    }
}
