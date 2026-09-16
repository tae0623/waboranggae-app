@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import android.app.DatePickerDialog
import androidx.activity.compose.LocalActivity
import android.app.TimePickerDialog
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import kotlinx.serialization.json.jsonObject
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
        if(state.page !in listOf(Page.CONDITIONS,Page.EDITOR,Page.DETAIL)) WebBottomBar(state.page) { page ->
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
                Text("${state.generationProgress} · ${seconds}초")
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
    val confirmed=state.confirmedCourse
    Column(Modifier.fillMaxSize().testTag("map-page")) {
        PageHeader("여행 동선",if(state.tripDays.size>1)"전체 일정" else confirmed?.title.orEmpty()){if(confirmed==null)model.navigate(Page.RESULTS)else model.openDetails(confirmed.id)}
        if(confirmed==null){EmptyState("여행할 코스를 선택해 주세요.","추천 코스 보기"){model.navigate(Page.RESULTS)};return}
        if(state.preferences==null && state.tripDays.isEmpty()){
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
                Text("저장된 코스",fontWeight=FontWeight.Bold)
                ExpandableNativeMap(confirmed,Modifier.fillMaxWidth().height(360.dp))
                JourneyTimeline(confirmed,model.repository,images=true)
            };return
        }
        val days=if(state.tripDays.size>1)state.tripDays else listOf(TripDay(state.preferences?.travelDate.orEmpty(),state.preferences?:return,confirmed.id))
        // A non-lazy container keeps map views alive when the page scrolls.
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal=16.dp,vertical=12.dp),verticalArrangement=Arrangement.spacedBy(24.dp)){
            days.forEachIndexed { index,day->
                val course=state.courses.find{it.id==day.courseId}
                if(course==null){Text("DAY ${index+1} · ${day.date}\n${day.error.orEmpty()}",color=MaterialTheme.colorScheme.error);return@forEachIndexed}
                key(course.id){
                    Column(verticalArrangement=Arrangement.spacedBy(14.dp)){
                        if(days.size>1)Text("DAY ${index+1} · ${day.date}",fontSize=20.sp,fontWeight=FontWeight.ExtraBold)
                        DayWeather(course,day.preferences,model.repository)
                        Text(course.title,fontSize=18.sp,fontWeight=FontWeight.Bold)
                        Text("현지 여행 ${formatMinutes(course.timeBreakdown?.totalMinutes ?: (course.durationHours*60).toInt())}",fontWeight=FontWeight.Bold)
                        Text(course.movementSummary(),fontSize=12.sp,color=Muted)
                        day.preferences.endTime?.let{end->val slack=java.time.Duration.between(java.time.LocalTime.parse(day.preferences.startTime),java.time.LocalTime.parse(end)).toMinutes().toInt()-(course.timeBreakdown?.totalMinutes ?: (course.durationHours*60).toInt());if(slack>0)Text("여유 시간 ${formatMinutes(slack)}",fontSize=12.sp,color=Muted)}
                        ExpandableNativeMap(course,Modifier.fillMaxWidth().height(360.dp).clip(RoundedCornerShape(24.dp)))
                        JourneyTimeline(course,model.repository,images=true)
                    }
                }
            }
        }
    }
}
@Composable private fun DayWeather(course:Course,preferences:Preferences,repository:TravelRepository){
    var weather by remember(course.id,preferences.travelDate){mutableStateOf<kotlinx.serialization.json.JsonObject?>(null)}
    var loading by remember{mutableStateOf(true)}
    LaunchedEffect(course.id,preferences.travelDate){
        val point=course.places.firstNotNullOfOrNull{it.coordinate()}?:course.origin?.coordinate()
        try{
            if(point!=null){
                val until=java.time.LocalTime.parse(preferences.startTime).plusMinutes((course.timeBreakdown?.totalMinutes ?: (course.durationHours*60).toInt()).toLong())
                weather=repository.api("/api/weather/forecast?lat=${point.latitude}&lng=${point.longitude}&date=${preferences.travelDate}&startTime=${preferences.startTime}&endTime=$until").jsonObject
            }
        }catch(e:Exception){if(e is kotlinx.coroutines.CancellationException)throw e}finally{loading=false}
    }
    TravelWeatherCard(TravelUiState(preferences=preferences,weather=weather,weatherDate=preferences.travelDate,weatherLoading=loading))
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
