package kr.co.waboranggae.nativepilot.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.kakao.vectormap.*
import com.kakao.vectormap.camera.CameraUpdateFactory
import com.kakao.vectormap.label.LabelOptions
import com.kakao.vectormap.label.LabelStyle
import com.kakao.vectormap.label.LabelTextBuilder
import com.kakao.vectormap.route.RouteLineOptions
import com.kakao.vectormap.route.RouteLineSegment
import com.kakao.vectormap.route.RouteLineStyle
import kr.co.waboranggae.nativepilot.BuildConfig
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.data.Coordinate
import kotlinx.coroutines.delay

@Composable fun NativeCourseMap(course: Course, selected: MapStop?, onSelect: (MapStop)->Unit, modifier: Modifier = Modifier,onMapPoint:((Coordinate,String?)->Unit)?=null,cameraMemory:MapCameraMemory?=null) {
    if (BuildConfig.KAKAO_NATIVE_APP_KEY.isBlank()) {
        Box(modifier.background(Color(0xFFEDE9FE)).testTag("map-key-missing"),contentAlignment=Alignment.Center) {
            Column(Modifier.padding(24.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(12.dp)) {
                Icon(PilotIcons.Map,null,Modifier.size(42.dp),tint=Purple)
                Text("카카오 네이티브 지도 설정이 필요해요",color=Purple)
                Text("네이티브 앱 키와 Android 키 해시 등록 후\n이 영역에 실제 지도가 표시됩니다.",color=Muted,fontSize=13.sp)
                Text("아래의 방문 장소와 출발지는 실제 API 결과입니다.",color=Muted,fontSize=12.sp)
            }
        }
        return
    }
    var attempt by remember { mutableIntStateOf(0) }
    key(course.id,course.routeSegments,course.places,attempt) {
        val context=LocalContext.current
        val owner=LocalLifecycleOwner.current
        val mapView=remember { MapView(context).apply { setFinishManually(true) } }
        val stops=remember(course.id,course.accessTrip) { course.mapStops()+listOfNotNull(course.accessTrip?.origin?.let{MapStop("access-origin",it.name,it.coordinate(),null,-1)}) }
        var kakaoMap by remember { mutableStateOf<KakaoMap?>(null) }
        var error by remember { mutableStateOf<String?>(null) }
        val select by rememberUpdatedState(onSelect)
        val pointSelected by rememberUpdatedState(onMapPoint)
        LaunchedEffect(selected?.id) {
            selected?.let{kakaoMap?.moveCamera(CameraUpdateFactory.newCenterPosition(LatLng.from(it.coordinate.latitude,it.coordinate.longitude)))}
        }
        LaunchedEffect(Unit) { delay(20000); if(kakaoMap==null && error==null) error="지도 연결이 지연됩니다. 네트워크와 카카오 설정을 확인해 주세요." }
        DisposableEffect(mapView,owner) {
            var active=true
            val handler=Handler(Looper.getMainLooper())
            val observer=LifecycleEventObserver { _,event ->
                when(event) {
                    Lifecycle.Event.ON_RESUME->mapView.resume()
                    Lifecycle.Event.ON_PAUSE->mapView.pause()
                    else->Unit
                }
            }
            owner.lifecycle.addObserver(observer)
            mapView.start(object: MapLifeCycleCallback() {
                override fun onMapDestroy() = Unit
                override fun onMapError(exception: Exception) {
                    val code=(exception as? MapAuthException)?.errorCode
                    if(BuildConfig.DEBUG) runCatching {
                        var detail=exception.message.orEmpty()
                        listOf(BuildConfig.KAKAO_NATIVE_APP_KEY,BuildConfig.DEV_ACCESS_KEY).filter{it.isNotBlank()}.forEach { detail=detail.replace(it,"[REDACTED]") }
                        detail=detail.replace(Regex("[0-9a-fA-F]{32}"),"[REDACTED]")
                        val folder=java.io.File(context.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
                        java.io.File(folder,"map-error.txt").writeText("type=${exception.javaClass.simpleName}\ncode=$code\nmessage=${detail.take(2000)}")
                    }
                    handler.post { if(active) error="카카오 지도를 열지 못했습니다${code?.let{" (코드 $it)"}.orEmpty()}. 네이티브 앱 키·패키지명·키 해시와 네트워크를 확인해 주세요." }
                }
            },object: KakaoMapReadyCallback() {
                override fun getPosition()=LatLng.from(stops.first().coordinate.latitude,stops.first().coordinate.longitude)
                override fun getZoomLevel()=14
                override fun onMapReady(map: KakaoMap) {
                    handler.post {
                        if(!active) return@post
                        kakaoMap=map; error=null
                        stops.forEach { stop ->
                            val labelStyle=LabelStyle.from(markerBitmap(stop.index))
                                .setTextStyles(13,android.graphics.Color.BLACK,3,android.graphics.Color.WHITE)
                            map.labelManager?.layer?.addLabel(LabelOptions.from(stop.id,LatLng.from(stop.coordinate.latitude,stop.coordinate.longitude))
                                .setStyles(labelStyle).setTexts(LabelTextBuilder().setTexts(stop.name)).setClickable(true).setTag(stop.id))
                        }
                        // Draw each provider step separately so missing pieces are not joined as verified roads.
                        (course.routeSegments+listOfNotNull(course.accessTrip?.segment)).forEach { segment ->
                            val parts=if(segment.source=="kakao"&&segment.steps.any{it.geometry.size>1})segment.steps.filter{it.geometry.size>1}.map{it.geometry to if(it.mode=="walk")android.graphics.Color.rgb(100,116,139)else android.graphics.Color.rgb(21,128,61)} else listOf(segment.geometry to if(segment.source=="kakao")android.graphics.Color.rgb(21,128,61)else android.graphics.Color.rgb(148,163,184))
                            parts.forEach{(geometry,color)->val points=geometry.filter(Coordinate::valid).map{LatLng.from(it.latitude,it.longitude)}
                                if(points.size>=2)map.routeLineManager?.layer?.addRouteLine(RouteLineOptions.from(RouteLineSegment.from(points,RouteLineStyle.from(if(segment.source=="kakao")6f else 2f,color))))
                            }
                        }
                        map.setOnLabelClickListener { _,_,label -> stops.find{it.id==label.tag}?.let(select); true }
                        if(pointSelected!=null)map.setOnMapClickListener { _,position,_,poi->pointSelected?.invoke(Coordinate(position.latitude,position.longitude),poi?.takeIf{it.isPoi}?.name) }
                        if(cameraMemory?.position!=null)map.moveCamera(CameraUpdateFactory.newCameraPosition(cameraMemory.position!!))
                        else if(stops.size==1) map.moveCamera(CameraUpdateFactory.newCenterPosition(LatLng.from(stops.first().coordinate.latitude,stops.first().coordinate.longitude)))
                        else {
                            val bounds=stops.map{it.coordinate}+(course.routeSegments+listOfNotNull(course.accessTrip?.segment)).flatMap{it.geometry}.filter(Coordinate::valid)
                            map.moveCamera(CameraUpdateFactory.fitMapPoints(bounds.map{LatLng.from(it.latitude,it.longitude)}.toTypedArray(),160))
                        }
                    }
                }
            })
            if(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapView.resume()
            onDispose { cameraMemory?.position=kakaoMap?.cameraPosition; active=false; owner.lifecycle.removeObserver(observer); mapView.pause(); mapView.finish() }
        }
        Box(modifier.testTag(when { error!=null->"map-state-error"; kakaoMap!=null->"map-state-ready"; else->"map-state-loading" })) {
            AndroidView(factory={android.widget.FrameLayout(context).apply{addView(mapView,android.widget.FrameLayout.LayoutParams(-1,-1))}.also{container->container.setOnTouchListener{v,event->v.parent?.requestDisallowInterceptTouchEvent(event.actionMasked!=android.view.MotionEvent.ACTION_UP&&event.actionMasked!=android.view.MotionEvent.ACTION_CANCEL);false}}},modifier=Modifier.fillMaxSize().testTag("native-kakao-map"))
            if(error!=null) Surface(color=Color.White.copy(alpha=.97f),modifier=Modifier.align(Alignment.Center).padding(24.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Text(error!!,fontSize=13.sp)
                    TextButton(onClick={attempt++}) { Text("지도 다시 연결") }
                }
            } else if(kakaoMap==null) CircularProgressIndicator(Modifier.align(Alignment.Center))
        }
    }
}
private fun markerBitmap(index:Int):Bitmap {
    val bitmap=Bitmap.createBitmap(80,88,Bitmap.Config.ARGB_8888)
    val canvas=Canvas(bitmap)
    val paint=Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color=android.graphics.Color.WHITE
    canvas.drawCircle(40f,38f,36f,paint)
    paint.color=if(index<0)android.graphics.Color.rgb(99,102,241)else if(index==0) android.graphics.Color.rgb(28,28,30) else android.graphics.Color.rgb(21,128,61)
    canvas.drawCircle(40f,38f,31f,paint)
    paint.color=android.graphics.Color.WHITE; paint.typeface=Typeface.DEFAULT_BOLD
    paint.textSize=if(index<=0) 22f else 30f; paint.textAlign=Paint.Align.CENTER
    canvas.drawText(if(index<0)"출발" else if(index==0) "출발" else index.toString(),40f,38f-(paint.ascent()+paint.descent())/2,paint)
    return bitmap
}
