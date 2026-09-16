@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.co.waboranggae.nativepilot.data.*

@Composable fun CourseDetail(state:TravelUiState,model:TravelViewModel,auth:AccountState,account:AccountViewModel) {
    val course=state.selectedCourse?:return
    var savePrompt by remember(course.id){mutableStateOf(false)}
    var scoreDetails by remember(course.id){mutableStateOf(false)}
    val photos=course.places.filter{!it.imageUrl.isNullOrBlank()}.distinctBy{it.imageUrl}.take(4)
    var photoIndex by remember(course.id){mutableIntStateOf(0)}
    Column(Modifier.fillMaxSize().background(Soft).testTag("course-detail")) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            Box(Modifier.fillMaxWidth().height(320.dp)) {
                Photo(model.repository.imageUrl(photos.getOrNull(photoIndex)?.imageUrl),course.title,Modifier.fillMaxSize(),contentScale=ContentScale.Crop)
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha=.15f),Color.Transparent,Color.Black.copy(alpha=.75f)))))
                Surface(onClick=model::back,color=Color.White.copy(alpha=.95f),shape=RoundedCornerShape(100.dp),modifier=Modifier.padding(18.dp)) {
                    Box(Modifier.size(40.dp),contentAlignment=Alignment.Center){Icon(PilotIcons.Back,"추천 목록으로",Modifier.size(20.dp),tint=Ink)}
                }
                Column(Modifier.align(Alignment.CenterEnd).padding(end=12.dp),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                    photos.forEachIndexed{index,p->Surface(onClick={photoIndex=index},shape=RoundedCornerShape(12.dp),border=androidx.compose.foundation.BorderStroke(2.dp,Color.White),modifier=Modifier.size(50.dp)){
                        Photo(model.repository.imageUrl(p.imageUrl),p.name,Modifier.fillMaxSize(),contentScale=ContentScale.Crop)
                    }}
                }
                Column(Modifier.align(Alignment.BottomStart).padding(start=20.dp,end=76.dp,bottom=22.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                    Surface(color=Color(0xFFECFDF5),shape=RoundedCornerShape(6.dp)){Text("실제 관광정보",Modifier.padding(horizontal=8.dp,vertical=3.dp),fontSize=10.sp,color=Purple,fontWeight=FontWeight.Bold)}
                    Text(course.title,fontSize=23.sp,lineHeight=29.sp,fontWeight=FontWeight.Black,color=Color.White)
                    Text(course.city,fontSize=12.sp,color=Color.White.copy(alpha=.85f))
                }
            }
            Row(Modifier.fillMaxWidth().background(Color.White).padding(vertical=18.dp),horizontalArrangement=Arrangement.SpaceEvenly) {
                listOf("현지 예상시간" to formatMinutes(course.timeBreakdown?.totalMinutes ?: (course.durationHours*60).toInt()),"걷기 부담" to if(course.walkingScore>=85)"낮음" else if(course.walkingScore>=70)"보통" else "높음","추천 점수" to course.fitScore.toInt().toString()).forEach{(label,value)->
                    Column(Modifier.weight(1f),horizontalAlignment=Alignment.CenterHorizontally){Text(label,fontSize=11.sp,color=Muted);Text(value,fontSize=16.sp,fontWeight=FontWeight.ExtraBold,modifier=Modifier.padding(top=5.dp))}
                }
            }
            Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
                if(state.routingBusyId==course.id)LinearProgressIndicator(Modifier.fillMaxWidth().testTag("routing-loading"))
                state.routingError?.let{Text(it,fontSize=12.sp,color=Muted)}
                if(!course.constraintPassed){Text(course.constraintViolations.firstOrNull()?:"설정한 조건을 벗어난 구간이 있어요.",fontSize=12.sp,color=MaterialTheme.colorScheme.error);TextButton(model::changeTripConditions){Text("시간·조건 변경")}}
                Surface(shape=RoundedCornerShape(24.dp),color=Color.White,shadowElevation=1.dp){Column(Modifier.fillMaxWidth().padding(18.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                    Text("이 코스를 추천한 이유",fontSize=12.sp,fontWeight=FontWeight.Bold,color=Muted)
                    Text(course.reason.summary,fontSize=14.sp,lineHeight=22.sp)
                    HorizontalDivider(color=Soft)
                    Text(course.movementSummary(),fontSize=12.sp,color=Muted)
                    Text(if(course.routeSource=="kakao")"경로 확인" else if(course.routeSource=="mixed")"일부 구간 추정" else "이동 시간 추정",fontSize=10.sp,color=Muted,modifier=Modifier.testTag("routing-source"))
                }}
                Surface(shape=RoundedCornerShape(24.dp),color=Color.White){Row(Modifier.fillMaxWidth().padding(4.dp),horizontalArrangement=Arrangement.spacedBy(4.dp)){
                    listOf(false to "타임라인",true to "점수 분석").forEach{(value,label)->Surface(onClick={scoreDetails=value},shape=RoundedCornerShape(18.dp),color=if(scoreDetails==value)Ink else Color.White,modifier=Modifier.weight(1f)){Box(Modifier.padding(12.dp),contentAlignment=Alignment.Center){Text(label,fontSize=13.sp,color=if(scoreDetails==value)Color.White else Muted,fontWeight=FontWeight.Bold)}}}
                }}
                if(scoreDetails)ScoreAnalysis(course) else JourneyTimeline(course,model.repository)
                if(state.detailBusy||auth.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
                state.detailError?.let{Text(it,fontSize=12.sp,color=MaterialTheme.colorScheme.error)}
                auth.message?.let{Text(it,fontSize=12.sp,color=Muted)}
            }
        }
        Surface(color=Color.White,shadowElevation=6.dp){
            Row(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=14.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
                Column(Modifier.weight(1f)){Text("추천 / 뚜벅이",fontSize=9.sp,color=Muted);Text("${course.fitScore.toInt()} / ${course.walkingScore.toInt()}",fontSize=17.sp,fontWeight=FontWeight.ExtraBold)}
                if(state.preferences!=null)OutlinedIconButton({model.navigate(Page.EDITOR)},enabled=!state.detailBusy&&!auth.busy,modifier=Modifier.size(42.dp).testTag("edit-course")){Icon(PilotIcons.Edit,"코스 편집",Modifier.size(18.dp))}
                Button({
                    if(auth.user!=null && auth.bookmarks.none{it.text("courseId")==course.id})savePrompt=true else model.confirmTravel(course.id)
                },enabled=course.canPreviewRoute()&&!auth.busy,shape=RoundedCornerShape(100.dp),colors=ButtonDefaults.buttonColors(containerColor=Color(0xFF16A34A)),contentPadding=PaddingValues(horizontal=15.dp),modifier=Modifier.heightIn(min=46.dp).testTag("confirm-course")){Text("이 코스로 여행하기",fontSize=13.sp,fontWeight=FontWeight.ExtraBold,maxLines=1)}
            }
        }
    }
    if(savePrompt)AppDialog(onDismissRequest={savePrompt=false},title={Text("이 코스로 여행 확정")},text={Text("내 여행에도 코스를 저장할까요? 출발 장소·좌표와 방문 일정이 계정에 연결되어 직접 삭제하거나 탈퇴할 때까지 보관됩니다.")},
        confirmButton={TextButton({savePrompt=false;account.save(course){model.confirmTravel(course.id)}}){Text("코스 저장")}},
        dismissButton={TextButton({savePrompt=false;model.confirmTravel(course.id)}){Text("저장 없이 여행하기")}})
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
