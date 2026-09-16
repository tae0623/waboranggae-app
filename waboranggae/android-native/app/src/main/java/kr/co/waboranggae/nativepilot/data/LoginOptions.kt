package kr.co.waboranggae.nativepilot.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable data class LoginOptions(val rememberId:Boolean=false,val autoLogin:Boolean=false,val email:String="")
interface LoginOptionsStore {
    fun read():LoginOptions
    fun write(value:LoginOptions)
}
/** Optional email and switches, encrypted in noBackupFilesDir. No password is stored. */
class SecureLoginOptions(context:Context):LoginOptionsStore {
    private val store=SecureSession(context,"login-options.bin","waboranggae-login-options-v1")
    override fun read()=runCatching{store.read()?.let{Json.decodeFromString<LoginOptions>(it)}}.getOrNull()?:LoginOptions()
    override fun write(value:LoginOptions){store.write(Json.encodeToString(value.copy(email=if(value.rememberId)value.email.take(254)else "")))}
}

