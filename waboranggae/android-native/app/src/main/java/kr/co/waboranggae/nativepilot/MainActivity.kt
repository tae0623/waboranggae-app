package kr.co.waboranggae.nativepilot

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import kr.co.waboranggae.nativepilot.data.HttpTravelRepository
import kr.co.waboranggae.nativepilot.data.SecureSession
import kr.co.waboranggae.nativepilot.ui.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        // The pilot always uses a light theme, even when the phone is in dark mode.
        enableEdgeToEdge(statusBarStyle=SystemBarStyle.light(android.graphics.Color.TRANSPARENT,android.graphics.Color.TRANSPARENT))
        setContent {
            WaboranggaeTheme {
                if (!BuildConfig.API_BASE_URL.startsWith("https://")) {
                    SetupError("API 주소가 없습니다. android-native/local.properties를 확인한 후 다시 빌드해 주세요.")
                } else {
                    val model: TravelViewModel = viewModel(factory = object : ViewModelProvider.Factory {
                        @Suppress("UNCHECKED_CAST")
                        override fun <T: ViewModel> create(modelClass: Class<T>): T =
                            TravelViewModel(HttpTravelRepository(BuildConfig.API_BASE_URL,BuildConfig.DEV_ACCESS_KEY,sessionStore=SecureSession(applicationContext),loginOptionsStore=kr.co.waboranggae.nativepilot.data.SecureLoginOptions(applicationContext))) as T
                    })
                    val account:AccountViewModel=viewModel(factory=object:ViewModelProvider.Factory{
                        @Suppress("UNCHECKED_CAST") override fun <T:ViewModel> create(modelClass:Class<T>):T=AccountViewModel(model.repository) as T
                    })
                    DeviceLocationConsentProvider { TravelApp(model,account) }
                }
            }
        }
    }
}
