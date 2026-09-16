package kr.co.waboranggae.nativepilot.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay

enum class LocationChoice { UNDECIDED, ALLOWED, DECLINED }

/** Stores only the user's choice. Coordinates never enter this preference store. */
@Stable class DeviceLocationConsent(context:Context,preferenceName:String="device_location_choice") {
    private val preferences=context.getSharedPreferences(preferenceName,Context.MODE_PRIVATE)
    var choice by mutableStateOf(runCatching{LocationChoice.valueOf(preferences.getString("choice",null)?:"UNDECIDED")}.getOrDefault(LocationChoice.UNDECIDED));private set
    var showNotice by mutableStateOf(false)
    fun choose(value:LocationChoice){choice=value;preferences.edit().putString("choice",value.name).apply();showNotice=false}
}
val LocalDeviceLocationConsent=staticCompositionLocalOf<DeviceLocationConsent?>{null}

@Composable fun DeviceLocationConsentProvider(content:@Composable ()->Unit) {
    val context=LocalContext.current
    val settings=remember{DeviceLocationConsent(context.applicationContext)}
    val permission=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){granted->
        settings.choose(if(granted)LocationChoice.ALLOWED else LocationChoice.DECLINED)
    }
    LaunchedEffect(Unit){if(settings.choice==LocationChoice.UNDECIDED){delay(2800);settings.showNotice=true}}
    CompositionLocalProvider(LocalDeviceLocationConsent provides settings){content()}
    if(settings.showNotice)AppDialog(onDismissRequest={settings.choose(LocationChoice.DECLINED)},
        modifier=Modifier.testTag("location-consent-dialog"),title={Text("가까운 출발지를 찾아드릴까요?")},
        text={Text("[선택] 검색 정확도를 우선하고, 비슷한 결과는 대략적인 현재 위치에서 가까운 순으로 정렬합니다. 위치는 휴대폰 안에서만 계산하고 저장하거나 서버·카카오로 보내지 않습니다. 화면을 나가면 삭제됩니다. 동의하지 않아도 정확도순으로 검색할 수 있습니다.")},
        confirmButton={TextButton({
            settings.showNotice=false
            if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED)settings.choose(LocationChoice.ALLOWED)
            else permission.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
        },modifier=Modifier.testTag("location-consent-allow")){Text("동의")}},
        dismissButton={TextButton({settings.choose(LocationChoice.DECLINED)},modifier=Modifier.testTag("location-consent-decline")){Text("동의 안 함")}})
}

@Composable fun LocationPreferenceButton() {
    val settings=LocalDeviceLocationConsent.current?:return
    TextButton({if(settings.choice==LocationChoice.ALLOWED)settings.choose(LocationChoice.DECLINED) else settings.showNotice=true}){
        Text(if(settings.choice==LocationChoice.ALLOWED)"가까운 순 검색 사용 해제" else "가까운 순 검색 설정")
    }
}
