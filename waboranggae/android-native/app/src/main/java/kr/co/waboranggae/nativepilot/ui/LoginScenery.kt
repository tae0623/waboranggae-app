package kr.co.waboranggae.nativepilot.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import coil.compose.AsyncImage

// Existing ver4 home photograph. Decorative landscape, not a Jeonnam destination photograph.
internal const val HOME_SCENERY_URL="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=700&fit=crop&auto=format"

@Composable internal fun LoginScenery(modifier:Modifier=Modifier,onPhotoReady:(Boolean)->Unit={}) {
    var loaded by remember{mutableStateOf(false)}
    LaunchedEffect(loaded){onPhotoReady(loaded)}
    Box(modifier.background(Color(0xFF174438)).testTag("login-background")) {
        AsyncImage(model=HOME_SCENERY_URL,contentDescription=null,contentScale=ContentScale.Crop,
            modifier=Modifier.fillMaxSize().then(if(loaded)Modifier.testTag("login-photo-loaded")else Modifier),
            onSuccess={loaded=true},onError={loaded=false})
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x550A2219),Color(0x660A2219),Color(0xDD0A2219)))))
    }
}
