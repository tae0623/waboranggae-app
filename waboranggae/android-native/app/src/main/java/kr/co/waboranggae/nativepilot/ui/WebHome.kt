@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import kr.co.waboranggae.nativepilot.data.*

@Composable fun WebHome(state:TravelUiState,model:TravelViewModel) {
    var notifications by remember { mutableStateOf(false) }
    var homeDay by remember { mutableStateOf(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"))) }
    LaunchedEffect(Unit){while(true){homeDay=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));kotlinx.coroutines.delay(30_000)}}
    val visiblePlaces=state.hotPlaces.filter{it.visibleOnHome(homeDay)}
    LazyColumn(Modifier.fillMaxSize().testTag("home")) {
        item {
            Box(Modifier.fillMaxWidth().height(428.dp)) {
                Box(Modifier.fillMaxWidth().height(400.dp).background(Brush.linearGradient(listOf(Color(0xFF174438),Color(0xFF3F6A68))))) {
                    Photo(HOME_SCENERY_URL,"산 풍경",Modifier.fillMaxSize().testTag("hero-photo"),contentScale=androidx.compose.ui.layout.ContentScale.Crop)
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Black.copy(alpha=.08f),Color.Black.copy(alpha=.12f),Color.Black.copy(alpha=.72f)))))
                    Row(Modifier.fillMaxWidth().padding(top=28.dp,start=20.dp,end=20.dp),verticalAlignment=Alignment.CenterVertically) {
                        Surface(shape=RoundedCornerShape(10.dp),color=Color.White) { Box(Modifier.size(40.dp),contentAlignment=Alignment.Center) { BrandMark(Modifier.size(40.dp)) } }
                        Text("뚜버기",Modifier.padding(start=8.dp),fontSize=18.sp,fontWeight=FontWeight.ExtraBold,color=Color.White)
                        Spacer(Modifier.weight(1f))
                        Surface(onClick={notifications=true},shape=RoundedCornerShape(100.dp),color=Color.White.copy(alpha=.18f)) { Box(Modifier.size(38.dp),contentAlignment=Alignment.Center) { Icon(PilotIcons.Bell,"알림 준비 상태",Modifier.size(17.dp),tint=Color.White) } }
                    }
                    Column(Modifier.align(Alignment.BottomStart).padding(start=20.dp,end=20.dp,bottom=96.dp)) {
                        Text("전남을\n걸어봐요",fontSize=36.sp,lineHeight=40.sp,fontWeight=FontWeight.Black,color=Color.White,letterSpacing=(-1).sp)
                        Text("가볍게 떠나는 전남 여행",fontSize=13.sp,color=Color.White.copy(alpha=.72f),modifier=Modifier.padding(top=10.dp))
                    }
                }
                Surface(onClick={model.navigate(Page.CONDITIONS)},shape=RoundedCornerShape(24.dp),color=Color.White,
                    shadowElevation=12.dp,modifier=Modifier.align(Alignment.BottomCenter).padding(horizontal=20.dp).fillMaxWidth().testTag("plan-trip")) {
                    Row(Modifier.padding(horizontal=18.dp,vertical=16.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)) {
                        Surface(color=Ink,shape=RoundedCornerShape(14.dp)) { Box(Modifier.size(46.dp),contentAlignment=Alignment.Center){Icon(PilotIcons.Search,null,Modifier.size(20.dp),tint=Color.White)} }
                        Column(Modifier.weight(1f)) { Text("여행 코스 만들기",fontSize=15.sp,fontWeight=FontWeight.Bold);Text("출발지 · 일정 · 여행 취향",fontSize=12.sp,color=WebMuted) }
                        Surface(color=Soft,shape=RoundedCornerShape(100.dp)) { Box(Modifier.size(32.dp),contentAlignment=Alignment.Center){Text("›",fontSize=24.sp)} }
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(start=20.dp,end=20.dp,top=28.dp,bottom=14.dp)) {
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Bottom) {
                    Text("전남 여행 소식",fontSize=20.sp,fontWeight=FontWeight.Black,modifier=Modifier.weight(1f))
                    Text(state.hotUpdated?.let{runCatching{java.time.Instant.parse(it).atZone(java.time.ZoneId.of("Asia/Seoul")).toLocalDate().toString().replace("-",". ")}.getOrNull()} ?: if(state.hotLoading) "불러오는 중" else "",fontSize=11.sp,color=WebMuted)
                }
            }
        }
        if(state.hotLoading || state.hotError!=null || visiblePlaces.isEmpty()) item {
            Surface(shape=RoundedCornerShape(24.dp),color=Color.White,modifier=Modifier.padding(horizontal=20.dp).fillMaxWidth()) {
                Column(Modifier.padding(24.dp),horizontalAlignment=Alignment.CenterHorizontally) {
                    Text(if(state.hotLoading) "전남의 축제·관광정보를 불러오는 중이에요." else state.hotError ?: "표시할 여행 소식이 아직 없어요.",fontSize=14.sp)
                    if(state.hotError!=null) TextButton(model::loadHotPlaces) { Text("다시 불러오기") }
                }
            }
        }
        visiblePlaces.firstOrNull()?.let { place -> item { Box(Modifier.padding(horizontal=20.dp)){HotCard(place,model,0)} } }
        if(visiblePlaces.size>1) item {
            Row(Modifier.padding(start=20.dp,end=20.dp,top=12.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                visiblePlaces.drop(1).take(2).forEach { place->Box(Modifier.weight(1f)){HotCard(place,model,1)} }
            }
        }
        visiblePlaces.drop(3).forEach { place -> item { Box(Modifier.padding(start=20.dp,end=20.dp,top=10.dp)){HotCard(place,model,2)} } }
        item { SourceFooter("출처: ⓒ한국관광공사(관광정보·사진)\n배경 사진: Unsplash",Modifier.padding(horizontal=20.dp)) }
    }
    if(notifications) AppDialog(onDismissRequest={notifications=false},confirmButton={TextButton({notifications=false}){Text("확인")}},
        title={Text("알림 안내")},text={Text("푸시 알림은 아직 제공하지 않습니다. 여행 정보는 앱에서 직접 확인해 주세요.")})
}
private fun hotMetric(p:HotPlace)=if(p.source=="festival" || p.category=="축제·행사") p.periodShort ?: p.statusLabel ?: "행사" else if(p.visitors>0) "${p.metricLabel ?: "지표"} ${p.visitors.toInt()}" else p.metricLabel ?: "관광정보"
@Composable private fun HotBadge(p:HotPlace) {
    if(p.isNew || p.isTrending) Surface(color=if(p.isTrending)Color(0xFFFEF2F2)else Color(0xFFECFDF5),shape=RoundedCornerShape(6.dp)) {
        Text(if(p.isTrending)"🔥 HOT" else "✨ NEW",Modifier.padding(horizontal=7.dp,vertical=2.dp),fontSize=10.sp,fontWeight=FontWeight.ExtraBold,color=if(p.isTrending)Color(0xFFDC2626)else Color(0xFF059669))
    }
}
@Composable private fun HotPicture(p:HotPlace,model:TravelViewModel,modifier:Modifier) {
    Box(modifier.background(Soft)) {
        Photo(model.repository.imageUrl(p.img),p.name,Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent,Color.Black.copy(alpha=.35f)))))
        Surface(color=Color.White.copy(alpha=.94f),shape=RoundedCornerShape(100.dp),modifier=Modifier.align(Alignment.TopEnd).padding(10.dp)) {
            Text("👀 ${hotMetric(p)}",Modifier.padding(horizontal=10.dp,vertical=5.dp),fontSize=11.sp,fontWeight=FontWeight.Bold)
        }
        Row(Modifier.align(Alignment.BottomStart).padding(12.dp),horizontalArrangement=Arrangement.spacedBy(6.dp)) { HotBadge(p);Text(p.category,fontSize=10.sp,color=Color.White) }
    }
}
@Composable private fun HotCard(p:HotPlace,model:TravelViewModel,kind:Int) {
    Surface(onClick={model.openHotPlace(p.id)},shape=RoundedCornerShape(24.dp),color=Color.White,shadowElevation=3.dp,
        modifier=Modifier.fillMaxWidth().testTag("hot-place-card")) {
        if(kind==2) Row(Modifier.heightIn(min=125.dp)) {
            Box(Modifier.width(110.dp).height(135.dp)){Photo(model.repository.imageUrl(p.img),p.name,Modifier.fillMaxSize())}
            Column(Modifier.padding(14.dp).weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                Text(p.category+" · "+hotMetric(p),fontSize=10.sp,color=Muted)
                Text(p.name,fontSize=14.sp,fontWeight=FontWeight.ExtraBold,maxLines=2,overflow=TextOverflow.Ellipsis)
                Text("⌖ ${p.city}",fontSize=11.sp,color=WebMuted)
                Text(p.desc,fontSize=12.sp,color=Muted,maxLines=2,overflow=TextOverflow.Ellipsis)
            }
        } else Column {
            HotPicture(p,model,Modifier.fillMaxWidth().height(if(kind==0)200.dp else 120.dp))
            Column(Modifier.padding(if(kind==0)16.dp else 12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)) {
                Text(p.name,fontSize=if(kind==0)16.sp else 13.sp,fontWeight=FontWeight.ExtraBold,maxLines=2,overflow=TextOverflow.Ellipsis)
                Text("⌖ ${p.city}",fontSize=12.sp,color=WebMuted)
                Text(p.desc,fontSize=if(kind==0)13.sp else 11.sp,color=Muted,lineHeight=20.sp,maxLines=if(kind==0)4 else 2,overflow=TextOverflow.Ellipsis)
                if(kind==0) FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp)) { p.tags.forEach { tag->Surface(color=Soft,shape=RoundedCornerShape(100.dp)){Text("# $tag",Modifier.padding(horizontal=10.dp,vertical=4.dp),fontSize=11.sp,color=Muted)} } }
            }
        }
    }
}
@Composable fun WebHotDetail(state:TravelUiState,model:TravelViewModel) {
    val p=state.selectedHotPlace ?: return
    LazyColumn(Modifier.fillMaxSize().testTag("hot-place-detail")) {
        item {
            Box(Modifier.fillMaxWidth().height(280.dp)) {
                Photo(model.repository.imageUrl(p.img),p.name,Modifier.fillMaxSize())
                Surface(onClick=model::back,color=Color.White.copy(alpha=.95f),shape=RoundedCornerShape(100.dp),modifier=Modifier.padding(20.dp)) { Box(Modifier.size(40.dp),contentAlignment=Alignment.Center){Text("‹",fontSize=30.sp)} }
            }
        }
        item { Column(Modifier.padding(24.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
            HotBadge(p);Text(p.name,fontSize=26.sp,fontWeight=FontWeight.Black)
            Text("${p.city} · ${p.category}",fontSize=13.sp,color=Muted)
            Text(p.story ?: p.desc,fontSize=14.sp,lineHeight=24.sp)
            listOf("기간" to p.periodLabel,"장소" to (p.eventPlace ?: p.address),"운영 시간" to p.hours,"입장료" to p.fee,"문의" to p.tel,"주최" to p.sponsor).filter{!it.second.isNullOrBlank()}.forEach { (label,value)->
                Surface(color=Color.White,shape=RoundedCornerShape(14.dp),modifier=Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Text(label,fontSize=11.sp,color=WebMuted);Text(value.orEmpty(),fontSize=14.sp) } }
            }
            WebAction("이 장소 포함해 코스 만들기",{model.planFromHotPlace(p)},Modifier.testTag("hot-place-plan"),enabled=p.tourContentId()!=null)
            if(p.tourContentId()==null)Text("장소 정보를 확인한 후 코스를 만들 수 있어요.",fontSize=12.sp,color=Muted)
            SourceFooter("출처: ⓒ한국관광공사(관광정보) · 사진: ${p.imageCredit ?: "ⓒ한국관광공사"}")
            p.metricNote?.let{note->var expanded by remember{mutableStateOf(false)};TextButton({expanded=!expanded}){Text("지표 기준")};if(expanded)Text(note,fontSize=12.sp,color=Muted)}
        } }
    }
}
