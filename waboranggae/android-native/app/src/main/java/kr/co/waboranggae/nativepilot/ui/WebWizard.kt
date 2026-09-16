@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale
import kotlinx.coroutines.launch
import kr.co.waboranggae.nativepilot.data.PlaceSuggestion

@Composable fun WebWizard(state:TravelUiState,model:TravelViewModel) {
    val f=state.form;val step=state.wizardStep;val focus=LocalFocusManager.current
    var regions by remember { mutableStateOf(false) }
    if(regions)DestinationPicker(state.cities,f.city,{city->model.chooseDestination(city);regions=false},{regions=false})
    var datePicker by remember{mutableStateOf<String?>(null)}
    var timePicker by remember{mutableStateOf<String?>(null)}
    datePicker?.let{target->TravelDateDialog(if(target=="end")f.endDate?:f.date else f.date,{value->model.updateForm{if(target=="end")it.copy(endDate=value) else it.copy(date=value,endDate=it.endDate?.let{end->maxOf(end,value)})};datePicker=null},{datePicker=null})}
    timePicker?.let{target->TravelTimeDialog(if(target=="start")f.startTime else f.endTime,{value->model.updateForm{if(target=="start")it.copy(startTime=value)else it.copy(endTime=value)};timePicker=null},{timePicker=null})}
    Column(Modifier.fillMaxSize().background(WebSoft).imePadding()) {
        Row(Modifier.padding(start=20.dp,end=20.dp,top=16.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
            Surface(onClick=model::back,shape=RoundedCornerShape(100.dp),color=Soft,border=BorderStroke(1.dp,WebBorder)) {
                Box(Modifier.size(44.dp),contentAlignment=Alignment.Center) { Icon(PilotIcons.Back,"이전 단계",Modifier.size(22.dp),tint=Ink) }
            }
            Column(Modifier.weight(1f)) {
                Row(horizontalArrangement=Arrangement.spacedBy(4.dp)) { repeat(4) { index->Box(Modifier.weight(1f).height(3.dp).background(if(index<step)Ink else WebBorder,RoundedCornerShape(2.dp))) } }
                Text("단계 $step / 4",fontSize=12.sp,color=WebMuted,modifier=Modifier.padding(top=6.dp).testTag("wizard-step"))
            }
        }
        key(step) { Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(start=24.dp,end=24.dp,top=28.dp,bottom=24.dp)) {
            val title=listOf("어디서\n출발하세요?","어디로\n떠날까요?","어떻게\n여행할까요?","어떤 여행을\n원하세요?")[step-1]
            val subtitle=listOf("","전남 22개 지역 중 목적지 선택","내게 맞는 걷기 부담과 여행 속도","가고 싶은 곳과 식사 계획을 골라주세요")[step-1]
            Text(title,fontSize=30.sp,lineHeight=35.sp,fontWeight=FontWeight.Black,letterSpacing=(-.9).sp)
            if(step!=1)Text(subtitle,fontSize=14.sp,color=WebMuted,modifier=Modifier.padding(top=6.dp,bottom=24.dp))
            f.requiredPlace?.let{place->
                Surface(color=Color.White,shape=RoundedCornerShape(16.dp),border=BorderStroke(1.dp,WebBorder),modifier=Modifier.fillMaxWidth().padding(bottom=18.dp).testTag("required-place")) {
                    Row(Modifier.padding(start=16.dp,end=6.dp,top=12.dp,bottom=12.dp),verticalAlignment=Alignment.CenterVertically){
                        Column(Modifier.weight(1f)){
                            Text("꼭 가볼 곳",fontSize=11.sp,color=Muted)
                            Text(place.name,fontSize=15.sp,fontWeight=FontWeight.Bold)
                            place.periodShort?.takeIf{it.isNotBlank()}?.let{Text(it,fontSize=12.sp,color=Muted)}
                        }
                        TextButton(model::clearRequiredPlace,modifier=Modifier.testTag("required-place-remove")){Text("제외")}
                    }
                }
            }
            when(step) {
                1->{
                    OutlinedTextField(f.query,model::changeQuery,modifier=Modifier.fillMaxWidth().testTag("departure-query"),
                        placeholder={Text("가게, 명소, 주소 — 전국 검색",fontSize=14.sp)},singleLine=true,shape=RoundedCornerShape(18.dp),
                        colors=OutlinedTextFieldDefaults.colors(focusedBorderColor=Ink,unfocusedBorderColor=WebBorder),
                        keyboardOptions=KeyboardOptions(imeAction=ImeAction.Search),keyboardActions=KeyboardActions(onSearch={focus.clearFocus();model.search()}),
                        trailingIcon={IconButton(onClick={focus.clearFocus();model.search()},enabled=!state.searching){Icon(PilotIcons.Search,"출발지 검색")}})
                    if(state.searching) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top=10.dp))
                    state.searchError?.let { Text(it,color=Muted,fontSize=13.sp,modifier=Modifier.padding(top=10.dp).testTag("departure-error")) }
                    NearbyDepartureCandidates(state.suggestions,query=f.query,enabled=f.departure==null){p->focus.clearFocus();model.chooseDeparture(p)}
                    f.departure?.let { p->Surface(color=Color(0xFFECFDF5),shape=RoundedCornerShape(14.dp),modifier=Modifier.padding(top=14.dp).fillMaxWidth()) {
                        Column(Modifier.padding(14.dp)) { Text("✓ ${p.name}",fontWeight=FontWeight.Bold,fontSize=14.sp,modifier=Modifier.testTag("selected-departure"));Text(p.address,fontSize=12.sp,color=Muted) }
                    } }
                    DepartureSearchMap(f.departure,state.suggestions,model::resolveMapPoint)
                    if(state.mapResolving)Text("선택한 위치 확인 중…",fontSize=12.sp,color=Muted,modifier=Modifier.padding(top=10.dp))
                }
                2->{
                    Surface(onClick={regions=true},enabled=state.cities.isNotEmpty(),shape=RoundedCornerShape(20.dp),color=Color.White,
                        border=BorderStroke(1.dp,WebBorder),modifier=Modifier.fillMaxWidth().testTag("destination-city")) {
                        Row(Modifier.padding(18.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
                            Surface(shape=RoundedCornerShape(14.dp),color=Color(0xFFE1F1E7)) {
                                Box(Modifier.size(46.dp),contentAlignment=Alignment.Center){Icon(PilotIcons.Map,null,Modifier.size(23.dp),tint=Purple)}
                            }
                            Column(Modifier.weight(1f)){Text("여행 지역",fontSize=12.sp,color=WebMuted);Text(f.city.ifBlank{"여행지 선택"},fontSize=19.sp,fontWeight=FontWeight.Bold,color=if(f.city.isBlank())Muted else Ink)}
                            Icon(PilotIcons.Down,"여행지 변경",Modifier.size(20.dp),tint=Purple)
                        }
                    }
                    state.cityError?.let { Text(it,fontSize=12.sp);TextButton(model::loadCities){Text("지역 다시 불러오기")} }
                    WebSectionLabel("여행 날짜")
                    OutlinedButton(onClick={datePicker="start"},shape=RoundedCornerShape(14.dp),modifier=Modifier.fillMaxWidth()) { Text(f.date,color=Ink) }
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){Text("여러 날 여행",modifier=Modifier.weight(1f));Switch(checked=f.endDate!=null,onCheckedChange={value->model.updateForm{it.copy(endDate=if(value)it.date else null)}},colors=SwitchDefaults.colors(checkedTrackColor=Ink),modifier=Modifier.testTag("multiple-days"))}
                    if(f.endDate!=null){OutlinedButton({datePicker="end"},shape=RoundedCornerShape(14.dp),modifier=Modifier.fillMaxWidth().testTag("trip-end-date")){Text("마지막 여행 날짜 · ${f.endDate}",color=Ink)};Text("최대 7일 · 같은 지역에서 날짜마다 새 코스를 만들어요.",fontSize=12.sp,color=Muted)}
                    WebSectionLabel("시작 시각")
                    OutlinedButton(onClick={timePicker="start"},shape=RoundedCornerShape(14.dp),modifier=Modifier.fillMaxWidth()) { Text("${formatKoreanClock(f.startTime)} 현지 여행 시작",color=Ink) }
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                        Text("종료 시각 설정",color=Ink,modifier=Modifier.weight(1f))
                        Switch(checked=f.limitEndTime,onCheckedChange={value->model.updateForm{it.copy(limitEndTime=value)}},modifier=Modifier.testTag("end-time-limit"),colors=SwitchDefaults.colors(checkedTrackColor=Ink))
                    }
                    if(f.limitEndTime)OutlinedButton(onClick={timePicker="end"},shape=RoundedCornerShape(14.dp),modifier=Modifier.fillMaxWidth().testTag("travel-end-time")) { Text("${formatKoreanClock(f.endTime)}까지",color=Ink) }
                    Text("예상 소요 시간은 코스에서 확인하세요 · 도시 간 이동 별도",fontSize=12.sp,color=WebMuted,modifier=Modifier.padding(top=14.dp))
                }
                3->{
                    WebSectionLabel("걷기 부담")
                    SelectCard("🚶","보통","걷기와 대중교통을 함께 이용해요",!f.lowMobility){model.updateForm{it.copy(lowMobility=false)}}
                    SelectCard("🌿","적게 걷기","걷기 부담이 적은 코스를 우선해요",f.lowMobility){model.updateForm{it.copy(lowMobility=true)}}
                    WebSectionLabel("여행 속도")
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        listOf("easy" to "여유롭게","balanced" to "적당히","full" to "알차게").forEach{(id,label)->WebChip(label,f.pace==id){model.updateForm{it.copy(pace=id)}}}
                    }
                }
                4->{
                    WebSectionLabel("여행 목적")
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        listOf("nature" to "자연 명소","food" to "맛집 탐방","cafe" to "카페","history" to "역사·문화","market" to "시장·골목").forEach { (id,label)->
                            WebChip(label,id in f.interests){model.updateForm{it.copy(interests=if(id in it.interests)it.interests-id else it.interests+id)}} }
                    }
                    Text("취향에 맞는 코스를 찾아드려요. 이동 거리와 시간에 따라 일부 목적은 포함되지 않을 수 있어요.",fontSize=12.sp,lineHeight=18.sp,color=Muted,modifier=Modifier.padding(top=12.dp))
                    WebSectionLabel("식사")
                    FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                        listOf("auto" to "자동","breakfast" to "아침","lunch" to "점심","dinner" to "저녁").forEach { (id,label)->
                            val enabled=id=="auto" || id in f.availableMeals()
                            val selected=if(id=="auto") f.meals==null && f.meal=="auto" else f.meals?.contains(id)==true
                            FilterChip(selected=selected,onClick={model.updateForm{it.toggleMeal(id)}},enabled=enabled,
                                label={Text(label)},shape=RoundedCornerShape(100.dp),modifier=Modifier.testTag("meal-$id"),
                                colors=FilterChipDefaults.filterChipColors(selectedContainerColor=Ink,selectedLabelColor=Color.White))
                        }
                    }
                    Text("방문 전 가게의 영업시간을 확인해 주세요.",fontSize=12.sp,color=Muted,modifier=Modifier.padding(top=8.dp))
                    if(f.meals?.isEmpty()==true)Text("식사 제외",fontSize=12.sp,color=WebMuted,modifier=Modifier.padding(top=8.dp))
                }
            }
        } }
        Column(Modifier.fillMaxWidth().background(WebSoft).padding(horizontal=24.dp,vertical=12.dp)) {
            state.error?.let { Text(it,color=Color(0xFFDC2626),fontSize=13.sp,modifier=Modifier.padding(bottom=10.dp).testTag("recommend-error")) }
            if(step<4) WebAction("다음 →",{focus.clearFocus();model.nextWizardStep()},Modifier.testTag("wizard-next"))
            else WebAction("이 조건으로 추천받기",{focus.clearFocus();model.recommend()},Modifier.testTag("recommend"),enabled=!state.loading)
        }
    }
    state.mapChoice?.let{place->AppDialog(onDismissRequest=model::dismissMapChoice,title={Text("출발 장소")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){Text(place.name,fontWeight=FontWeight.Bold);Text(place.address,fontSize=13.sp)}},confirmButton={TextButton({model.chooseDeparture(place)}){Text("여기서 출발")}},dismissButton={TextButton(model::dismissMapChoice){Text("취소")}})}
}
@Composable private fun SelectCard(emoji:String,label:String,desc:String,on:Boolean,action:()->Unit) {
    Surface(onClick=action,shape=RoundedCornerShape(18.dp),color=if(on)Ink else Color.White,border=BorderStroke(2.dp,if(on)Ink else WebBorder),
        modifier=Modifier.fillMaxWidth().padding(bottom=10.dp)) {
        Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
            if(emoji.isNotEmpty())Text(emoji,fontSize=22.sp)
            Column(Modifier.weight(1f)) { Text(label,fontSize=15.sp,fontWeight=if(on)FontWeight.Bold else FontWeight.Medium,color=if(on)Color.White else Ink);Text(desc,fontSize=12.sp,color=if(on)Color.White.copy(alpha=.7f) else WebMuted) }
            if(on)Text("✓",color=Color.White)
        }
    }
}
