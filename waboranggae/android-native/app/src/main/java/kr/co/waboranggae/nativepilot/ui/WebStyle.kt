@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.co.waboranggae.nativepilot.R

val WebMuted=Color(0xFFAEAEB2)
val WebBorder=Color(0xFFE4E4E9)
val WebSoft=Color(0xFFF9F9FB)
val WebFont=FontFamily((100..900 step 100).map { weight->
    Font(R.font.pretendard_variable,FontWeight(weight),variationSettings=FontVariation.Settings(FontVariation.weight(weight)))
})
fun webTypography():Typography {
    val t=Typography()
    return t.copy(displayLarge=t.displayLarge.copy(fontFamily=WebFont),displayMedium=t.displayMedium.copy(fontFamily=WebFont),displaySmall=t.displaySmall.copy(fontFamily=WebFont),
        headlineLarge=t.headlineLarge.copy(fontFamily=WebFont),headlineMedium=t.headlineMedium.copy(fontFamily=WebFont),headlineSmall=t.headlineSmall.copy(fontFamily=WebFont),
        titleLarge=t.titleLarge.copy(fontFamily=WebFont),titleMedium=t.titleMedium.copy(fontFamily=WebFont),titleSmall=t.titleSmall.copy(fontFamily=WebFont),
        bodyLarge=t.bodyLarge.copy(fontFamily=WebFont),bodyMedium=t.bodyMedium.copy(fontFamily=WebFont),bodySmall=t.bodySmall.copy(fontFamily=WebFont),
        labelLarge=t.labelLarge.copy(fontFamily=WebFont),labelMedium=t.labelMedium.copy(fontFamily=WebFont),labelSmall=t.labelSmall.copy(fontFamily=WebFont))
}
@Composable fun WebBottomBar(page:Page,onSelect:(Page)->Unit) {
    Column(Modifier.background(Color.White).navigationBarsPadding()) {
        HorizontalDivider(color=Color(0xFFF2F2F7))
        Row(Modifier.fillMaxWidth().height(74.dp).padding(bottom=10.dp)) {
            listOf(Triple(Page.HOME,"홈",PilotIcons.Home),Triple(Page.RESULTS,"코스",PilotIcons.List),Triple(Page.MAP,"동선",PilotIcons.Map),Triple(Page.MY_TRAVEL,"내 여행",PilotIcons.User)).forEach { (target,label,icon)->
                val selected=page==target || (target==Page.HOME && page==Page.HOT_PLACE)
                Column(Modifier.weight(1f).fillMaxHeight().clickable{onSelect(target)}.testTag("nav-${target.name}"),
                    horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center) {
                    Box(Modifier.size(44.dp,32.dp).background(if(selected)Ink else Color.Transparent,RoundedCornerShape(12.dp)),contentAlignment=Alignment.Center) {
                        Icon(icon,label,Modifier.size(20.dp),tint=if(selected)Color.White else WebMuted)
                    }
                    Spacer(Modifier.height(3.dp));Text(label,fontSize=10.sp,fontWeight=if(selected)FontWeight.Bold else FontWeight.Normal,color=if(selected)Ink else WebMuted)
                }
            }
        }
    }
}
@Composable fun BrandMark(modifier:Modifier=Modifier) {
    Box(modifier.background(Color(0xFFF0FDF4),RoundedCornerShape(12.dp)),contentAlignment=Alignment.Center) {
        androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(R.drawable.ic_brand),"전남 지도를 걷는 사람",Modifier.fillMaxSize())
    }
}
@Composable fun WebChip(label:String,on:Boolean=false,onClick:()->Unit={}) {
    Surface(onClick=onClick,shape=RoundedCornerShape(100.dp),color=if(on)Ink else Color.White,
        border=androidx.compose.foundation.BorderStroke(1.dp,if(on)Ink else WebBorder),modifier=Modifier.heightIn(min=42.dp)) {
        Text(label,Modifier.padding(horizontal=16.dp,vertical=10.dp),fontSize=13.sp,fontWeight=if(on)FontWeight.Bold else FontWeight.Normal,color=if(on)Color.White else Ink)
    }
}
@Composable fun WebAction(text:String,onClick:()->Unit,modifier:Modifier=Modifier,enabled:Boolean=true) {
    Button(onClick,enabled=enabled,shape=RoundedCornerShape(100.dp),colors=ButtonDefaults.buttonColors(containerColor=Ink),
        modifier=modifier.fillMaxWidth().heightIn(min=54.dp)) { Text(text,fontSize=15.sp,fontWeight=FontWeight.Bold) }
}
@Composable fun WebSectionLabel(text:String) { Text(text,fontSize=11.sp,fontWeight=FontWeight.Bold,color=WebMuted,modifier=Modifier.padding(top=8.dp,bottom=10.dp)) }
@Composable fun MyTravelPreview() {
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("내 여행",fontSize=28.sp,fontWeight=FontWeight.Black)
        Text("로그인하면 북마크와 이력을 저장합니다",color=WebMuted,fontSize=14.sp,modifier=Modifier.padding(top=4.dp,bottom=28.dp))
        Surface(color=Ink,shape=RoundedCornerShape(24.dp)) {
            Column(Modifier.fillMaxWidth().padding(28.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(12.dp)) {
                BrandMark(Modifier.size(48.dp));Text("로그인하고 더 많이 즐겨요",color=Color.White,fontSize=16.sp,fontWeight=FontWeight.Bold)
                Text("네이티브 시제품의 로그인·저장은 아직 연결 전입니다. 지금은 홈에서 실제 코스를 추천받을 수 있어요.",color=Color.White.copy(alpha=.65f),fontSize=13.sp,textAlign=TextAlign.Center,lineHeight=21.sp)
            }
        }
    }
}
