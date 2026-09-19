@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.co.waboranggae.nativepilot.data.*
import kotlinx.serialization.json.*

@Composable fun FiveStars(score:Double,modifier:Modifier=Modifier) {
    val rating=(if(score.isFinite())score else 0.0).coerceIn(0.0,100.0)/20
    Row(modifier.semantics{contentDescription=String.format(java.util.Locale.ROOT,"%.1f / 5점",rating)},horizontalArrangement=Arrangement.spacedBy(2.dp)) {
        repeat(5){index->Box(Modifier.size(19.dp)) {
            Icon(PilotIcons.Star,null,Modifier.fillMaxSize(),tint=Color(0xFFE4E4E9))
            val part=(rating-index).coerceIn(0.0,1.0).toFloat()
            if(part>0)Box(Modifier.fillMaxHeight().fillMaxWidth(part).clipToBounds()) { Icon(PilotIcons.Star,null,Modifier.wrapContentSize(Alignment.TopStart,unbounded=true).requiredSize(19.dp),tint=Color(0xFFEAB308)) }
        }}
    }
}
@Composable fun DayScorePair(course:Course){
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
        Surface(color=Soft,shape=RoundedCornerShape(14.dp),modifier=Modifier.weight(1f)){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){Text("추천 점수",fontSize=11.sp,color=Muted);Text("${course.fitScore.toInt()}점",fontWeight=FontWeight.ExtraBold,fontSize=19.sp)}}
        Surface(color=Color(0xFFECF7F0),shape=RoundedCornerShape(14.dp),modifier=Modifier.weight(1f)){Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){Text("뚜벅이 적합도",fontSize=11.sp,color=Purple);Text("${course.walkingScore.toInt()}점",fontWeight=FontWeight.ExtraBold,fontSize=19.sp,color=Purple);FiveStars(course.walkingScore)}}
    }
}
@Composable fun ScoreAnalysis(course:Course) {
    Surface(shape=RoundedCornerShape(24.dp),color=Color.White,shadowElevation=1.dp) { Column(Modifier.fillMaxWidth().padding(18.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment=Alignment.Bottom,horizontalArrangement=Arrangement.spacedBy(8.dp)){Text(course.fitScore.toInt().toString(),fontSize=46.sp,fontWeight=FontWeight.Black);Column{Text("추천 점수",fontWeight=FontWeight.Bold);Text("/ 100점",fontSize=11.sp,color=Muted)}}
        listOf("취향 적합도" to course.preferenceScore,"뚜벅이 적합도" to course.walkingScore,"시간 적합도" to course.timeFitScore,"코스 완성도" to course.courseQualityScore).forEach{(label,value)->
            Column(verticalArrangement=Arrangement.spacedBy(7.dp)){Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(label,fontSize=13.sp);Text(value.toInt().toString(),fontWeight=FontWeight.Bold)};LinearProgressIndicator(progress={value.toFloat().coerceIn(0f,100f)/100},modifier=Modifier.fillMaxWidth().height(6.dp),color=Ink,trackColor=Soft)}
        }
    }}
    Surface(shape=RoundedCornerShape(24.dp),color=Color.White,shadowElevation=1.dp) { Column(Modifier.fillMaxWidth().padding(18.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment=Alignment.Bottom,horizontalArrangement=Arrangement.spacedBy(8.dp)){Text(course.walkingScore.toInt().toString(),fontSize=46.sp,color=Color(0xFF0D9488),fontWeight=FontWeight.Black);Column{Text("뚜벅이 적합도",fontWeight=FontWeight.Bold);Text("/ 100점",fontSize=11.sp,color=Muted)}}
        FiveStars(course.walkingScore,Modifier.testTag("walking-score-stars"))
        val b=course.walkingBreakdown
        val rows=listOf(
            Triple("도보 부담",b?.walk,"도보 시간이 짧고 걷기 부담이 적을수록 높아요."),
            Triple("대중교통 접근성",b?.transit,"정류장 거리, 운행 간격·노선 수, 이동 시간과 환승 횟수를 함께 봐요."),
            Triple("시간 적합도",b?.time,"현지 일정에서 이동에 드는 시간이 적을수록 높아요."),
            Triple("환승 편의성",b?.transfer,"갈아타는 횟수가 적을수록 높아요."),
            Triple("이동 거리",b?.distance,"방문 장소가 모여 있어 동선이 짧을수록 높아요."),
            Triple("이동 효율",b?.efficiency,"이동보다 장소에서 보내는 시간의 비중이 클수록 높아요."))
        rows.forEachIndexed{index,(label,value,detail)->
            Column(verticalArrangement=Arrangement.spacedBy(6.dp)){Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){Text(label,fontSize=13.sp,fontWeight=FontWeight.SemiBold,modifier=Modifier.weight(1f));Column(horizontalAlignment=Alignment.End){FiveStars(value?:0.0);Text(value?.let{"${it.toInt()} / 100"}?:"점수 미확인",fontSize=11.sp,color=Muted)}};Text(detail,fontSize=11.sp,lineHeight=17.sp,color=Muted)}
            if(index<rows.lastIndex)HorizontalDivider(color=Soft)
        }
    }}
}
@Composable fun TransitLegCard(segment:RouteSegment?,access:Boolean=false) {
    Surface(shape=RoundedCornerShape(18.dp),color=if(access)Color(0xFFEEF2FF)else Color(0xFFECF7F0),modifier=Modifier.fillMaxWidth().testTag(if(access)"access-trip" else "transit-leg")) {
        Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
            Text((if(access)"도시 간 이동 · "else "이동 · ")+(segment?.let{formatMinutes(it.totalMinutes)}?:"시간 미확인"),fontSize=13.sp,fontWeight=FontWeight.Bold)
            if(access)Text("현지 코스 시간 별도",fontSize=10.sp,color=Muted)
            else if(segment?.source!="kakao")Text("추정 구간",fontSize=10.sp,color=Muted)
            if(segment?.steps.isNullOrEmpty())Text(segment?.instruction?.ifBlank{null}?:"이 구간의 상세 경로를 확인하지 못했어요.",fontSize=12.sp,color=Muted)
            val groups=segment?.steps.orEmpty().fold(mutableListOf<MutableList<TransitStep>>()){groups,step->
                if(step.mode=="walk"&&groups.lastOrNull()?.lastOrNull()?.mode=="walk")groups.last().add(step)else groups.add(mutableListOf(step));groups
            }
            groups.forEachIndexed{index,steps->
                if(index>0)Text("↓",color=Muted,modifier=Modifier.align(Alignment.CenterHorizontally))
                if(steps.first().mode=="walk"){
                    var expanded by remember(segment,index){mutableStateOf(false)}
                    Surface(shape=RoundedCornerShape(14.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(12.dp)){
                        TextButton({expanded=!expanded},contentPadding=PaddingValues(0.dp)){Icon(PilotIcons.Walk,null,Modifier.size(18.dp));Text("  도보 · 약 ${formatMinutes(steps.sumOf{it.minutes})}  "+if(expanded)"⌃" else "⌄",fontWeight=FontWeight.Bold)}
                        if(expanded)steps.forEach{Text(it.label,fontSize=12.sp,color=Muted,modifier=Modifier.padding(vertical=5.dp))}
                    }}
                } else steps.forEach{s->
                    Surface(shape=RoundedCornerShape(14.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                        Text(if(s.mode=="other")"이동·대기" else "승차",fontSize=11.sp,color=Purple,fontWeight=FontWeight.Bold)
                        s.fromStop?.takeIf{it.isNotBlank()}?.let{Text(it,fontSize=15.sp,fontWeight=FontWeight.Bold)}
                        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){
                            (s.routes.ifEmpty{s.route?.let{listOf(it)}?:emptyList()}).forEach{route->Surface(color=Purple,shape=RoundedCornerShape(6.dp)){Text(route,Modifier.padding(horizontal=8.dp,vertical=4.dp),fontSize=13.sp,color=Color.White,fontWeight=FontWeight.Bold)}}
                            Text(formatMinutes(s.minutes),fontSize=13.sp,fontWeight=FontWeight.Bold)
                        }
                        Text(s.label,fontSize=12.sp,color=Muted,lineHeight=18.sp)
                        s.toStop?.takeIf{it.isNotBlank()}?.let{HorizontalDivider(color=Soft);Text("↓ 하차 · "+it,fontSize=14.sp,fontWeight=FontWeight.Bold)}
                        if(s.stops.size>2){var expanded by remember{mutableStateOf(false)};TextButton({expanded=!expanded},contentPadding=PaddingValues(0.dp)){Text(if(expanded)"경유 정류장 접기" else "경유 정류장 보기",fontSize=11.sp)};if(expanded)Text(s.stops.joinToString(" → "),fontSize=11.sp,color=Muted)}
                    }}
                }
            }
        }
    }
}
@Composable private fun TimelineNode(label:String,color:Color=Ink,content:@Composable ColumnScope.()->Unit) {
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min),horizontalArrangement=Arrangement.spacedBy(12.dp)) {
        Box(Modifier.width(32.dp).fillMaxHeight()) {
            Box(Modifier.align(Alignment.TopCenter).padding(top=30.dp).width(2.dp).fillMaxHeight().background(Color(0xFFDCE4DF)))
            Surface(shape=RoundedCornerShape(100.dp),color=color,modifier=Modifier.padding(top=8.dp).size(32.dp)){Box(contentAlignment=Alignment.Center){Text(label,fontSize=12.sp,color=Color.White,fontWeight=FontWeight.Bold)}}
        }
        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(10.dp),content=content)
    }
}
@Composable fun JourneyTimeline(course:Course,repository:TravelRepository,images:Boolean=false,onPlace:((MapStop)->Unit)?=null) {
    Column(verticalArrangement=Arrangement.spacedBy(16.dp)) {
        course.accessTrip?.let{access->TimelineNode("출",Color(0xFF6366F1)){
            Surface(shape=RoundedCornerShape(18.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Text("도시로 이동",fontSize=11.sp,color=Muted);Text(access.origin.name,fontSize=16.sp,fontWeight=FontWeight.Bold);Text(access.origin.address,fontSize=12.sp,color=Muted)}}
            TransitLegCard(access.segment,true)
        }}
        course.origin?.let{origin->TimelineNode(if(course.accessTrip!=null)"1" else "출") {Surface(shape=RoundedCornerShape(18.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){Text(if(course.accessTrip!=null)"현지 도착" else "현지 여행 시작",fontSize=11.sp,color=Muted);Text(origin.name,fontSize=16.sp,fontWeight=FontWeight.Bold);Text(origin.address,fontSize=12.sp,color=Muted)}}}}
        course.places.forEachIndexed{index,p->
            Box(Modifier.padding(start=44.dp)){TransitLegCard(course.routeSegments.getOrNull(index))}
            TimelineNode((index+(if(course.accessTrip!=null)2 else 1)).toString(),Purple){
                Surface(shape=RoundedCornerShape(20.dp),color=Color.White,shadowElevation=1.dp) {Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    if(images&&!p.imageUrl.isNullOrBlank())Photo(repository.imageUrl(p.imageUrl),p.name,Modifier.fillMaxWidth().height(150.dp),contentScale=ContentScale.Crop)
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){Text(p.arrival,fontSize=12.sp,fontWeight=FontWeight.Bold);Text("${p.stayMinutes}분 체류",fontSize=11.sp,color=Muted)}
                    Text(p.name,fontSize=16.sp,fontWeight=FontWeight.Bold);Text(p.address,fontSize=12.sp,color=Muted)
                    if(p.description.isNotBlank())Text(p.description,fontSize=13.sp,lineHeight=20.sp,color=Muted)
                }}
            }
        }
    }
}
@Composable fun TravelWeatherCard(state:TravelUiState) {
    val w=state.weather
    val available=w?.get("available")?.jsonPrimitive?.booleanOrNull==true
    Surface(shape=RoundedCornerShape(24.dp),color=Color.Transparent,modifier=Modifier.fillMaxWidth().testTag("trip-forecast")){
        Row(Modifier.background(Brush.linearGradient(listOf(Color(0xFFDCFCE7),Color(0xFFD1FAE5)))).padding(18.dp),horizontalArrangement=Arrangement.spacedBy(14.dp),verticalAlignment=Alignment.CenterVertically){
            Text(when{!available->"🌦️";w?.text("condition")?.let{it.contains("비")||it.contains("눈")}==true->"🌧️";w?.text("condition")?.contains("흐림")==true->"☁️";w?.text("condition")=="맑음"->"☀️";else->"🌤️"},fontSize=28.sp)
            Column(verticalArrangement=Arrangement.spacedBy(4.dp)){
                Text("${state.weatherDate?:state.preferences?.travelDate.orEmpty()} · 여행일 날씨",fontSize=11.sp,color=Purple)
                Text(if(available)"${w!!.text("condition")} · ${w.text("minTemperature")}~${w.text("maxTemperature")}℃"+(w.text("maxRainProbability").takeIf{it.isNotBlank()}?.let{" · 강수확률 $it%"}?:"") else if(state.weatherLoading)"예보 확인 중…" else w?.text("reason")?.ifBlank{null}?:"여행 날짜의 예보를 불러오지 못했어요.",fontSize=13.sp,color=Color(0xFF14532D),fontWeight=FontWeight.SemiBold)
            }
        }
    }
}
