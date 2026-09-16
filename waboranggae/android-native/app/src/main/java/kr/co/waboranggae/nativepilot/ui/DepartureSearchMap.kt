package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.co.waboranggae.nativepilot.data.*

/** Only explicit search/selection data enters Kakao. Never use device-sorted candidates here. */
@Composable fun DepartureSearchMap(selected:PlaceSuggestion?, accuracyResults:List<PlaceSuggestion>) {
    val place=selected?:accuracyResults.firstOrNull()
    val frame=Modifier.fillMaxWidth().padding(top=18.dp).height(220.dp).clip(RoundedCornerShape(20.dp))
    if(place==null) {
        Box(frame.background(WebBorder).testTag("departure-map-empty"),contentAlignment=Alignment.Center) {
            Text("검색한 장소를 지도에서 확인하세요",fontSize=13.sp,color=WebMuted)
        }
        return
    }
    val preview=remember(place) { Course(id="departure-${place.id}-${place.latitude}-${place.longitude}",city="",title=place.name,
        durationHours=0.0,walkMinutes=0,transitMinutes=0,places=emptyList(),
        origin=Origin(place.name,place.address,place.latitude,place.longitude)) }
    val stop=preview.mapStops().first()
    Box(frame.testTag("departure-search-map")) {
        NativeCourseMap(preview,stop,{},Modifier.fillMaxSize())
    }
}
