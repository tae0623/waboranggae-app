@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.co.waboranggae.nativepilot.data.City
import kr.co.waboranggae.nativepilot.data.sortedTravelCities

@Composable internal fun DestinationPicker(cities:List<City>,selectedCity:String,onSelect:(String)->Unit,onDismiss:()->Unit) {
    val columns=if(LocalDensity.current.fontScale>=1.3f || LocalConfiguration.current.screenWidthDp<340)2 else 3
    ModalBottomSheet(onDismissRequest=onDismiss,sheetState=rememberModalBottomSheetState(skipPartiallyExpanded=true),
        shape=RoundedCornerShape(topStart=30.dp,topEnd=30.dp),containerColor=WebSoft,
        dragHandle={Box(Modifier.padding(top=12.dp,bottom=10.dp).size(36.dp,4.dp).background(Color(0xFFB6CBBE),RoundedCornerShape(8.dp)))}) {
        Column(Modifier.fillMaxWidth().heightIn(max=(LocalConfiguration.current.screenHeightDp*.8f).dp).testTag("destination-picker")) {
            Row(Modifier.fillMaxWidth().padding(start=24.dp,end=12.dp,bottom=20.dp),verticalAlignment=Alignment.CenterVertically) {
                Surface(shape=RoundedCornerShape(14.dp),color=Color(0xFFE1F1E7)) {
                    Box(Modifier.size(46.dp),contentAlignment=Alignment.Center){Icon(PilotIcons.Map,null,Modifier.size(24.dp),tint=Purple)}
                }
                Column(Modifier.weight(1f).padding(start=12.dp)) {
                    Text("여행지 선택",fontSize=22.sp,fontWeight=FontWeight.ExtraBold,color=Ink)
                    Text("전남 ${cities.size}개 지역 · 가나다순",fontSize=12.sp,color=WebMuted)
                }
                IconButton(onDismiss,Modifier.testTag("destination-close")){Icon(PilotIcons.Close,"닫기",tint=Muted)}
            }
            LazyVerticalGrid(columns=GridCells.Fixed(columns),modifier=Modifier.weight(1f,fill=false).testTag("destination-grid"),
                contentPadding=PaddingValues(start=24.dp,end=24.dp,bottom=24.dp),
                horizontalArrangement=Arrangement.spacedBy(10.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                items(sortedTravelCities(cities),key={it.name}) { city->
                    val active=city.name==selectedCity
                    Surface(onClick={onSelect(city.name)},shape=RoundedCornerShape(16.dp),
                        color=if(active)Purple else Color.White,border=BorderStroke(1.dp,if(active)Purple else WebBorder),
                        modifier=Modifier.fillMaxWidth().heightIn(min=56.dp).testTag("destination-option").semantics{selected=active;role=Role.RadioButton}) {
                        Row(Modifier.padding(horizontal=10.dp,vertical=16.dp),horizontalArrangement=Arrangement.Center,verticalAlignment=Alignment.CenterVertically) {
                            Text(city.name,fontSize=15.sp,fontWeight=if(active)FontWeight.Bold else FontWeight.Medium,color=if(active)Color.White else Ink)
                            if(active)Icon(PilotIcons.Check,null,Modifier.padding(start=5.dp).size(15.dp),tint=Color.White)
                        }
                    }
                }
            }
        }
    }
}
