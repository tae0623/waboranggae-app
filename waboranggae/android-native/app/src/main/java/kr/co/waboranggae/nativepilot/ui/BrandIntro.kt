package kr.co.waboranggae.nativepilot.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import kotlin.math.min

// Same keyframes as the web's intro-footstep, with alternating ver4 footprints.
fun introFootprintAlpha(elapsedMs:Float,delayMs:Int):Float {
    val p=((elapsedMs-delayMs)/BrandIntroSpec.stepDurationMs).coerceIn(0f,1f)
    return when { p<=.25f -> p/.25f; p<=.7f -> 1f-(p-.25f)/.45f*.25f; else -> .75f-(p-.7f)/.3f*.35f }
}

@Composable fun BrandIntro(onDone:()->Unit) {
    val context=LocalContext.current
    val loader=remember(context){ImageLoader.Builder(context).components{add(SvgDecoder.Factory())}.build()}
    DisposableEffect(loader){onDispose{loader.shutdown()}}
    val done by rememberUpdatedState(onDone)
    val progress=remember{Animatable(0f)}
    var artLoaded by remember{mutableStateOf(false)}
    // Animatable respects the system animation-duration scale, including disabled motion.
    LaunchedEffect(Unit){progress.animateTo(1f,tween(BrandIntroSpec.durationMs,easing=LinearEasing));done()}
    val fontScale=LocalDensity.current.fontScale
    BoxWithConstraints(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color.White,Color(0xFFF0FDF4),Color.White)))
        .safeDrawingPadding().padding(horizontal=20.dp,vertical=24.dp).testTag("brand-intro")) {
        val artHeight=minOf(maxWidth*(BrandIntroSpec.height/BrandIntroSpec.width),(maxHeight-(120*fontScale).dp).coerceAtLeast(80.dp))
        Column(Modifier.fillMaxSize(),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center) {
            Box(Modifier.fillMaxWidth().height(artHeight)) {
                AsyncImage("file:///android_asset/web_splash_map.svg","전남 지도",loader,
                    Modifier.fillMaxSize().then(if(artLoaded)Modifier.testTag("intro-art-loaded") else Modifier),contentScale=ContentScale.Fit,onSuccess={artLoaded=true})
                Canvas(Modifier.fillMaxSize().testTag("intro-footprints").semantics{
                    stateDescription="발자국 ${BrandIntroSpec.steps.count{progress.value*BrandIntroSpec.durationMs>it.delayMs}} / 6"
                }) {
                    val scale=min(size.width/BrandIntroSpec.width,size.height/BrandIntroSpec.height)
                    val dx=(size.width-BrandIntroSpec.width*scale)/2
                    val dy=(size.height-BrandIntroSpec.height*scale)/2
                    withTransform({translate(dx,dy);scale(scale,scale,Offset.Zero);translate(-BrandIntroSpec.x,-BrandIntroSpec.y)}) {
                        BrandIntroSpec.steps.forEach { step ->
                            val alpha=introFootprintAlpha(progress.value*BrandIntroSpec.durationMs,step.delayMs)
                            val color=Color(0xFF16A34A).copy(alpha=alpha)
                            val x=if(step.right)5f else -5f
                            withTransform({translate(step.x,step.y);rotate(step.rotation,Offset.Zero)}) {
                                drawOval(color,Offset(x-4f,1.8f),Size(8f,6.4f))
                                drawOval(color,Offset(x-5.2f,-6.8f),Size(10.4f,7.6f))
                                drawCircle(color,1.6f,Offset(x-2.5f,-7.5f));drawCircle(color,1.8f,Offset(x,-8.8f));drawCircle(color,1.6f,Offset(x+2.5f,-7.5f))
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(18.dp))
            Text("뚜버기",fontSize=46.sp,fontWeight=FontWeight.Black,color=Color(0xFF14532D),letterSpacing=(-1.6).sp)
            Spacer(Modifier.height(8.dp));Text("전남 뚜벅이 여행",fontSize=14.sp,color=Color(0xFF15803D))
        }
    }
}
