package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kr.co.waboranggae.nativepilot.data.*
import com.kakao.vectormap.camera.CameraPosition

class MapCameraMemory { var position:CameraPosition?=null }
/** Preview scroll belongs to the page; gestures belong to the dedicated map dialog. */
@Composable fun ExpandableNativeMap(course:Course,modifier:Modifier=Modifier,onSelect:(MapStop)->Unit={},onPoint:((Coordinate,String?)->Unit)?=null){
 var expanded by remember(course.id){mutableStateOf(false)}
 var detail by remember(course.id){mutableStateOf<MapStop?>(null)}
 val camera=remember(course.id){MapCameraMemory()}
 Box(modifier){
   NativeCourseMap(course,null,{},Modifier.fillMaxSize())
   Box(Modifier.fillMaxSize().testTag("map-expand").clickable{expanded=true}){
     Surface(color=Color.White,shape=androidx.compose.foundation.shape.RoundedCornerShape(20.dp),modifier=Modifier.align(Alignment.TopEnd).padding(12.dp)){
       Text("⛶ 지도 확대",Modifier.padding(horizontal=12.dp,vertical=8.dp),color=Purple)
     }
   }
 }
 if(expanded)Dialog(onDismissRequest={expanded=false},properties=DialogProperties(usePlatformDefaultWidth=false)){
   Column(Modifier.fillMaxSize().background(Color.White).safeDrawingPadding().testTag("expanded-map")){
     Row(verticalAlignment=Alignment.CenterVertically){
       IconButton({expanded=false},Modifier.testTag("map-collapse")){Icon(PilotIcons.Back,"지도 확대 닫기")}
       Text(course.title,modifier=Modifier.weight(1f))
     }
     NativeCourseMap(course,null,{if(onPoint!=null){expanded=false;onSelect(it)}else detail=it},Modifier.fillMaxWidth().weight(1f),
       onMapPoint=onPoint?.let{callback->{point,name->expanded=false;callback(point,name)}},cameraMemory=camera)
   }
   detail?.let{stop->AppDialog(onDismissRequest={detail=null},title={Text(stop.name)},text={Text(stop.place?.address?:course.origin?.address.orEmpty())},confirmButton={TextButton({detail=null}){Text("닫기")}})}
 }
}
