@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package kr.co.waboranggae.nativepilot.ui
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.co.waboranggae.nativepilot.data.*

@Composable fun CourseEditor(state:TravelUiState,model:TravelViewModel){
 val course=state.selectedCourse?:return
 var ids by remember(course.id){mutableStateOf(course.places.map{it.id})}
 var addOpen by remember{mutableStateOf(false)}
 var dragging by remember{mutableStateOf<String?>(null)}
 var distance by remember{mutableFloatStateOf(0f)}
 val date=state.tripDays.find{it.courseId==course.id}?.date
 val pool=(state.candidatePools[date].orEmpty()+course.places+state.courses.filter{state.tripDays.size<=1}.flatMap{it.places}).distinctBy{it.id}.associateBy{it.id}
 val excluded=state.tripDays.filter{it.courseId!=course.id}.flatMap{day->state.courses.find{it.id==day.courseId}?.places.orEmpty()}.map{it.id}.toSet()
 val currentIds by rememberUpdatedState(ids)
 val threshold=with(LocalDensity.current){76.dp.toPx()}
 fun move(id:String,delta:Int):Boolean{
  val index=ids.indexOf(id);val target=index+delta
  if(index<0||target !in ids.indices||state.detailBusy)return false
  ids=ids.toMutableList().apply{add(target,removeAt(index))};return true
 }
 val additions=nearbyAdditions(ids.mapNotNull{pool[it]},pool.values.toList(),course.origin?.coordinate(),excluded)
 Column(Modifier.fillMaxSize().background(Soft).testTag("course-editor")){
  Row(Modifier.fillMaxWidth().background(Color.White).padding(16.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){
   IconButton(model::back,enabled=!state.detailBusy){Text("×",fontSize=28.sp)}
   Column(Modifier.weight(1f)){Text("코스 편집",fontSize=19.sp,fontWeight=FontWeight.Bold);Text("☰ 드래그로 순서 변경 · × 로 삭제",fontSize=11.sp,color=Muted)}
   Button({model.edit(ids)},enabled=!state.detailBusy&&ids.isNotEmpty(),colors=ButtonDefaults.buttonColors(containerColor=Ink),modifier=Modifier.testTag("apply-course-edit")){Text("저장")}
  }
  Column(Modifier.fillMaxWidth().background(Ink).padding(20.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
   Text("방문 순서 · ${ids.size}곳",color=Color.White.copy(alpha=.7f),fontSize=12.sp)
   Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){ids.forEachIndexed{i,_->
    if(i>0)Text(" ─ ",color=Color.Gray,modifier=Modifier.weight(1f))
    Surface(shape=RoundedCornerShape(30.dp),color=if(i==0)Color.White else Color(0xFF64706A)){Box(Modifier.size(25.dp),contentAlignment=Alignment.Center){Text("${i+1}",color=if(i==0)Ink else Color.White,fontSize=12.sp)}}
   }}
  }
  if(state.detailBusy)LinearProgressIndicator(Modifier.fillMaxWidth())
  state.detailError?.let{Text(it,Modifier.padding(16.dp),color=MaterialTheme.colorScheme.error)}
  LazyColumn(Modifier.weight(1f),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
   itemsIndexed(ids,key={_,id->id}){index,id->val place=pool[id]?:return@itemsIndexed
    Surface(shape=RoundedCornerShape(22.dp),color=Color.White,shadowElevation=if(dragging==id)6.dp else 1.dp,modifier=Modifier.fillMaxWidth()){
     Row(Modifier.padding(12.dp).heightIn(min=58.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)){
      Text("☰",fontSize=22.sp,color=Muted,modifier=Modifier.size(40.dp).wrapContentSize().testTag("drag-place-${id}").semantics{
       contentDescription="${place.name} 순서 변경";customActions=listOf(CustomAccessibilityAction("위로 이동"){move(id,-1)},CustomAccessibilityAction("아래로 이동"){move(id,1)})
      }.pointerInput(id,state.detailBusy){if(!state.detailBusy)detectDragGestures(onDragStart={dragging=id;distance=0f},onDragCancel={dragging=null;distance=0f},onDragEnd={dragging=null;distance=0f}){change,amount->
       change.consume();distance+=amount.y
       if(kotlin.math.abs(distance)>=threshold){val delta=if(distance>0)1 else -1;val at=currentIds.indexOf(id);if(at+delta in currentIds.indices)ids=currentIds.toMutableList().apply{add(at+delta,removeAt(at))};distance=0f}
      }})
      Surface(color=Color(0xFFECF7F0),shape=RoundedCornerShape(12.dp)){Box(Modifier.size(38.dp),contentAlignment=Alignment.Center){Text("${index+1}",fontWeight=FontWeight.Bold,color=Purple)}}
      Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(5.dp)){Text(place.name,fontWeight=FontWeight.Bold,fontSize=14.sp);Text("${place.stayMinutes}분 체류",fontSize=11.sp,color=Muted)}
      FilledTonalIconButton({ids=ids.filter{it!=id}},enabled=ids.size>1&&!state.detailBusy,colors=IconButtonDefaults.filledTonalIconButtonColors(containerColor=Color(0xFFFFE4E4),contentColor=Color(0xFFC62828)),modifier=Modifier.testTag("remove-course-place")){Text("×",fontSize=24.sp,modifier=Modifier.semantics{contentDescription="${place.name} 삭제"})}
     }
    }
   }
   item{OutlinedButton({addOpen=true},enabled=!state.detailBusy&&ids.size<8,modifier=Modifier.fillMaxWidth().height(58.dp),shape=RoundedCornerShape(18.dp)){Text("+  장소 추가")}}
   item{Text("최대 8곳 · 저장할 때 이동 시간을 확인해요.",fontSize=11.sp,color=Muted)}
  }
 }
 if(addOpen)ModalBottomSheet(onDismissRequest={addOpen=false},containerColor=Color.White){
  Column(Modifier.padding(horizontal=20.dp)){Text("장소 추가",fontSize=22.sp,fontWeight=FontWeight.Bold);Text("${course.city} · 현재 동선에 가까운 장소",fontSize=13.sp,color=Muted)}
  LazyColumn(contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(10.dp),modifier=Modifier.heightIn(max=450.dp)){
   if(additions.isEmpty())item{Text("추가할 수 있는 장소가 없어요.",color=Muted,modifier=Modifier.padding(vertical=32.dp))}
   itemsIndexed(additions){_,candidate->Surface(onClick={if(ids.size<8){ids=ids.toMutableList().apply{add(candidate.index,candidate.place.id)};addOpen=false}},shape=RoundedCornerShape(18.dp),color=Soft){
    Row(Modifier.fillMaxWidth().padding(16.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text(candidate.place.name,fontWeight=FontWeight.Bold);Text(if(candidate.index==0)"첫 방문 장소 앞에 추가" else "${pool[ids[candidate.index-1]]?.name} 다음",fontSize=12.sp,color=Muted)};Text("+",fontSize=25.sp)}
   }}
  }
 }
}
