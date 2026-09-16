@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

@Composable fun WebCourses(state:TravelUiState,model:TravelViewModel) {
    var sort by remember { mutableStateOf("추천순") }
    val courses=when(sort) {
        "적게 걷기"->state.courses.sortedBy{it.walkMinutes}
        "이동 짧게"->state.courses.sortedBy{it.walkMinutes+it.transitMinutes}
        else->state.courses
    }
    Column(Modifier.fillMaxSize().testTag("results")) {
        Column(Modifier.fillMaxWidth().background(Color.White).padding(20.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) {
                Text("추천 코스 ${courses.size}개",fontSize=22.sp,fontWeight=FontWeight.Black,modifier=Modifier.weight(1f))
                TextButton({model.navigate(Page.CONDITIONS)}){Text("조건 수정",fontSize=12.sp,color=Muted)}
            }
            Text("${state.form.city} · ${formatKoreanClock(state.form.startTime)} 시작"+(if(state.form.limitEndTime)" · ${formatKoreanClock(state.form.endTime)}까지" else ""),fontSize=12.sp,color=Muted)
            Row(Modifier.padding(top=16.dp).horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                listOf("추천순","적게 걷기","이동 짧게").forEach{label->WebChip(label,sort==label){sort=label}}
            }
        }
        if(courses.isEmpty()) {
            Column(Modifier.padding(24.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
                Text("아직 추천받은 코스가 없어요.");WebAction("조건 선택하기",{model.navigate(Page.CONDITIONS)})
            }
        }
        LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
            itemsIndexed(courses,key={_,c->c.id}) { index,course->
                Surface(onClick={model.openDetails(course.id)},shape=RoundedCornerShape(24.dp),color=Color.White,
                    shadowElevation=3.dp,modifier=Modifier.fillMaxWidth().testTag("course-card")) {
                    Column {
                        val photo=course.places.firstOrNull{!it.imageUrl.isNullOrBlank()}
                        Box(Modifier.fillMaxWidth().height(if(index==0)220.dp else 160.dp)) {
                            Photo(model.repository.imageUrl(photo?.imageUrl),photo?.name ?: course.title,Modifier.fillMaxSize(),overlayCredit=false)
                            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent,Color.Black.copy(alpha=.5f)))))
                            Surface(color=Color.White,shape=RoundedCornerShape(100.dp),modifier=Modifier.align(Alignment.TopEnd).padding(12.dp)) {
                                Text("★ ${course.fitScore.toInt()}점",Modifier.padding(horizontal=12.dp,vertical=7.dp),fontSize=12.sp,fontWeight=FontWeight.Bold)
                            }
                            Column(Modifier.align(Alignment.BottomStart).padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                                Surface(color=Color(0xFFECFDF5),shape=RoundedCornerShape(6.dp)) { Text("실제 관광정보",Modifier.padding(horizontal=7.dp,vertical=3.dp),fontSize=10.sp,color=Color(0xFF059669),fontWeight=FontWeight.Bold) }
                                Text(course.city,color=Color.White,fontSize=20.sp,fontWeight=FontWeight.Black)
                            }
                        }
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                            Text(course.title,fontSize=15.sp,fontWeight=FontWeight.ExtraBold,lineHeight=22.sp,modifier=Modifier.testTag("course-title"))
                            Text(course.places.joinToString(" → "){it.name},fontSize=12.sp,color=Muted)
                            FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                                listOf("${if(course.timeBudgetMode=="local")"현지 " else ""}약 ${formatMinutes(course.timeBreakdown?.totalMinutes ?: (course.durationHours*60).toInt())}","도보 ${course.walkMinutes}분","대중교통 ${course.transitMinutes}분").forEach { metric->
                                    Surface(color=Soft,shape=RoundedCornerShape(100.dp)){Text(metric,Modifier.padding(horizontal=10.dp,vertical=5.dp),fontSize=11.sp,color=Muted)}
                                }
                            }
                            course.accessTrip?.let{access->Text("도시 간 이동 "+(access.segment?.let{"약 ${formatMinutes(it.totalMinutes)}"}?:"확인 필요")+" · 별도",fontSize=11.sp,color=Muted)}
                            Text("뚜벅이 적합도 ${course.walkingScore.toInt()}점 · ${course.places.size}곳",fontSize=11.sp,color=Color(0xFF0D9488))
                            Text(if(course.routeSource=="kakao")"카카오 길찾기 확인" else if(course.routeSource=="mixed")"일부 구간 추정 · 길찾기 확인 필요" else "이동 시간 추정 · 길찾기 확인 필요",fontSize=11.sp,color=Muted,modifier=Modifier.testTag("course-routing-status"))
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.End){Text("코스 상세 · 저장 · 지도 보기  ›",fontSize=12.sp,fontWeight=FontWeight.Bold)}
                        }
                    }
                }
            }
            item { SourceFooter("출처: ⓒ한국관광공사(관광정보·사진) · 카카오(장소·지도·길찾기)\n사진별 이용조건 적용 · 현지 코스 기준, 도시 간·귀가 이동 별도") }
        }
    }
}
