package kr.co.waboranggae.nativepilot.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.CancellationSignal
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.*
import kotlin.coroutines.resume
import java.util.Locale
import kr.co.waboranggae.nativepilot.data.PlaceSuggestion

private fun locationDebug(message:String){if(kr.co.waboranggae.nativepilot.BuildConfig.DEBUG)android.util.Log.d("WBR_LOCATION",message)}
/** No network client, storage, analytics, map SDK or ViewModel receives this location. */
private suspend fun readDeviceLocation(context:Context):DeviceOnlyLocation? = withinDeviceLocationBudget {
    if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return@withinDeviceLocationBudget null
    val manager=context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return@withinDeviceLocationBudget null
    if(!LocationManagerCompat.isLocationEnabled(manager))return@withinDeviceLocationBudget null
    // Android's fused provider is often available when the network-only provider has no fix.
    // The OS still applies the user's approximate-location permission; no precise permission is requested.
    val providers=buildList {
        if(android.os.Build.VERSION.SDK_INT>=31)add(LocationManager.FUSED_PROVIDER)
        add(LocationManager.NETWORK_PROVIDER)
    }.filter{runCatching{manager.isProviderEnabled(it)}.getOrDefault(false)}
    locationDebug("enabledProviders="+providers.joinToString(","))
    if(providers.isEmpty())return@withinDeviceLocationBudget null
    // Read only a <=2-minute OS cache with the user's approximate permission.
    // Stale/missing fixes fall through to a new request; no app cache or disk write is made.
    val now=android.os.SystemClock.elapsedRealtimeNanos()
    val recent=providers.mapNotNull{provider->runCatching{manager.getLastKnownLocation(provider)}.getOrNull()}
        .filter{isRecentDeviceFix(it.elapsedRealtimeNanos,now)}
        .maxByOrNull{it.elapsedRealtimeNanos}
    recent?.let{fix->DeviceOnlyLocation.create(fix.latitude,fix.longitude)?.let{
        locationDebug("recentDeviceFix=true")
        return@withinDeviceLocationBudget it
    }}
    suspendCancellableCoroutine { continuation ->
        val cancellations=providers.map{CancellationSignal()}
        var pending=providers.size
        continuation.invokeOnCancellation { cancellations.forEach{it.cancel()} }
        providers.forEachIndexed { index,provider ->
            fun complete(result:DeviceOnlyLocation?){
                locationDebug("callback="+provider+" available="+(result!=null))
                pending--
                if(continuation.isActive && (result!=null || pending==0)){
                    continuation.resume(result);cancellations.forEach{it.cancel()}
                }
            }
            try {
                LocationManagerCompat.getCurrentLocation(manager,provider,cancellations[index],ContextCompat.getMainExecutor(context)) { fix ->
                    complete(fix?.let{DeviceOnlyLocation.create(it.latitude,it.longitude)})
                }
            }catch(_:SecurityException){complete(null)}
             catch(_:IllegalArgumentException){complete(null)}
        }
    }
}

@Composable fun NearbyDepartureCandidates(places:List<PlaceSuggestion>,query:String="",enabled:Boolean=true,onPick:(PlaceSuggestion)->Unit) {
    val context=LocalContext.current;val lifecycle=LocalLifecycleOwner.current.lifecycle
    val settings=LocalDeviceLocationConsent.current
    val scope=rememberCoroutineScope()
    // Not rememberSaveable: actual coordinates never enter preferences, saved state or a ViewModel.
    var location by remember { mutableStateOf<DeviceOnlyLocation?>(null) }
    var locating by remember { mutableStateOf(false) }
    var retry by remember { mutableStateOf(0) }
    var attempted by remember { mutableStateOf(false) }
    var active by remember { mutableStateOf(true) }
    var job by remember { mutableStateOf<Job?>(null) }
    val permitted=enabled && settings?.choice==LocationChoice.ALLOWED &&
        ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
    DisposableEffect(lifecycle) {
        val observer=LifecycleEventObserver{_,event->
            if(event==Lifecycle.Event.ON_STOP){active=false;job?.cancel();location=null;locating=false;attempted=false}
            if(event==Lifecycle.Event.ON_START)active=true
        }
        lifecycle.addObserver(observer)
        onDispose{lifecycle.removeObserver(observer);job?.cancel();location=null}
    }
    LaunchedEffect(permitted,active,retry) {
        locationDebug("searchEffect permitted=$permitted active=$active attempted=$attempted hasCandidates="+places.isNotEmpty()+" choice="+settings?.choice)
        if(!permitted || !active){job?.cancel();location=null;locating=false;attempted=false;return@LaunchedEffect}
        if(active && !attempted){
            attempted=true;locating=true
            job=scope.launch{
                try{
                    location=readDeviceLocation(context)
                }
                catch(e:Exception){if(e is CancellationException)throw e;location=null}
                finally{locating=false;locationDebug("searchFinished available="+(location!=null))}
            }
        }
    }
    if(places.isEmpty())return
    Surface(shape=RoundedCornerShape(18.dp),color=Color.White,border=BorderStroke(1.dp,WebBorder),
        shadowElevation=4.dp,modifier=Modifier.fillMaxWidth().padding(top=6.dp).testTag("departure-dropdown")) {
        Column {
            Text(if(locating)"위치 확인 중 · 정확도순" else if(location!=null)"정확도 우선 · 비슷한 결과는 가까운 순" else if(permitted && attempted)"위치 확인 불가 · 정확도순" else "정확도순",
                fontSize=11.sp,color=Muted,modifier=Modifier.padding(horizontal=16.dp,vertical=10.dp).testTag("departure-sort-label"))
            if(permitted && attempted && !locating && location==null)TextButton({attempted=false;retry++},modifier=Modifier.testTag("retry-device-location")){Text("위치 다시 확인",fontSize=12.sp)}
            sortOnDevice(places,location,query).take(7).forEachIndexed { index,nearby ->
                if(index>0)HorizontalDivider(color=WebBorder.copy(alpha=.6f),modifier=Modifier.padding(horizontal=16.dp))
                val p=nearby.place
                Surface(onClick={onPick(p)},color=Color.White,modifier=Modifier.fillMaxWidth().testTag("departure-result")) {
                    Row(Modifier.padding(horizontal=16.dp,vertical=13.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                        Icon(PilotIcons.Map,null,Modifier.size(18.dp),tint=Muted)
                        Column(Modifier.weight(1f)) {
                            Text(p.name,fontSize=14.sp,fontWeight=FontWeight.SemiBold)
                            Text(p.address,fontSize=12.sp,color=Muted)
                        }
                        nearby.distanceMeters?.let{meters->
                            Text(if(meters<1000)"약 ${((meters+50)/100)*100}m" else String.format(Locale.ROOT,"약 %.1fkm",meters/1000.0),fontSize=11.sp,color=Muted)
                        }
                    }
                }
            }
        }
    }
}
