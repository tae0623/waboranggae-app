package kr.co.waboranggae.nativepilot.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*

const val NOTICE_VERSION="2026-09-18-consent-v4"
const val OPERATOR_NAME="뚜버기 Team (administrator: Taeyoung Ko)"
fun needsPrivacyConsent(user:JsonObject)=user.text("consentVersion")!=NOTICE_VERSION || user.text("consentedAt").isBlank()
data class AccountState(
    val signupBotRequired:Boolean=true,val signupBotAvailable:Boolean=false,
    val checking:Boolean=true,val showLogin:Boolean=true,val busy:Boolean=false,
    val rememberId:Boolean=false,val autoLogin:Boolean=false,val savedEmail:String="",
    val user:JsonObject?=null,val message:String?=null,val notice:String?=null,
    val saveError:String?=null,val saveErrorStatus:Int=0,
    val providers:List<JsonObject> = emptyList(),val bookmarks:List<JsonObject> = emptyList(),
    val authorizationUrl:String?=null,
    val needsConsent:Boolean=false,val pendingSocial:JsonObject?=null,
    val providersLoading:Boolean=false,val providersError:String?=null
)
fun JsonObject.text(name:String)=this[name]?.let{if(it is JsonNull)null else it.jsonPrimitive.contentOrNull}.orEmpty()
class AccountViewModel(private val repository:TravelRepository,private val snapshotDispatcher:CoroutineDispatcher=Dispatchers.Default):ViewModel() {
    private val initialOptions=repository.loginOptions()
    private val mutable=MutableStateFlow(AccountState(rememberId=initialOptions.rememberId,autoLogin=initialOptions.autoLogin,savedEmail=initialOptions.email))
    val state=mutable.asStateFlow()
    private var action:Job?=null
    private var providersJob:Job?=null
    init {
        viewModelScope.launch {
            try {
                if(repository.restoreSession()) {
                    val user=repository.api("/api/user/me",auth=true).jsonObject
                    mutable.update{it.copy(user=user,showLogin=false,needsConsent=needsPrivacyConsent(user))}
                }
            } catch(e:Exception) { if(e is CancellationException)throw e }
            finally { mutable.update{it.copy(checking=false)} }
        }
        refreshProviders()
    }
    fun refreshSignupProtection(){viewModelScope.launch{
        try{val config=repository.api("/auth/signup-config").jsonObject
            mutable.update{it.copy(signupBotRequired=config["required"]?.jsonPrimitive?.booleanOrNull!=false,signupBotAvailable=config["available"]?.jsonPrimitive?.booleanOrNull==true)}
        }catch(e:CancellationException){throw e}catch(_:Exception){mutable.update{it.copy(signupBotAvailable=false)}}
    }}
    fun refreshProviders() {
        if(providersJob?.isActive==true)return
        mutable.update{it.copy(providersLoading=true,providersError=null)}
        providersJob=viewModelScope.launch {
            try {
                val providers=repository.api("/auth/social/providers").jsonObject["providers"]!!.jsonArray.map{it.jsonObject}
                mutable.update{it.copy(providers=providers)}
            } catch(e:Exception) {
                if(e is CancellationException)throw e
                mutable.update{it.copy(providersError="로그인 서비스에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.")}
            } finally { mutable.update{it.copy(providersLoading=false)} }
        }
    }
    fun loginScreen() { mutable.update{it.copy(showLogin=true,message=null,saveError=null,saveErrorStatus=0)};refreshProviders() }
    fun browserFailed() {
        action?.cancel()
        mutable.update{it.copy(busy=false,authorizationUrl=null,message="인증 브라우저를 열지 못했습니다. Chrome 등 브라우저를 사용할 수 있는지 확인한 뒤 다시 시도해 주세요.")}
    }
    private fun loggedOut(showLogin:Boolean=true,message:String?=null):AccountState {
        val old=mutable.value
        return AccountState(checking=false,showLogin=showLogin,providers=old.providers,message=message,
            rememberId=old.rememberId,autoLogin=old.autoLogin,savedEmail=old.savedEmail)
    }
    fun guest() { action?.cancel();viewModelScope.launch { repository.clearSession();mutable.update{loggedOut(false)} } }
    fun changeLoginOptions(rememberId:Boolean,autoLogin:Boolean)=task {
        val email=if(rememberId)mutable.value.savedEmail else ""
        repository.setLoginOptions(LoginOptions(rememberId,autoLogin,email))
        mutable.update{it.copy(rememberId=rememberId,autoLogin=autoLogin,savedEmail=email)}
    }
    fun cancel() { action?.cancel();mutable.update{it.copy(busy=false,authorizationUrl=null,message="로그인을 취소했습니다.")} }
    private fun task(saveOperation:Boolean=false,block:suspend ()->Unit) {
        if(mutable.value.busy)return
        mutable.update{it.copy(busy=true,message=null,saveError=if(saveOperation)null else it.saveError,saveErrorStatus=if(saveOperation)0 else it.saveErrorStatus)}
        action=viewModelScope.launch {
            try{block()}catch(e:Exception){
                if(e is CancellationException)throw e
                val status=(e as? ApiFailure)?.status?:0
                val message=when(status){401->if(saveOperation)"로그인 정보가 만료되었습니다. 다시 로그인해 주세요." else "로그인 정보가 올바르지 않거나 만료되었습니다. 다시 로그인해 주세요.";409->"이미 등록되었거나 동시에 변경된 정보입니다. 상태를 확인해 주세요.";else->e.message?:"요청에 실패했습니다."}
                mutable.update{if(saveOperation)it.copy(saveError=message,saveErrorStatus=status)else it.copy(message=message)}
            }
            finally{mutable.update{it.copy(busy=false,authorizationUrl=null)}}
        }
    }
    private suspend fun authenticated(value:JsonObject,email:String?=null) {
        val old=mutable.value
        val saved=if(old.rememberId)email?.trim()?:old.savedEmail else ""
        repository.setLoginOptions(LoginOptions(old.rememberId,old.autoLogin,saved))
        repository.acceptSession(value)
        mutable.update{it.copy(savedEmail=saved)}
        val user=value["user"]!!.jsonObject
        mutable.update{it.copy(user=user,showLogin=false,authorizationUrl=null,message=null,saveError=null,saveErrorStatus=0,bookmarks=emptyList(),needsConsent=needsPrivacyConsent(user),pendingSocial=null)}
        if(!needsPrivacyConsent(user))try{refreshLists()}catch(e:CancellationException){throw e}catch(_:Exception){/* Signing in succeeded; reload the list from My Travel. */}
    }
    fun login(email:String,password:String,name:String,signup:Boolean,consent:Boolean,botToken:String="") {
        if(signup && !consent){mutable.update{it.copy(message="개인정보 안내에 동의하거나 게스트로 이용해 주세요.")};return}
        if(signup&&mutable.value.signupBotRequired&&botToken.isBlank()){mutable.update{it.copy(message="자동 가입 방지 확인을 완료해 주세요.")};return}
        task {
            val body=buildJsonObject{put("email",email.trim());put("password",password);if(signup){put("displayName",name.trim());put("privacyConsent",true);put("ageConfirmed",true);put("consentVersion",NOTICE_VERSION);put("botToken",botToken)}}
            authenticated(repository.api(if(signup)"/auth/signup" else "/auth/login","POST",body).jsonObject,email)
        }
    }
    fun social(provider:String) {
        task {
            require(provider in listOf("google","kakao"))
            val flow=repository.api("/auth/social/$provider/start","POST",buildJsonObject{put("client","android")}).jsonObject
            val url=java.net.URI(flow.text("authorizationUrl"))
            require(url.scheme=="https" && url.host==if(provider=="google")"accounts.google.com" else "kauth.kakao.com") {"로그인 주소를 확인하지 못했습니다."}
            mutable.update{it.copy(authorizationUrl=url.toString(),message="인증 창에서 로그인을 진행해 주세요.")}
            repeat(100){
                delay(3000)
                val result=repository.api("/auth/social/result","POST",buildJsonObject{put("flowId",flow.text("flowId"));put("pollSecret",flow.text("pollSecret"))}).jsonObject
                if(result.text("status")=="consent_required"){mutable.update{it.copy(needsConsent=true,pendingSocial=flow,showLogin=false,message=null)};return@task}
                if(result.text("status")=="complete"){authenticated(result);return@task}
            }
            throw ApiFailure("로그인 시간이 만료되었습니다. 다시 시작해 주세요.")
        }
    }
    fun agreePrivacy(consent:Boolean) {
        if(!consent)return
        task {
            val pending=mutable.value.pendingSocial
            val body=buildJsonObject{put("privacyConsent",true);put("ageConfirmed",true);put("consentVersion",NOTICE_VERSION);if(pending!=null){put("flowId",pending.text("flowId"));put("pollSecret",pending.text("pollSecret"))}}
            if(pending!=null){
                repository.api("/auth/social/consent","POST",body)
                authenticated(repository.api("/auth/social/result","POST",buildJsonObject{put("flowId",pending.text("flowId"));put("pollSecret",pending.text("pollSecret"))}).jsonObject)
            } else {
                val user=repository.api("/auth/consent","POST",body,true).jsonObject
                mutable.update{it.copy(user=user,needsConsent=needsPrivacyConsent(user))}
                if(!needsPrivacyConsent(user))refreshLists()
            }
        }
    }
    private suspend fun refreshLists() {
        val bookmarks=repository.api("/api/user/bookmarks",auth=true).jsonArray.map{it.jsonObject}
        mutable.update{it.copy(bookmarks=bookmarks)}
    }
    fun load() { if(mutable.value.user!=null) task{refreshLists()} }
    fun updateName(name:String)=task{
        val user=repository.api("/api/user/profile","PATCH",buildJsonObject{put("displayName",name.trim())},true).jsonObject
        mutable.update{it.copy(user=user,notice="닉네임을 수정했어요.")}
    }
    fun clearMessage(){mutable.update{it.copy(message=null)}}
    fun clearSaveError(){mutable.update{it.copy(saveError=null,saveErrorStatus=0)}}
    fun dismissNotice(){mutable.update{it.copy(notice=null)}}
    fun logout()=task{
        repository.logoutCurrentSession()
        mutable.update{loggedOut(message="로그아웃했습니다.")}
    }
    fun localLogout()=task{
        repository.clearSession()
        mutable.update{loggedOut(message="이 기기의 로그인 정보만 지웠습니다. 서버 세션 철회는 되지 않았습니다.")}
    }
    fun deleteAccount()=task{
        repository.api("/api/user/me","DELETE",auth=true);repository.clearSession()
        repository.setLoginOptions(LoginOptions())
        mutable.update{AccountState(checking=false,showLogin=true,providers=it.providers,message="계정과 연결된 북마크·여행 이력을 삭제했습니다.")}
    }
    fun save(course:Course,onSaved:()->Unit={})=saveTrip(listOf(course),onSaved)
    fun saveTrip(courses:List<Course>,onSaved:()->Unit={})=task(saveOperation=true){
        if(courses.isEmpty())throw ApiFailure("저장할 코스가 없습니다. 다시 추천받아 주세요.")
        for(course in courses){
            val snapshot=repository.snapshot(course.id)?:throw ApiFailure("원본 코스 정보가 없습니다. 다시 추천받아 주세요.")
            val payload=withContext(snapshotDispatcher){bookmarkPayload(course,snapshot)}
            repository.api("/api/user/bookmarks/add","POST",payload,true)
        }
        // Navigation must not depend on a second network request after successful persistence.
        onSaved()
        mutable.update{it.copy(notice=if(courses.size>1)"${courses.size}일 코스를 저장했어요." else "코스를 저장했어요.")}
        try {refreshLists()} catch(e:CancellationException){throw e} catch(_:Exception){/* Reload on My Travel. */}
    }
    fun removeBookmark(id:String)=task{repository.api("/api/user/bookmarks/${java.net.URLEncoder.encode(id,"UTF-8")}","DELETE",auth=true);refreshLists()}

}
