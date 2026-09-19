package kr.co.waboranggae.nativepilot.data

import kotlinx.serialization.json.*
import kotlin.math.*

// Stay below both the server's 95k-character snapshot cap and 128 KiB request cap.
// Only map polylines are simplified. Stops, schedules, scores and directions stay intact.
private const val BOOKMARK_BYTES=110_000
private const val SNAPSHOT_CHARS=90_000
private fun fitsBookmark(body:JsonObject):Boolean =
    body["snapshot"].toString().length<=SNAPSHOT_CHARS && body.toString().toByteArray(Charsets.UTF_8).size<=BOOKMARK_BYTES

fun bookmarkPayload(course:Course,snapshot:JsonObject):JsonObject {
    fun body(value:JsonObject)=buildJsonObject{put("courseId",course.id);put("courseName",course.title);put("city",course.city);put("snapshot",value)}
    val original=body(snapshot)
    if(fitsBookmark(original)&&geometryLengthsValid(snapshot))return original
    for(tolerance in listOf(3.0,6.0,12.0,25.0)){
        val compact=simplifyGeometry(snapshot,tolerance).jsonObject
        val result=body(JsonObject(compact+("savedRouteGeometrySimplified" to JsonPrimitive(true))))
        if(fitsBookmark(result)&&geometryLengthsValid(compact))return result
    }
    // Never drop places, inflate the server limit, or send a request known to fail.
    throw ApiFailure("저장할 경로 정보가 너무 큽니다. 코스를 나누거나 장소를 줄인 뒤 다시 저장해 주세요.",413)
}

private fun geometryLengthsValid(value:JsonElement):Boolean=when(value){
    is JsonObject->value.all{(key,child)->(key!="geometry"||child !is JsonArray||child.size<=3000)&&geometryLengthsValid(child)}
    is JsonArray->value.all(::geometryLengthsValid)
    else->true
}
private fun simplifyGeometry(value:JsonElement,tolerance:Double):JsonElement=when(value){
    is JsonObject->JsonObject(value.mapValues{(key,child)->if(key=="geometry"&&child is JsonArray)simplifyLine(child,tolerance)else simplifyGeometry(child,tolerance)})
    is JsonArray->JsonArray(value.map{simplifyGeometry(it,tolerance)})
    else->value
}
private data class LinePoint(val raw:JsonElement,val x:Double,val y:Double)
/** Iterative Ramer–Douglas–Peucker; endpoints retained, deviation bounded in metres. */
private fun simplifyLine(line:JsonArray,tolerance:Double):JsonArray {
    if(line.size<=2)return line
    val latitude=(line.firstOrNull() as? JsonObject)?.get("latitude")?.jsonPrimitive?.doubleOrNull?:return line
    val scale=111_320.0*cos(Math.toRadians(latitude))
    val points=line.map{raw->
        val point=raw as? JsonObject?:return line
        val lat=point["latitude"]?.jsonPrimitive?.doubleOrNull?:return line
        val lng=point["longitude"]?.jsonPrimitive?.doubleOrNull?:return line
        if(!lat.isFinite()||!lng.isFinite()||lat !in -90.0..90.0||lng !in -180.0..180.0)return line
        LinePoint(raw,lng*scale,lat*111_320.0)
    }
    fun distanceSquared(p:LinePoint,a:LinePoint,b:LinePoint):Double{
        val dx=b.x-a.x;val dy=b.y-a.y;val length=dx*dx+dy*dy
        val t=if(length==0.0)0.0 else (((p.x-a.x)*dx+(p.y-a.y)*dy)/length).coerceIn(0.0,1.0)
        return (p.x-a.x-t*dx).pow(2)+(p.y-a.y-t*dy).pow(2)
    }
    val keep=BooleanArray(points.size);keep[0]=true;keep[points.lastIndex]=true
    val pending=java.util.ArrayDeque<Pair<Int,Int>>();pending.addLast(0 to points.lastIndex)
    while(pending.isNotEmpty()){
        val (start,end)=pending.removeLast();var farthest=-1;var maximum=tolerance*tolerance
        for(i in start+1 until end){val distance=distanceSquared(points[i],points[start],points[end]);if(distance>maximum){maximum=distance;farthest=i}}
        if(farthest>=0){keep[farthest]=true;pending.addLast(start to farthest);pending.addLast(farthest to end)}
    }
    return JsonArray(points.filterIndexed{index,_->keep[index]}.map{it.raw})
}
