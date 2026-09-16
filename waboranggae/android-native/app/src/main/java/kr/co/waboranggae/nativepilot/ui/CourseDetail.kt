@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.*
import java.time.LocalDate
import kr.co.waboranggae.nativepilot.data.*

@Composable fun CourseDetail(state:TravelUiState,model:TravelViewModel,auth:AccountState,account:AccountViewModel) {
    val course=state.selectedCourse?:return
    val context=androidx.compose.ui.platform.LocalContext.current
    var saving by remember{mutableStateOf<String?>(null)}
    var scoreDetails by remember{mutableStateOf(false)}
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp).testTag("course-detail"),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        TextButton(model::back){Text("‹ 추천 목록")}
        Text(course.title,fontSize=25.sp,fontWeight=FontWeight.Black)
        Text("${course.city} · ${course.places.size}곳",color=Muted)
        val photo=course.places.firstOrNull{!it.imageUrl.isNullOrBlank()}
        Photo(model.repository.imageUrl(photo?.imageUrl),course.title,Modifier.fillMaxWidth().height(210.dp),overlayCredit=false)
        Text("${if(course.timeBudgetMode=="local")"현지 " else ""}${formatHours(course.durationHours)}시간 · 도보 ${course.walkMinutes}분 · 대중교통 ${course.transitMinutes}분",fontWeight=FontWeight.Bold)
        course.accessTrip?.let{access->
            Text("도시 간 이동 · 코스 시간에서 제외",fontWeight=FontWeight.SemiBold,modifier=Modifier.testTag("access-trip"))
            Text("${access.origin.name} → ${access.arrival.name}\n"+(access.segment?.let{"약 ${formatMinutes(it.totalMinutes)} · 대중교통"}?:"소요 시간 확인 필요"),fontSize=13.sp,color=Muted)
            access.externalUrl?.takeIf{it.startsWith("https://map.kakao.com/link/by/traffic/")}?.let{url->
                TextButton({runCatching{context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW,android.net.Uri.parse(url)))}}){Text("도시 간 길찾기")}
            }
        }
        course.timeBreakdown?.let{time->
            Text("${if(course.accessTrip!=null)"도착 거점" else "출발지"} → 첫 장소 ${formatMinutes(time.originToFirstMinutes)}\n장소 사이 이동 ${formatMinutes(time.betweenPlacesMinutes)} · 관광·식사·휴식 ${formatMinutes(time.stayMinutes)}"+(if(time.waitAndRestMinutes>0)"\n대기·야간 휴식 ${formatMinutes(time.waitAndRestMinutes)}" else ""),fontSize=13.sp,modifier=Modifier.testTag("travel-time-breakdown"))
            Text("총 ${formatMinutes(time.totalMinutes)}"+(time.requestedMinutes?.let{" · 제한 ${formatMinutes(it)}"}?:"")+" · 귀가 이동 제외",fontSize=12.sp,color=Muted)
        }
        Text(if(course.routeSource=="kakao")"카카오 길찾기 반영 · 조회 시점 기준" else if(course.routeSource=="mixed")"카카오 길찾기 반영 · 일부 추정" else "이동 시간 추정",fontSize=12.sp,color=Muted,modifier=Modifier.testTag("routing-source"))
        if(state.routingBusyId==course.id){LinearProgressIndicator(Modifier.fillMaxWidth().testTag("routing-loading"));Text("길찾기 시간 확인 중",fontSize=12.sp)}
        state.routingError?.let{Text(it,color=MaterialTheme.colorScheme.error,fontSize=12.sp)}
        if(!course.constraintPassed){
            Text("조건 확인 필요",color=MaterialTheme.colorScheme.error,modifier=Modifier.testTag("route-constraint-warning"))
            course.constraintViolations.ifEmpty{listOf("여행 조건을 다시 확인해 주세요.")}.forEach{Text(it,fontSize=13.sp,color=MaterialTheme.colorScheme.error)}
            TextButton(model::changeTripConditions,modifier=Modifier.testTag("change-trip-conditions")){Text("시간·조건 변경")}
        }
        if(state.preferences!=null)TextButton({model.refreshRouting(course.id,true)},enabled=state.routingBusyId==null){Text("길찾기 시간 새로고침")}
        if(state.detailBusy)LinearProgressIndicator(Modifier.fillMaxWidth())
        state.detailError?.let{Text(it,color=MaterialTheme.colorScheme.error)}
        Text("추천 점수",fontSize=20.sp,fontWeight=FontWeight.Bold)
        Text("종합 ${course.fitScore.toInt()} / 100 · 뚜벅이 ${course.walkingScore.toInt()} / 100")
        Text("취향 ${course.preferenceScore.toInt()} · 시간 적합 ${course.timeFitScore.toInt()} · 코스 품질 ${course.courseQualityScore.toInt()}",fontSize=12.sp)
        TextButton({scoreDetails=!scoreDetails}){Text(if(scoreDetails)"점수 기준 접기" else "점수 기준")}
        if(scoreDetails){
            course.walkingBreakdown?.let{b->Text("항목별 100점 기준\n걷기 ${b.walk.toInt()} · 대중교통 ${b.transit.toInt()} · 이동 시간 ${b.time.toInt()} · 환승 ${b.transfer.toInt()} · 거리/숙소 ${b.distance.toInt()} · 체류 ${b.efficiency.toInt()}",fontSize=12.sp,color=Muted)}
            Text("항목별 가중 합계 · 보행환경 현장 조사 점수 아님",fontSize=11.sp,color=Muted)
            course.reason.evidence.take(3).forEach{Text(it,fontSize=12.sp,color=Muted)}
        }
        Text("여행일 날씨 · ${course.city}",fontSize=20.sp,fontWeight=FontWeight.Bold)
        val p=state.preferences
        if(p!=null){
            val first=LocalDate.parse(p.travelDate);val last=LocalDate.parse(p.travelEndDate?:p.travelDate)
            FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)){
                generateSequence(first){it.plusDays(1)}.takeWhile{!it.isAfter(last)}.take(4).forEach{date->WebChip(date.toString().substring(5),state.weatherDate==date.toString()){model.loadTravelWeather(date.toString())}}
            }
        }
        val w=state.weather
        if(w?.get("available")?.jsonPrimitive?.booleanOrNull==true){
            Text("${w.text("requestedDate")} · ${w.text("condition")}\n여행 시간대 ${w.text("minTemperature")}~${w.text("maxTemperature")}℃"+(w.text("maxRainProbability").takeIf{it.isNotBlank()}?.let{" · 강수확률 최대 $it%"}?:""),fontSize=13.sp,modifier=Modifier.testTag("trip-forecast"))
            Text("기상청 · ${w.text("issuedAt")} 발표",fontSize=11.sp,color=Muted)
        }else Text(if(state.weatherLoading)"예보 확인 중" else w?.text("reason")?.ifBlank{null}?:if(p==null)"여행 날짜를 선택해 다시 추천해 주세요." else "예보를 불러오지 못했습니다.",fontSize=13.sp,modifier=Modifier.testTag("trip-forecast-unavailable"))
        Text("방문 일정",fontSize=20.sp,fontWeight=FontWeight.Bold)
        Text("출발: ${course.origin?.name}\n${course.origin?.address}")
        course.places.forEachIndexed{index,p->
            Surface(shape=RoundedCornerShape(18.dp),color=MaterialTheme.colorScheme.surface){Column(Modifier.fillMaxWidth().padding(14.dp),verticalArrangement=Arrangement.spacedBy(7.dp)){
                Text("${index+1}. ${p.name}",fontWeight=FontWeight.Bold)
                Text("${p.arrival} · 머무는 시간 ${p.stayMinutes}분",fontSize=12.sp)
                Text(p.address,fontSize=12.sp,color=Muted)
                course.routeSegments.getOrNull(index)?.let{Text("이동 ${formatMinutes(it.totalMinutes)}"+if(it.source=="estimated")" · 추정"else "",fontSize=12.sp,color=Muted)}
                course.routeSegments.getOrNull(index)?.let{segment->var expanded by remember{mutableStateOf(false)};if(segment.steps.isNotEmpty()){TextButton({expanded=!expanded}){Text(if(expanded)"이동 상세 접기" else "이동 상세")};if(expanded)segment.steps.forEach{s->Text("${s.label} · ${s.minutes}분",fontSize=12.sp,color=Muted)}}}
            }}
        }
        if(state.preferences!=null)OutlinedButton({model.navigate(Page.EDITOR)},enabled=!state.detailBusy,modifier=Modifier.fillMaxWidth().testTag("edit-course")){Text("장소·방문 순서 수정")}
        if(auth.user==null)OutlinedButton(account::loginScreen,modifier=Modifier.fillMaxWidth()){Text("로그인하고 여행 저장")}
        else {
            FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                OutlinedButton({saving="course"},enabled=!auth.busy && course.constraintPassed && state.routingBusyId==null){Text("코스 저장")}
                if(state.preferences!=null)OutlinedButton({saving="history"},enabled=!auth.busy){Text("최근 여행에 조건 저장")}
            }
            auth.message?.let{Text(it,fontSize=12.sp,color=Purple)}
        }
        WebAction(if(course.constraintPassed)"이 코스로 동선 확인" else "동선 미리보기",{model.navigate(Page.MAP)},enabled=course.canPreviewRoute(),modifier=Modifier.testTag("confirm-course"))
        Text("출처: ⓒ한국관광공사(관광정보·사진) · 카카오(장소·지도·길찾기) · 기상청(날씨). 사진별 이용조건 적용 · 이동 시간은 조회 시점 기준.",fontSize=11.sp,color=Muted,modifier=Modifier.testTag("course-source-notice"))
    }
    if(saving!=null)AppDialog(onDismissRequest={saving=null},title={Text("여행 정보를 계정에 저장할까요?")},text={Text("출발 장소·좌표, 여행 일시·취향과 선택한 코스가 계정에 연결되어 저장됩니다. 내 여행에서 삭제하거나 탈퇴할 때까지 보관됩니다. 거부해도 추천·지도는 이용할 수 있습니다.")},confirmButton={TextButton({if(saving=="course")account.save(course)else state.preferences?.let{account.saveHistory(it)};saving=null}){Text("동의하고 저장")}},dismissButton={TextButton({saving=null}){Text("취소")}})
}
@Composable fun CourseEditor(state:TravelUiState,model:TravelViewModel) {
    val course=state.selectedCourse?:return
    var ids by remember(course){mutableStateOf(course.places.map{it.id})}
    val pool=state.courses.flatMap{it.places}.associateBy{it.id}
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        TextButton(model::back,enabled=!state.detailBusy){Text("‹ 변경 취소")}
        Text("코스 편집",fontSize=26.sp,fontWeight=FontWeight.Black)
        Text("순서를 바꾸고 일정을 다시 계산하세요.",fontSize=13.sp,color=Muted)
        ids.forEachIndexed{index,id->Surface(shape=RoundedCornerShape(18.dp)){Column(Modifier.fillMaxWidth().padding(12.dp)){
            Text("${index+1}. ${pool[id]?.name}",fontWeight=FontWeight.Bold)
            Row{
                TextButton({ids=ids.toMutableList().apply{add(index-1,removeAt(index))}},enabled=index>0 && !state.detailBusy){Text("위로")}
                TextButton({ids=ids.toMutableList().apply{add(index+1,removeAt(index))}},enabled=index<ids.lastIndex && !state.detailBusy){Text("아래로")}
                TextButton({ids=ids.filter{it!=id}},enabled=ids.size>1 && !state.detailBusy,modifier=Modifier.testTag("remove-course-place")){Text("제외")}
            }
        }}}
        Text("추천 장소 추가",fontWeight=FontWeight.Bold)
        pool.values.filter{it.id !in ids}.forEach{p->OutlinedButton({ids=ids+p.id},enabled=ids.size<40 && !state.detailBusy){Text("+ ${p.name}")}}
        state.detailError?.let{Text(it,color=MaterialTheme.colorScheme.error)}
        if(state.detailBusy)LinearProgressIndicator(Modifier.fillMaxWidth())
        WebAction("동선 다시 계산",{model.edit(ids)},enabled=!state.detailBusy && ids.isNotEmpty(),modifier=Modifier.testTag("apply-course-edit"))
    }
}
