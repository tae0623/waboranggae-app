@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import android.app.DatePickerDialog
import androidx.activity.compose.LocalActivity
import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import kr.co.waboranggae.nativepilot.R
import kr.co.waboranggae.nativepilot.data.*
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale
import kotlinx.coroutines.delay

val Ink = Color(0xFF1C1C1E)
val Muted = Color(0xFF636366)
val Purple = Color(0xFF166534)
val Soft = Color(0xFFF2F4F8)
private val cardShape=RoundedCornerShape(24.dp)
@Composable fun WaboranggaeTheme(content: @Composable ()->Unit) {
    MaterialTheme(colorScheme=lightColorScheme(primary=Purple, onPrimary=Color.White, surface=Color.White,
        background=Soft,onSurface=Ink,onBackground=Ink,primaryContainer=Color(0xFFDCFCE7)), typography=webTypography(), content=content)
}
@Composable fun SetupError(message: String) {
    Box(Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),contentAlignment=Alignment.Center) { Text(message) }
}
@Composable fun TravelApp(model: TravelViewModel,account:AccountViewModel) {
    val activity=LocalActivity.current
    var showExit by remember { mutableStateOf(false) }
    val state by model.state.collectAsStateWithLifecycle()
    val auth by account.state.collectAsStateWithLifecycle()
    var previousUser by remember{mutableStateOf<String?>(null)}
    LaunchedEffect(auth.user){val current=auth.user?.text("id");if(previousUser!=null && current==null)model.clearPersonalTravel();previousUser=current}
    var showIntro by rememberSaveable { mutableStateOf(true) }
    if(showIntro) { BrandIntro { showIntro=false }; return }
    if(auth.checking){Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){CircularProgressIndicator()};return}
    if(auth.needsConsent){AccountConsentScreen(auth,account);return}
    if(auth.showLogin){LoginScreen(state,model,auth,account);return}
    BackHandler { if(state.page==Page.HOME)showExit=true else model.back() }
    if(showExit)AppDialog(onDismissRequest={showExit=false},modifier=Modifier.testTag("exit-dialog"),title={Text("뚜버기를 종료할까요?")},
        confirmButton={TextButton({showExit=false;activity?.finishAndRemoveTask()},modifier=Modifier.testTag("exit-confirm")){Text("앱 종료")}},
        dismissButton={TextButton({showExit=false},modifier=Modifier.testTag("exit-cancel")){Text("취소")}})
    Scaffold(containerColor=Soft, bottomBar={
        if(state.page !in listOf(Page.CONDITIONS,Page.EDITOR)) WebBottomBar(state.page) { page ->
            if(page==Page.RESULTS && state.courses.isEmpty()) model.navigate(Page.CONDITIONS)
            else model.navigate(page)
        }
    }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when(state.page) {
                Page.HOME->WebHome(state,model)
                Page.CONDITIONS->WebWizard(state,model)
                Page.RESULTS->WebCourses(state,model)
                Page.MAP->MapPage(state,model)
                Page.HOT_PLACE->WebHotDetail(state,model)
                Page.MY_TRAVEL->MyTravel(auth,account,model)
                Page.DETAIL->CourseDetail(state,model,auth,account)
                Page.EDITOR->CourseEditor(state,model)
            }
        }
    }
    if(state.loading) {
        var seconds by remember { mutableIntStateOf(0) }
        LaunchedEffect(Unit) { while(true) { delay(1000); seconds++ } }
        AppDialog(onDismissRequest={},title={Text("코스 찾는 중")},
            text={Column(verticalArrangement=Arrangement.spacedBy(16.dp)) {
                LinearProgressIndicator(Modifier.fillMaxWidth())
                Text("${seconds}초 · 잠시만 기다려 주세요")
            }},confirmButton={TextButton(onClick=model::cancelRecommendation) { Text("취소") }})
    }
}
@Composable private fun PageHeader(title:String,subtitle:String,onBack:()->Unit) {
    Row(Modifier.fillMaxWidth().padding(top=6.dp,bottom=12.dp),verticalAlignment=Alignment.CenterVertically) {
        IconButton(onClick=onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack,"뒤로") }
        Column { Text(title,fontSize=22.sp,fontWeight=FontWeight.ExtraBold); Text(subtitle,fontSize=12.sp,color=Muted) }
    }
}
@Composable private fun MapPage(state:TravelUiState,model:TravelViewModel) {
    val course=state.selectedCourse
    Column(Modifier.fillMaxSize().testTag("map-page")) {
        PageHeader("여행 동선","코스 선택",model::back)
        if(course==null) { EmptyState("먼저 코스를 추천받아 주세요.","조건 선택하기"){model.navigate(Page.CONDITIONS)}; return }
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal=18.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            state.courses.forEachIndexed { index,c ->
                Box(Modifier.testTag("map-course-${index+1}")) { WebChip("코스 ${index+1}",c.id==course.id){model.selectCourse(c.id)} }
            }
        }
        Text(course.title,Modifier.padding(horizontal=20.dp,vertical=8.dp).testTag("map-course-title"),fontSize=16.sp,fontWeight=FontWeight.Bold)
        course.accessTrip?.let{access->Text("현지 출발: ${access.arrival.name} · 도시 간 이동 별도",Modifier.padding(horizontal=20.dp),fontSize=12.sp,color=Muted)}
        Text("도보 ${course.walkMinutes}분 · 대중교통 ${course.transitMinutes}분",Modifier.padding(horizontal=20.dp),fontSize=12.sp,color=Muted)
        if(state.routingBusyId==course.id)LinearProgressIndicator(Modifier.fillMaxWidth().padding(horizontal=20.dp).testTag("routing-loading"))
        if(!course.constraintPassed)Text(course.constraintViolations.firstOrNull()?:"조건 확인이 필요한 미리보기 코스",Modifier.padding(horizontal=20.dp),fontSize=12.sp,color=MaterialTheme.colorScheme.error)
        Row(Modifier.padding(horizontal=12.dp)){TextButton({model.openDetails(course.id)}){Text("코스 상세")};TextButton(model::clearCourseSelection){Text("코스 선택 해제")}}
        key(course.id) {
            var selected by remember { mutableStateOf(course.mapStops().first()) }
            LazyColumn {
                item {
                    NativeCourseMap(course,selected,{selected=it},Modifier.fillMaxWidth().height(325.dp))
                    if(course.routeSource!="kakao")Text("일부 이동 시간 추정",Modifier.padding(horizontal=18.dp,vertical=8.dp),fontSize=12.sp,color=Muted)
                }
                item {
                    Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal=18.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        course.mapStops().forEach { stop ->
                            Box(Modifier.testTag("map-stop-${stop.index}")) { WebChip(if(stop.index==0) "출발" else "${stop.index}. ${stop.name}",stop.id==selected.id){selected=stop} }
                        }
                    }
                    PlaceInfo(selected,model.repository,course)
                }
                item {
                    Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                        Text("방문 순서",fontSize=19.sp,fontWeight=FontWeight.Bold)
                        course.mapStops().forEach { stop ->
                            Row(Modifier.fillMaxWidth().clickable{selected=stop}.padding(vertical=5.dp),horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                                Surface(color=if(stop.index==0) Color(0xFF15803D) else Purple,shape=RoundedCornerShape(12.dp)) {
                                    Text(if(stop.index==0) "출발" else stop.index.toString(),Modifier.padding(9.dp),fontSize=12.sp,color=Color.White)
                                }
                                Column {
                                    Text(stop.name,fontWeight=FontWeight.Bold)
                                    Text(stop.place?.let{"${it.arrival} · 머무는 시간 ${it.stayMinutes}분"} ?: course.origin?.address.orEmpty(),fontSize=12.sp,color=Muted)
                                    stop.place?.moveLabel?.takeIf{it.isNotBlank()}?.let{label->
                                        val estimated=course.routeSegments.getOrNull(stop.index-1)?.source!="kakao"
                                        Text("이전 장소에서: $label"+if(estimated)" · 추정" else "",fontSize=12.sp,color=Muted)
                                    }
                                }
                            }
                        }
                        SourceFooter("출처: ⓒ한국관광공사(관광정보·사진) · 카카오(장소·지도·길찾기)")
                    }
                }
            }
        }
    }
}
@Composable internal fun PlaceInfo(stop:MapStop,repository:TravelRepository,course:Course) {
    val context=LocalContext.current
    Surface(shape=cardShape,color=Color.White,modifier=Modifier.padding(horizontal=18.dp,vertical=8.dp).fillMaxWidth().testTag("map-place-info")) {
        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            stop.place?.imageUrl?.let { Photo(repository.imageUrl(it),stop.name,Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(16.dp)).testTag("map-place-photo")) }
            Text(stop.name,fontSize=18.sp,fontWeight=FontWeight.Bold)
            Text(stop.place?.address ?: course.origin?.address.orEmpty(),fontSize=12.sp,color=Muted)
            stop.place?.description?.takeIf{it.isNotBlank()}?.let { Text(it,fontSize=13.sp,color=Muted,maxLines=4,overflow=TextOverflow.Ellipsis) }
            course.directionsTo(stop)?.let { directions->
                TextButton(onClick={
                    val app=Intent(Intent.ACTION_VIEW,Uri.parse(directions.appUrl())).setPackage("net.daum.android.map")
                    runCatching{context.startActivity(app)}.recoverCatching{
                        context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(directions.webUrl())))
                    }.onFailure{android.widget.Toast.makeText(context,"카카오맵 또는 브라우저를 열 수 없어요.",android.widget.Toast.LENGTH_SHORT).show()}
                },modifier=Modifier.testTag("kakao-directions")) { Text("카카오맵에서 길찾기");Icon(PilotIcons.Open,null,Modifier.padding(start=6.dp).size(16.dp)) }
            }
        }
    }
}
@Composable private fun EmptyState(message:String,action:String,onClick:()->Unit) {
    Column(Modifier.fillMaxWidth().padding(30.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Icon(PilotIcons.Route,null,Modifier.size(44.dp),tint=Purple);Text(message);Button(onClick=onClick){Text(action)}
    }
}
@Composable fun Photo(url:String?,description:String,modifier:Modifier,overlayCredit:Boolean=false,contentScale:ContentScale=ContentScale.Fit) {
    var loaded by remember(url) { mutableStateOf(false) }
    var failed by remember(url) { mutableStateOf(false) }
    Box(modifier) {
        if(!loaded) Box(Modifier.fillMaxSize().background(Color(0xFFE8ECE9)),contentAlignment=Alignment.Center) {
            Text(if(failed || url.isNullOrBlank()) "사진 준비 중" else "사진 불러오는 중",fontSize=12.sp,color=Muted)
        }
        if(!url.isNullOrBlank()) AsyncImage(model=url,contentDescription=description,
            modifier=Modifier.fillMaxSize().then(if(loaded)Modifier.testTag("photo-loaded") else Modifier),
            contentScale=contentScale,onSuccess={loaded=true},onError={failed=true})

    }
}
fun formatHours(value:Double)=if(value%1.0==0.0)value.toInt().toString() else String.format(Locale.ROOT,"%.1f",value)
fun formatMinutes(minutes:Int)=when{minutes<60->"${minutes}분";minutes%60==0->"${minutes/60}시간";else->"${minutes/60}시간 ${minutes%60}분"}
