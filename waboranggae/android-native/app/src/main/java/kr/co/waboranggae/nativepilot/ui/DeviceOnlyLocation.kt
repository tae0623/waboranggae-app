package kr.co.waboranggae.nativepilot.ui

import kr.co.waboranggae.nativepilot.data.PlaceSuggestion
import kotlin.math.*

/** UI-only, deliberately not Serializable/Parcelable and not convertible to an API coordinate. */
class DeviceOnlyLocation private constructor(private val latitude:Double,private val longitude:Double) {
    fun distanceMeters(place:PlaceSuggestion):Int {
        val lat=Math.toRadians(place.latitude-latitude);val lng=Math.toRadians(place.longitude-longitude)
        val a=sin(lat/2).pow(2)+cos(Math.toRadians(latitude))*cos(Math.toRadians(place.latitude))*sin(lng/2).pow(2)
        return (6371000*2*atan2(sqrt(a.coerceIn(0.0,1.0)),sqrt((1-a).coerceIn(0.0,1.0)))).roundToInt()
    }
    override fun toString()="DeviceOnlyLocation[private]"
    companion object {
        fun create(latitude:Double,longitude:Double):DeviceOnlyLocation? =
            if(latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0)DeviceOnlyLocation(latitude,longitude) else null
    }
}
internal const val DEVICE_LOCATION_TIMEOUT_MS=5_000L
internal suspend fun withinDeviceLocationBudget(read:suspend()->DeviceOnlyLocation?):DeviceOnlyLocation? =
    kotlinx.coroutines.withTimeoutOrNull(DEVICE_LOCATION_TIMEOUT_MS){read()}

data class NearbySuggestion(val place:PlaceSuggestion,val distanceMeters:Int?)
private fun normalizedSearch(value:String)=java.text.Normalizer.normalize(value,java.text.Normalizer.Form.NFKC)
    .lowercase(java.util.Locale.ROOT).replace(Regex("[^\\p{L}\\p{N}]"),"")
/** Lexical relevance groups; Kakao does not expose a numeric relevance score. */
fun searchRelevanceTier(place:PlaceSuggestion,query:String):Int {
    val q=normalizedSearch(query);if(q.isBlank())return 0
    val name=normalizedSearch(place.name);val address=normalizedSearch(place.address)
    val tokens=Regex("[\\p{L}]+|[\\p{N}]+").findAll(query.lowercase(java.util.Locale.ROOT)).map{it.value}.toList()
    fun containsToken(text:String,token:String)=if(token.all{it.isDigit()})
        Regex("(?<!\\d)"+Regex.escape(token)+"(?!\\d)").containsMatchIn(text) else text.contains(token)
    fun matches(text:String)=tokens.isNotEmpty() && tokens.all{containsToken(text,it)}
    return when {
        name==q->0
        address==q->0
        name.contains(q) && matches(name)->1
        matches(name)->2
        matches(name+" "+address)->3
        else->4
    }
}
fun sortOnDevice(places:List<PlaceSuggestion>,location:DeviceOnlyLocation?,query:String=""):List<NearbySuggestion> {
    val results=places.map{NearbySuggestion(it,location?.distanceMeters(it))}
    if(location==null)return results // Preserve provider accuracy order without a device fix.
    return results.withIndex().sortedWith(compareBy<IndexedValue<NearbySuggestion>>{searchRelevanceTier(it.value.place,query)}
        .thenBy{it.value.distanceMeters}.thenBy{it.index}).map{it.value}
}

/** Monotonic age check; accepts only a recent OS-held fix, never persists it in the app. */
fun isRecentDeviceFix(fixElapsedNanos:Long,nowElapsedNanos:Long):Boolean =
    fixElapsedNanos>0 && nowElapsedNanos>=fixElapsedNanos &&
        nowElapsedNanos-fixElapsedNanos<=120_000_000_000L
