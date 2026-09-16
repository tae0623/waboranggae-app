package kr.co.waboranggae.nativepilot.ui
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Official provider artwork. Never tint or replace the brand symbol with an emoji. */
@Composable fun SocialProviderButton(id:String,label:String,enabled:Boolean,onClick:()->Unit) {
    val kakao=id=="kakao"
    Surface(onClick=onClick,enabled=enabled,shape=RoundedCornerShape(6.dp),
        color=if(kakao)Color(0xFFFEE500)else Color.White,
        border=if(kakao)null else BorderStroke(1.dp,Color(0xFF747775)),
        modifier=Modifier.fillMaxWidth().heightIn(min=48.dp).testTag("social-$id")) {
        if(kakao) {
            Box(Modifier.fillMaxWidth().height(48.dp),contentAlignment=Alignment.Center){
                androidx.compose.foundation.Image(
                    androidx.compose.ui.res.painterResource(kr.co.waboranggae.nativepilot.R.drawable.kakao_login_official),
                    contentDescription="카카오 로그인",contentScale=androidx.compose.ui.layout.ContentScale.Fit,
                    modifier=Modifier.fillMaxWidth().height(48.dp).testTag("official-kakao-logo"))
            }
        } else {
            Box(Modifier.fillMaxWidth().heightIn(min=48.dp),contentAlignment=Alignment.Center) {
              // Match the 600x90 Kakao artwork displayed at 48dp height: symbol left, label centered.
              Box(Modifier.widthIn(max=320.dp).fillMaxWidth().heightIn(min=48.dp),contentAlignment=Alignment.Center) {
                androidx.compose.foundation.Image(
                    androidx.compose.ui.res.painterResource(kr.co.waboranggae.nativepilot.R.drawable.google_signin_logo),
                    contentDescription=null,modifier=Modifier.align(Alignment.CenterStart).padding(start=15.dp).size(20.dp).testTag("official-google-logo"))
                Text("Google 로그인",fontSize=14.sp,fontWeight=FontWeight.Medium,color=Color(0xFF1F1F1F),modifier=Modifier.padding(start=22.dp))
              }
            }
        }
    }
}
