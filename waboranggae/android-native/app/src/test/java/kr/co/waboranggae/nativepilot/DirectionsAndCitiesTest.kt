package kr.co.waboranggae.nativepilot

import kr.co.waboranggae.nativepilot.data.*
import org.junit.Assert.*
import org.junit.Test

class DirectionsAndCitiesTest {
 private fun course()=Course("c","순천","코스",durationHours=6.0,walkMinutes=30,transitMinutes=10,
  origin=Origin("출발 터미널","",34.95,127.49),
  places=listOf(Place("a","관광지 A","nature",latitude=34.96,longitude=127.50),Place("b","관광지 B","history",latitude=34.97,longitude=127.51)),
  routeSegments=listOf(RouteSegment("출발 터미널","관광지 A","kakao",transitMinutes=10),RouteSegment("관광지 A","관광지 B","kakao")))
 @Test fun citiesAreKoreanAlphabetical(){
  val names=listOf("화순","순천","광양","구례","고흥","강진","나주","곡성")
  assertEquals(listOf("강진","고흥","곡성","광양","구례","나주","순천","화순"),sortedTravelCities(names.map{City(it,it)}).map{it.name})
 }
 @Test fun originOpensFirstLegWithExplicitCoordinates(){
  val c=course();val d=c.directionsTo(c.mapStops()[0])!!
  assertEquals("출발 터미널",d.from.name);assertEquals("관광지 A",d.to.name)
  assertTrue(d.transit);assertTrue(d.appUrl().contains("sp=34.95,127.49&ep=34.96,127.5&by=publictransit"))
  assertTrue(d.webUrl().startsWith("https://map.kakao.com/link/by/traffic/"))
 }
 @Test fun selectedStopOpensPreviousStopToSelectedAndUsesWalkForWalkingLeg(){
  val c=course();val d=c.directionsTo(c.mapStops()[2])!!
  assertEquals("관광지 A",d.from.name);assertEquals("관광지 B",d.to.name)
  assertFalse(d.transit);assertTrue(d.webUrl().contains("/walk/"));assertTrue(d.appUrl().endsWith("by=foot"))
 }
 @Test fun unknownStopOrOriginOnlyDoesNotOpenAnImplicitCurrentLocation(){
  val c=course();assertNull(c.directionsTo(MapStop("unknown","unknown",Coordinate(35.0,127.0),null,99)))
  val only=c.copy(places=emptyList());assertNull(only.directionsTo(only.mapStops()[0]))
 }
}

