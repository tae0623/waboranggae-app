package kr.co.waboranggae.nativepilot

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*

@OptIn(ExperimentalCoroutinesApi::class)
class TravelViewModelTest {
    @Before fun setup() { Dispatchers.setMain(StandardTestDispatcher()) }
    @After fun teardown() { Dispatchers.resetMain() }
    private class FakeRepository:TravelRepository {
        val place=PlaceSuggestion("p","순천종합버스터미널","전남 순천",34.94,127.49)
        var requests=0
        val requestedPreferences=mutableListOf<Preferences>()
        var failure=false
        val searches=mutableListOf<String>()
        val weatherPaths=mutableListOf<String>()
        var forecastAvailable=true
        override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement {
            if(!path.startsWith("/api/weather/forecast?"))throw ApiFailure("No routing fixture")
            weatherPaths.add(path)
            val date=path.substringAfter("&date=").substringBefore('&')
            return buildJsonObject{put("available",forecastAvailable);put("requestedDate",date)}
        }
        override suspend fun cities()=listOf(City("순천","11"))
        override suspend fun hero()=HeroPhoto()
        override suspend fun hotPlaces()=HotPlacesPayload(listOf(HotPlace("festival-1234","담양 축제","담양",tags=listOf("사진"))))
        override suspend fun search(query:String):List<PlaceSuggestion>{searches.add(query);return listOf(place)}
        override suspend fun recommend(preferences:Preferences):RecommendPayload {
            requests++
            requestedPreferences.add(preferences)
            if(failure) throw ApiFailure("네트워크 오류")
            val payload=Json{ignoreUnknownKeys=true}.decodeFromString<RecommendPayload>(javaClass.getResourceAsStream("/recommend-response.json")!!.bufferedReader().use{it.readText()})
            return payload.copy(courses=payload.courses.map{c->c.copy(id=c.id+"-"+preferences.travelDate,places=c.places.map{it.copy(id=it.id+"-"+preferences.travelDate,name=it.name+"-"+preferences.travelDate)})})
        }
        override fun imageUrl(value:String?)=value
    }
    @Test fun homeIsAvailableBeforeNetworkCompletes()=runTest {
        val vm=TravelViewModel(FakeRepository())
        assertEquals(Page.HOME,vm.state.value.page)
        assertFalse(vm.state.value.loading)
        advanceUntilIdle()
    }
    @Test fun autocompleteDebouncesTypingAndRequiresTwoCharacters()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo);advanceUntilIdle()
        vm.changeQuery("순");advanceUntilIdle();assertTrue(repo.searches.isEmpty())
        vm.changeQuery("순천");advanceTimeBy(200);vm.changeQuery("순천역")
        advanceTimeBy(449);runCurrent();assertTrue(repo.searches.isEmpty())
        advanceTimeBy(1);runCurrent();assertEquals(listOf("순천역"),repo.searches)
        assertEquals(1,vm.state.value.suggestions.size);assertNull(vm.state.value.form.departure)
    }
    @Test fun manualSearchCancelsPendingDebounceAndCachesRepeatedQueries()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo);advanceUntilIdle()
        vm.changeQuery("순천역");vm.search();advanceUntilIdle();assertEquals(1,repo.searches.size)
        vm.changeQuery("");vm.changeQuery("순천역");advanceUntilIdle();assertEquals(1,repo.searches.size)
    }
    @Test fun selectingAnAddressKeepsItAcrossDestinationChange()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo);advanceUntilIdle()
        vm.changeQuery("선택 주소");val address=repo.place.copy(name="선택 주소",category="주소")
        vm.chooseDeparture(address);advanceUntilIdle();assertTrue(repo.searches.isEmpty())
        vm.chooseDestination("나주");assertEquals(address,vm.state.value.form.departure)
        assertEquals("custom",vm.state.value.form.startType);assertEquals(address.name,vm.state.value.form.query)
    }
    @Test fun failingConstraintsStillAllowMapPreviewButNotClaimingCompliance()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo);vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.recommend();advanceUntilIdle()
        val course=vm.state.value.courses.first().copy(constraintPassed=false,constraintViolations=listOf("식사 시간이 맞지 않습니다."))
        assertTrue(course.canPreviewRoute());assertFalse(course.constraintPassed)
        assertFalse(course.copy(origin=null).canPreviewRoute())
        vm.changeTripConditions();assertEquals(Page.CONDITIONS,vm.state.value.page);assertEquals(2,vm.state.value.wizardStep)
        assertEquals(repo.place,vm.state.value.form.departure)
    }
    @Test fun cityChangeInvalidatesDeparture()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.changeCity("담양")
        assertNull(vm.state.value.form.departure)
        assertEquals("",vm.state.value.form.query)
        advanceUntilIdle()
    }
    @Test fun selectingCourseTwoUpdatesMapById()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.recommend();advanceUntilIdle()
        val second=vm.state.value.courses[1]
        vm.confirmTravel(second.id)
        assertEquals(second,vm.state.value.confirmedCourse)
        assertEquals(Page.MAP,vm.state.value.page)
        vm.back();assertEquals(Page.DETAIL,vm.state.value.page)
    }
    @Test fun repeatedClicksDoNotDuplicateRequest()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.recommend();vm.recommend();advanceUntilIdle()
        assertEquals(1,repo.requests)
    }
    @Test fun failedRequestKeepsFormAndAllowsRetry()=runTest {
        val repo=FakeRepository().apply{failure=true};val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.navigate(Page.CONDITIONS);vm.recommend();advanceUntilIdle()
        assertFalse(vm.state.value.loading);assertNotNull(vm.state.value.error)
        assertEquals(repo.place,vm.state.value.form.departure)
        repo.failure=false;vm.recommend();advanceUntilIdle()
        assertEquals(Page.RESULTS,vm.state.value.page)
    }
    @Test fun cancelReleasesLoadingWithoutNavigation()=runTest {
        val vm=TravelViewModel(FakeRepository())
        vm.chooseDeparture(PlaceSuggestion("p","터미널","전남",34.94,127.49));vm.chooseDestination("순천")
        vm.navigate(Page.CONDITIONS);vm.recommend();vm.cancelRecommendation();advanceUntilIdle()
        assertFalse(vm.state.value.loading);assertEquals(Page.CONDITIONS,vm.state.value.page)
    }
    @Test fun fourStepWizardPreservesSelectedDeparture()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.navigate(Page.CONDITIONS);vm.nextWizardStep()
        assertEquals(1,vm.state.value.wizardStep);assertNotNull(vm.state.value.error)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.nextWizardStep();vm.chooseDestination("담양")
        assertEquals(repo.place,vm.state.value.form.departure)
        repeat(2){vm.nextWizardStep()};assertEquals(4,vm.state.value.wizardStep)
        vm.back();assertEquals(3,vm.state.value.wizardStep)
        assertEquals(repo.place.latitude,vm.state.value.form.preferences().startLatitude,0.000001)
        advanceUntilIdle()
    }
    @Test fun emptyFutureChoicesDoNotHideInvalidTimeAtStepTwo()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.nextWizardStep()
        vm.updateForm{it.copy(startTime="22:00",limitEndTime=true,interests=emptySet(),transitModes=emptySet())}
        vm.nextWizardStep()
        assertEquals(2,vm.state.value.wizardStep);assertNotNull(vm.state.value.error)
        advanceUntilIdle()
    }
    @Test fun hotPlaceSelectionRetainsRequiredProviderId()=runTest {
        val vm=TravelViewModel(FakeRepository());advanceUntilIdle()
        assertFalse(vm.state.value.hotLoading);assertEquals(1,vm.state.value.hotPlaces.size)
        vm.openHotPlace("festival-1234");assertEquals(Page.HOT_PLACE,vm.state.value.page)
        vm.planFromHotPlace(requireNotNull(vm.state.value.selectedHotPlace))
        assertEquals(Page.CONDITIONS,vm.state.value.page);assertEquals("담양",vm.state.value.form.city)
        assertEquals(setOf("nature"),vm.state.value.form.interests)
        assertNull(vm.state.value.form.departure);assertEquals(1,vm.state.value.wizardStep)
        assertEquals("1234",vm.state.value.form.requiredPlace?.tourContentId())
        vm.chooseDestination("순천");assertEquals("담양",vm.state.value.form.city)
        vm.clearRequiredPlace();vm.chooseDestination("순천");assertNull(vm.state.value.form.requiredPlace)
    }
    @Test fun forecastUsesTripDateAndDestinationInsteadOfTodayOrOrigin()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.updateForm{it.copy(date="2026-09-18",startTime="10:00",hours=6)}
        vm.recommend();advanceUntilIdle()
        val course=vm.state.value.courses.first();val point=course.places.firstNotNullOf{it.coordinate()}
        vm.openDetails(course.id);advanceUntilIdle();assertTrue(repo.weatherPaths.isEmpty())
        vm.confirmTravel(course.id);advanceUntilIdle()
        assertEquals("/api/weather/forecast?lat=${point.latitude}&lng=${point.longitude}&date=2026-09-18&startTime=10:00&endTime=16:00",repo.weatherPaths.single())
        assertEquals("2026-09-18",vm.state.value.weather?.get("requestedDate")?.jsonPrimitive?.content)
        assertFalse(vm.state.value.weatherLoading)
    }
    @Test fun multipleDaysKeepRangeButApiRequestsOneDay()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.updateForm{it.copy(date="2026-09-18",endDate="2026-09-20",startTime="10:00",endTime="15:00")}
        assertEquals("2026-09-20",vm.state.value.form.endDate)
        vm.recommend();advanceUntilIdle();vm.confirmTravel(vm.state.value.courses.first().id);advanceUntilIdle()
        assertTrue(repo.weatherPaths.single().endsWith("date=2026-09-18&startTime=10:00&endTime=16:00"))
        assertEquals("2026-09-18",vm.state.value.preferences?.travelEndDate)
    }
    @Test fun unpublishedForecastDoesNotSubstituteTodaysWeather()=runTest {
        val repo=FakeRepository().apply{forecastAvailable=false};val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.updateForm{it.copy(date="2099-01-01")};vm.recommend();advanceUntilIdle()
        vm.confirmTravel(vm.state.value.courses.first().id);advanceUntilIdle()
        assertEquals(1,repo.weatherPaths.size)
        assertEquals("2099-01-01",vm.state.value.weatherDate)
        assertFalse(vm.state.value.weather!!["available"]!!.jsonPrimitive.boolean)
        assertFalse(vm.state.value.weatherLoading)
    }
    @Test fun allDaysAreGeneratedAtOnceIndependentAndExcludedAndLogoutClearsIt()=runTest {
        val repo=FakeRepository();val vm=TravelViewModel(repo)
        vm.chooseDeparture(repo.place);vm.chooseDestination("순천");vm.updateForm{it.copy(date="2026-10-01",endDate="2026-10-03")}
        vm.recommend();advanceUntilIdle();assertEquals(3,repo.requests)
        assertEquals(3,vm.state.value.tripDays.size);assertEquals(3,vm.state.value.courses.size)
        val local=requireNotNull(vm.state.value.courses.first().origin)
        val second=repo.requestedPreferences[1];val third=repo.requestedPreferences[2]
        assertEquals("2026-10-02",second.travelDate);assertEquals(second.travelDate,second.travelEndDate)
        assertEquals(local.name,second.startLocation);assertEquals(local.latitude,second.startLatitude,0.0)
        assertTrue(second.visitedPlaces.isNotEmpty());assertTrue(third.visitedPlaces.size>second.visitedPlaces.size)
        vm.selectDay("2026-10-02");assertEquals(3,repo.requests)
        vm.confirmTravel(vm.state.value.courses[1].id);advanceUntilIdle()
        assertEquals(3,vm.state.value.tripDays.size);assertEquals("2026-10-02",vm.state.value.preferences?.travelDate)
        vm.clearPersonalTravel();vm.selectDay("2026-10-02");advanceUntilIdle()
        assertEquals(3,repo.requests);assertTrue(vm.state.value.courses.isEmpty());assertTrue(vm.state.value.tripDays.isEmpty())
    }

}
