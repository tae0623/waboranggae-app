package kr.co.waboranggae.nativepilot

import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import org.junit.Assert.*
import org.junit.Test

class BookmarkPayloadTest {
 private val json=Json{ignoreUnknownKeys=true}
 private fun fixture()=Json.parseToJsonElement(javaClass.getResourceAsStream("/recommend-response.json")!!.bufferedReader().use{it.readText()}).jsonObject["courses"]!!.jsonArray.first().jsonObject
 private fun large(raw:JsonObject):JsonObject {
  val geometry=buildJsonArray{repeat(2900){i->add(buildJsonObject{put("latitude",34.9+i*.000001);put("longitude",127.5+kotlin.math.sin(i*.001)*.002)})}}
  val routes=(raw["routeSegments"] as? JsonArray).orEmpty().map{segment->JsonObject(segment.jsonObject+("geometry" to geometry))}
  require(routes.isNotEmpty())
  return JsonObject(raw+("routeSegments" to JsonArray(routes)))
 }
 @Test fun smallCourseIsPreservedExactly(){
  val raw=fixture();val course=json.decodeFromJsonElement<Course>(raw)
  assertEquals(raw,bookmarkPayload(course,raw)["snapshot"])
 }
 @Test fun largeGeometryFitsBothServerLimitsWithoutLosingStopsOrScores(){
  val raw=large(fixture());val course=json.decodeFromJsonElement<Course>(raw)
  assertTrue(raw.toString().toByteArray().size>128*1024)
  val payload=bookmarkPayload(course,raw);val saved=payload["snapshot"]!!.jsonObject
  assertTrue(payload.toString().toByteArray().size<=110000);assertTrue(saved.toString().length<=90000)
  for(key in listOf("places","reason","origin","fitScore","walkingScore","timeBreakdown"))assertEquals(key,raw[key],saved[key])
  assertTrue(saved["savedRouteGeometrySimplified"]!!.jsonPrimitive.boolean)
  raw["routeSegments"]!!.jsonArray.zip(saved["routeSegments"]!!.jsonArray).forEach{(before,after)->
   val original=before.jsonObject["geometry"]!!.jsonArray;val simplified=after.jsonObject["geometry"]!!.jsonArray
   assertEquals(original.first(),simplified.first());assertEquals(original.last(),simplified.last())
   assertEquals(before.jsonObject-"geometry",after.jsonObject-"geometry")
  }
  assertEquals(2900,raw["routeSegments"]!!.jsonArray.first().jsonObject["geometry"]!!.jsonArray.size)
 }
 @Test fun nonGeometryOversizeFailsLocallyInsteadOfSending413(){
  val raw=JsonObject(fixture()+("description" to JsonPrimitive("가".repeat(50000))))
  try{bookmarkPayload(json.decodeFromJsonElement(raw),raw);fail("Oversized request must not be sent")}
  catch(e:ApiFailure){assertEquals(413,e.status);assertFalse(e.message!!.contains("로그인"))}
 }
 @Test fun sublimitButTooManyPointsIsAlsoSimplified(){
  val raw=fixture();val first=raw["routeSegments"]!!.jsonArray.first().jsonObject
  val points=JsonArray(List(3001){buildJsonObject{put("latitude",35);put("longitude",127)}})
  val oversized=JsonObject(raw+("routeSegments" to JsonArray(listOf(JsonObject(first+("geometry" to points))))))
  val saved=bookmarkPayload(json.decodeFromJsonElement(oversized),oversized)["snapshot"]!!.jsonObject
  assertEquals(2,saved["routeSegments"]!!.jsonArray.first().jsonObject["geometry"]!!.jsonArray.size)
 }
}
