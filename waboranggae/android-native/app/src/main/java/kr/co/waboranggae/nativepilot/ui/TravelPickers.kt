@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.time.*
import java.util.Locale

/** Seven flexible columns avoid Material DatePicker's minimum-width clipping on compact devices. */
@Composable fun TravelDateDialog(value:String,onConfirm:(String)->Unit,onDismiss:()->Unit) {
    var selected by remember{mutableStateOf(LocalDate.parse(value))}
    var month by remember{mutableStateOf(YearMonth.from(selected))}
    val maxHeight=(LocalConfiguration.current.screenHeightDp-48).coerceAtLeast(200).dp
    Dialog(onDismissRequest=onDismiss,properties=DialogProperties(usePlatformDefaultWidth=false)) {
        Surface(Modifier.padding(16.dp).widthIn(max=420.dp).fillMaxWidth().heightIn(max=maxHeight).testTag("travel-calendar"),
            shape=RoundedCornerShape(28.dp),color=Color.White) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically) {
                    IconButton({month=month.minusMonths(1)},Modifier.testTag("calendar-previous")){Text("‹",fontSize=26.sp)}
                    Text("${month.year}년 ${month.monthValue}월",Modifier.weight(1f),textAlign=androidx.compose.ui.text.style.TextAlign.Center)
                    IconButton({month=month.plusMonths(1)},Modifier.testTag("calendar-next")){Text("›",fontSize=26.sp)}
                }
                Row(Modifier.fillMaxWidth()) { listOf("일","월","화","수","목","금","토").forEach { day->
                    Box(Modifier.weight(1f).height(32.dp),contentAlignment=Alignment.Center){Text(day,fontSize=12.sp,color=WebMuted)}
                } }
                val offset=month.atDay(1).dayOfWeek.value%7
                val weeks=(offset+month.lengthOfMonth()+6)/7
                repeat(weeks){week->Row(Modifier.fillMaxWidth()){
                    repeat(7){column->
                        val day=week*7+column-offset+1
                        val date=if(day in 1..month.lengthOfMonth())month.atDay(day)else null
                        val active=date==selected
                        Box(Modifier.weight(1f).heightIn(min=42.dp).aspectRatio(1f)
                            .background(if(active)Ink else Color.Transparent,RoundedCornerShape(12.dp))
                            .then(if(date!=null)Modifier.clickable{selected=date}.testTag("calendar-day-$day")
                                .semantics{contentDescription=date.toString()}else Modifier),
                            contentAlignment=Alignment.Center) { if(date!=null) Text(day.toString(),fontSize=14.sp,color=if(active)Color.White else Ink) }
                    }
                }}
                Row(Modifier.fillMaxWidth().padding(top=12.dp),horizontalArrangement=Arrangement.End) {
                    TextButton(onDismiss){Text("취소")}
                    Button({onConfirm(selected.toString())},Modifier.testTag("calendar-confirm"),
                        colors=ButtonDefaults.buttonColors(containerColor=Ink)){Text("선택")}
                }
            }
        }
    }
}
fun formatKoreanClock(value:String):String {
    val time=LocalTime.parse(value)
    return (if(time.hour<12)"오전" else "오후")+" "+(if(time.hour%12==0)12 else time.hour%12)+":"+String.format(Locale.ROOT,"%02d",time.minute)
}
fun clockFrom12Hour(hour:Int,minute:Int,afternoon:Boolean):String {
    require(hour in 1..12 && minute in 0..59)
    return String.format(Locale.ROOT,"%02d:%02d",hour%12+if(afternoon)12 else 0,minute)
}
@Composable fun TravelTimeDialog(value:String,onConfirm:(String)->Unit,onDismiss:()->Unit) {
    val initial=LocalTime.parse(value)
    var hour by remember{mutableStateOf((if(initial.hour%12==0)12 else initial.hour%12).toString())}
    var minute by remember{mutableStateOf(String.format(Locale.ROOT,"%02d",initial.minute))}
    var afternoon by remember{mutableStateOf(initial.hour>=12)}
    val valid=hour.toIntOrNull() in 1..12 && minute.toIntOrNull() in 0..59
    val periodColors=FilterChipDefaults.filterChipColors(
        containerColor=Soft,labelColor=Ink,
        selectedContainerColor=Ink,
        selectedLabelColor=Color.White)
    AppDialog(onDismissRequest=onDismiss,title={Text("여행 시간")},text={
        Column(verticalArrangement=Arrangement.spacedBy(16.dp)){
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
                FilterChip(selected=!afternoon,onClick={afternoon=false},label={Text("오전")},colors=periodColors,shape=RoundedCornerShape(12.dp),modifier=Modifier.testTag("time-am"))
                FilterChip(selected=afternoon,onClick={afternoon=true},label={Text("오후")},colors=periodColors,shape=RoundedCornerShape(12.dp),modifier=Modifier.testTag("time-pm"))
            }
            Row(horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically){
                OutlinedTextField(hour,{hour=it.filter(Char::isDigit).take(2)},label={Text("시")},singleLine=true,
                    keyboardOptions=androidx.compose.foundation.text.KeyboardOptions(keyboardType=androidx.compose.ui.text.input.KeyboardType.Number),
                    modifier=Modifier.weight(1f).testTag("time-hour"))
                Text(":",fontSize=24.sp)
                OutlinedTextField(minute,{minute=it.filter(Char::isDigit).take(2)},label={Text("분")},singleLine=true,
                    keyboardOptions=androidx.compose.foundation.text.KeyboardOptions(keyboardType=androidx.compose.ui.text.input.KeyboardType.Number),
                    modifier=Modifier.weight(1f).testTag("time-minute"))
            }
        }
    },confirmButton={TextButton({onConfirm(clockFrom12Hour(hour.toInt(),minute.toInt(),afternoon))},enabled=valid,modifier=Modifier.testTag("time-confirm")){Text("선택")}},
        dismissButton={TextButton(onDismiss){Text("취소")}})
}
