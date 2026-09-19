@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

import androidx.compose.material.icons.filled.Settings
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.BuildConfig

const val ACCOUNT_CONSENT_TEXT="[계정 이용 필수] 만 14세 이상임을 확인합니다. 계정 관리 목적으로 이메일·닉네임·비밀번호 해시(이메일 가입) 또는 공급자 식별자·닉네임(소셜 로그인), 동의 버전·시각을 탈퇴 시까지 수집·이용하는 데 동의합니다. Supabase 서버와 DB에서 저장·처리합니다. 생년월일은 수집하지 않습니다. 거부해도 게스트 이용과 기존 계정 삭제는 가능합니다. 코스 저장은 별도 선택입니다."
@Composable fun AccountConsentScreen(state:AccountState,account:AccountViewModel) {
    var consent by remember{mutableStateOf(false)};var legal by remember{mutableStateOf(false)};var delete by remember{mutableStateOf(false)}
    Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp).testTag("privacy-consent-page"),verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Text("처음 이용 전 확인해 주세요",fontSize=27.sp,fontWeight=FontWeight.Bold)
        Text("운영자: $OPERATOR_NAME\n문의: waboranggae.help@gmail.com\n안내 버전: $NOTICE_VERSION",fontSize=12.sp)
        Text(ACCOUNT_CONSENT_TEXT)
        Row(verticalAlignment=Alignment.CenterVertically){Checkbox(consent,{consent=it},enabled=!state.busy,modifier=Modifier.testTag("privacy-agree-checkbox"));Text("만 14세 이상이며 위 개인정보 수집·이용에 동의합니다.")}
        TextButton({legal=true}){Text("개인정보 수집·이용 상세 안내")}
        WebAction("동의하고 계속하기",{account.agreePrivacy(consent)},enabled=consent && !state.busy,modifier=Modifier.testTag("privacy-agree-submit"))
        TextButton(account::guest,enabled=!state.busy){Text("동의하지 않고 게스트로 이용")}
        if(state.user!=null){Text("게스트 전환은 기존 계정 삭제가 아닙니다. 기존 계정 삭제는 새 동의 없이 가능합니다.",fontSize=12.sp);TextButton({delete=true},enabled=!state.busy){Text("기존 계정 삭제")}}
        state.message?.let{Text(it,color=MaterialTheme.colorScheme.error)}
        if(state.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
    }
    if(legal)PrivacyInfo(includeAttributions=false){legal=false}
    if(delete)AppDialog(onDismissRequest={delete=false},title={Text("기존 계정을 삭제할까요?")},text={Text("계정과 저장한 여행 정보를 영구 삭제합니다. 복구할 수 없습니다.")},confirmButton={TextButton({delete=false;account.deleteAccount()}){Text("영구 삭제")}},dismissButton={TextButton({delete=false}){Text("취소")}})
}

@Composable fun PrivacyInfo(includeAttributions:Boolean=true,onDismiss:()->Unit) {
    val context=LocalContext.current
    AppDialog(onDismissRequest=onDismiss,title={Text(if(includeAttributions)"개인정보·출처 안내" else "개인정보 수집·이용 안내")},text={
        Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Text("개인정보 처리 안내 · $NOTICE_VERSION\n운영자: $OPERATOR_NAME\n문의: waboranggae.help@gmail.com")
            Text(ACCOUNT_CONSENT_TEXT)
            Text("선택 로그인 설정: 아이디 저장은 이메일만 이 기기에 암호화해 저장합니다. 자동 로그인은 선택한 경우에만 갱신 토큰을 암호화해 저장합니다. 비밀번호는 저장하지 않으며, 선택을 해제하면 해당 저장 정보를 지웁니다.")
            Text("선택 저장: 코스를 직접 저장할 때 출발 장소·좌표·일시·취향 등이 계정과 함께 저장됩니다. 각 항목 삭제 또는 탈퇴 시 삭제됩니다. 여행 이력 자동 저장은 하지 않습니다.")
            Text("직접 고른 장소·좌표·여행 조건은 서버와 관광·지도·날씨·교통 서비스에 전송됩니다. 가까운 순 검색용 현재 위치는 기기 안에서만 계산하며 서버·카카오에 보내거나 저장하지 않습니다. 위치 이용은 내 여행 → 앱 설정에서 해제할 수 있습니다.")
            Text("Supabase 서버와 DB에서 계정 및 저장 코스를 처리합니다. DB는 서울 리전이며 서버·로그의 모든 처리가 국내에만 한정되지는 않습니다. Cloudflare는 공개 안내 페이지와 자동 가입 방지 확인에서 접속 IP·기기 신호를 처리할 수 있습니다. 이 서버는 Ollama를 사용하지 않습니다. 공급자·국외 처리·보관 기준은 전체 개인정보처리방침에서 확인해 주세요.")
            Text("문의는 처리 완료 후 90일 이내 삭제합니다. 별도 운영 백업을 생성하는 경우 암호화하여 최대 7일 보관 후 삭제합니다. 계정 탈퇴는 내 여행에서 할 수 있으며 비밀번호나 인증번호를 문의 메일로 보내지 마세요.")
            if(includeAttributions) {
                Text("한국관광공사 TourAPI·포토코리아 / 공공데이터포털 / 기상청 / 카카오맵 / 버스 공공데이터. 사진별 권리자·공공누리 유형은 원 제공처의 조건을 따릅니다. 출처 표기만으로 모든 사진의 이용 허락이 완료되는 것은 아닙니다.")
                Text("글꼴: Pretendard (SIL OFL 1.1). 앱 아이콘: 기존 웹 지도 도형과 새로 그린 발자국 도형. 지도·발자국 및 홈·로그인 배경의 배포 권한은 운영팀이 확인했습니다. 기존 Noto Emoji 자산의 라이선스는 보관합니다.")
            }
            TextButton(onClick={context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://waboranggae-app.pages.dev/app/privacy")))}){Text("전체 개인정보처리방침")}
            if(includeAttributions)TextButton(onClick={context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(BuildConfig.API_BASE_URL+"/legal/attributions")))}){Text("데이터·오픈소스 출처 및 이용 조건")}
        }
    },confirmButton={TextButton(onDismiss){Text("닫기")}})
}
@Composable fun LoginScreen(travel:TravelUiState,model:TravelViewModel,state:AccountState,account:AccountViewModel,botDialog:@Composable (()->Unit,(String)->Unit)->Unit={dismiss,verified->SignupBotCheck(dismiss,verified)}) {
    val context=LocalContext.current
    // Authentication fields are not captured by screenshots/recents or state restoration.
    DisposableEffect(Unit){val window=(context as? Activity)?.window;window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE);onDispose{window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)}}
    var signup by remember{mutableStateOf(false)}
    var botToken by remember{mutableStateOf("")};var showBot by remember{mutableStateOf(false)}
    LaunchedEffect(signup){if(signup)account.refreshSignupProtection()}
    LaunchedEffect(botToken){if(botToken.isNotBlank()){kotlinx.coroutines.delay(240000);botToken=""}}
    var email by remember{mutableStateOf(state.savedEmail)};var password by remember{mutableStateOf("")};var name by remember{mutableStateOf("")}
    var consent by remember{mutableStateOf(false)};var legal by remember{mutableStateOf(false)}
    Box(Modifier.fillMaxSize().background(Color(0xFF14532D)).testTag("login-page")) {
        LoginScenery(Modifier.fillMaxSize()){}
        Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
            Spacer(Modifier.height(20.dp))
            Text("뚜버기",color=Color.White,fontSize=34.sp,fontWeight=FontWeight.Black)
            Text("전남 뚜벅이 여행",color=Color.White)
            Surface(shape=RoundedCornerShape(26.dp),color=Color.White.copy(alpha=.95f)){
                Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){WebChip("로그인",!signup){signup=false};WebChip("회원가입",signup){signup=true}}
                    if(signup)OutlinedTextField(name,{name=it.take(50)},label={Text("닉네임 (2~50자)")},singleLine=true,modifier=Modifier.fillMaxWidth().testTag("signup-name"),enabled=!state.busy)
                    OutlinedTextField(email,{email=it.take(254)},label={Text(if(signup)"이메일" else "이메일 또는 아이디")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email),singleLine=true,modifier=Modifier.fillMaxWidth().testTag("login-email"),enabled=!state.busy)
                    OutlinedTextField(password,{password=it.take(128)},label={Text("비밀번호")},visualTransformation=PasswordVisualTransformation(),keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Password),singleLine=true,modifier=Modifier.fillMaxWidth().testTag("login-password"),enabled=!state.busy)
                    if(!signup)FlowRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        Row(verticalAlignment=Alignment.CenterVertically){
                            Checkbox(state.rememberId,{account.changeLoginOptions(it,state.autoLogin)},enabled=!state.busy,modifier=Modifier.testTag("remember-id"))
                            Text("아이디 저장",fontSize=13.sp)
                        }
                        Row(verticalAlignment=Alignment.CenterVertically){
                            Checkbox(state.autoLogin,{account.changeLoginOptions(state.rememberId,it)},enabled=!state.busy,modifier=Modifier.testTag("auto-login"))
                            Text("자동 로그인",fontSize=13.sp)
                        }
                    }
                    if(signup)Text("8자 이상 · 소문자·숫자·특수문자 포함",fontSize=11.sp,color=Muted)
                    if(signup)Row(verticalAlignment=Alignment.CenterVertically){Checkbox(consent,{consent=it},enabled=!state.busy,modifier=Modifier.testTag("signup-consent"));Text("[필수] 만 14세 이상 확인 및 개인정보 수집·이용 동의",fontSize=12.sp)}
                    if(signup)TextButton({legal=true},modifier=Modifier.testTag("signup-privacy-details")){Text("개인정보 수집·이용 안내")}
                    if(signup&&state.signupBotRequired){
                        if(state.signupBotAvailable)OutlinedButton({showBot=true},enabled=!state.busy,modifier=Modifier.fillMaxWidth().testTag("signup-bot-check")){Text(if(botToken.isBlank())"자동 가입 방지 확인" else "확인 완료")}
                        else TextButton(account::refreshSignupProtection){Text("회원가입 연결 다시 확인")}
                    }
                    WebAction(if(signup)"회원가입" else "로그인",{account.login(email,password,name,signup,consent,botToken);password="";botToken=""},enabled=!state.busy && (!signup || (consent&&state.signupBotAvailable&&(!state.signupBotRequired||botToken.isNotBlank()))) && email.isNotBlank() && password.isNotBlank(),modifier=Modifier.testTag("login-submit"))
                    state.providersError?.let{Text(it,color=MaterialTheme.colorScheme.error,fontSize=12.sp)}
                    if(!state.busy && state.providersError!=null)TextButton(account::refreshProviders,enabled=!state.providersLoading){Text("로그인 연결 다시 확인")}
                    LaunchedEffect(state.authorizationUrl) {
                        state.authorizationUrl?.let{url->runCatching{context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)))}.onFailure{account.browserFailed()}}
                    }
                    state.authorizationUrl?.let{url->Button({runCatching{context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(url)))}.onFailure{account.browserFailed()}},modifier=Modifier.fillMaxWidth()){Text("인증 창 다시 열기 ↗")}}
                    if(state.busy){LinearProgressIndicator(Modifier.fillMaxWidth());TextButton(account::cancel){Text("취소")}}
                    state.message?.let{Text(it,color=MaterialTheme.colorScheme.error,fontSize=12.sp)}
                    TextButton({password="";account.guest()},modifier=Modifier.fillMaxWidth().testTag("guest-login")){Text("게스트로 이용하기")}
                }
            }
            Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    listOf("kakao" to "카카오로 계속하기","google" to "구글로 계속하기").forEach{(id,label)->
                        val provider=state.providers.find{it.text("id")==id}
                        val enabled=provider?.get("enabled")?.jsonPrimitive?.booleanOrNull==true
                        SocialProviderButton(id,label,!state.busy && enabled && !state.providersLoading && state.providersError==null){account.social(id)}
                        if(!enabled && !state.providersLoading && state.providersError==null)Text(provider?.text("reason")?.takeIf{it.isNotBlank()}?:"서버의 로그인 설정을 확인해 주세요.",fontSize=11.sp,color=Muted)
                    }
            }
        }
    }
    if(legal)PrivacyInfo(includeAttributions=false){legal=false}
    if(showBot)botDialog({showBot=false}){token->botToken=token;if(token.isNotBlank())showBot=false}
}
@Composable fun MyTravel(state:AccountState,account:AccountViewModel,model:TravelViewModel) {
    var settings by remember{mutableStateOf(false)}
    var legal by remember{mutableStateOf(false)}
    var delete by remember{mutableStateOf(false)}
    var appInfo by remember{mutableStateOf(false)}
    var name by remember(state.user?.text("displayName")){mutableStateOf(state.user?.text("displayName").orEmpty())}
    androidx.activity.compose.BackHandler(settings){settings=false}
    LaunchedEffect(state.user?.text("id")){account.load()}
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp).testTag("my-travel"),verticalArrangement=Arrangement.spacedBy(18.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically){
            if(settings)IconButton({settings=false}){Icon(PilotIcons.Back,"내 여행으로")}
            Text(if(settings)"앱 설정" else "내 여행",fontSize=28.sp,fontWeight=FontWeight.Black,modifier=Modifier.weight(1f))
            if(!settings)IconButton({settings=true},modifier=Modifier.testTag("app-settings")){Icon(androidx.compose.material.icons.Icons.Default.Settings,"앱 설정")}
        }
        if(settings){
            if(state.user!=null)Surface(shape=RoundedCornerShape(24.dp),color=Color.White){Column(Modifier.padding(18.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
                Text("프로필",fontWeight=FontWeight.Bold)
                OutlinedTextField(name,{name=it.take(50)},label={Text("닉네임")},singleLine=true,modifier=Modifier.fillMaxWidth())
                WebAction("닉네임 수정",{account.updateName(name)},enabled=!state.busy&&name.trim().length>=2)
            }}
            Surface(shape=RoundedCornerShape(24.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(18.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                Text("위치 기반 서비스",fontWeight=FontWeight.Bold)
                Text("검색 결과가 비슷할 때 가까운 장소부터 보여드려요.",fontSize=13.sp,color=Muted)
                LocationPreferenceButton()
            }}
            Surface(shape=RoundedCornerShape(24.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(10.dp)){
                TextButton({appInfo=true}){Text("앱 정보")}
                TextButton({legal=true}){Text("개인정보·데이터·오픈소스 안내")}
            }}
        } else if(state.user==null){
            Surface(shape=RoundedCornerShape(24.dp),color=Color.White){Column(Modifier.padding(24.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
                Text("나만의 여행을 모아보세요",fontSize=20.sp,fontWeight=FontWeight.Bold)
                Text("로그인하면 코스를 저장할 수 있어요.",color=Muted)
                WebAction("로그인 / 회원가입",account::loginScreen)
            }}
        } else {
            Surface(shape=RoundedCornerShape(24.dp),color=Ink){Column(Modifier.fillMaxWidth().padding(22.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                Text(state.user.text("displayName").ifBlank{"여행자"},fontSize=22.sp,fontWeight=FontWeight.Bold,color=Color.White)
                val email=state.user.text("email")
                Text(state.user.text("loginAlias").ifBlank{if(email.endsWith("@social.waboranggae.invalid"))"소셜 로그인 계정" else email},fontSize=13.sp,color=Color.White.copy(alpha=.8f))
            }}
            Text("저장한 코스",fontSize=20.sp,fontWeight=FontWeight.Bold)
            if(state.bookmarks.isEmpty())Text("아직 저장한 코스가 없어요.",color=Muted)
            state.bookmarks.forEach{item->
                Surface(shape=RoundedCornerShape(20.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
                    Text(item.text("courseName"),fontWeight=FontWeight.Bold)
                    Text(item.text("city"),fontSize=12.sp,color=Muted)
                    Row{TextButton({val snapshot=item["snapshot"] as? JsonObject;if(snapshot!=null)model.openSaved(snapshot)},enabled=item["snapshot"] is JsonObject){Text("코스 열기")};TextButton({account.removeBookmark(item.text("courseId"))},enabled=!state.busy){Text("저장 취소")}}
                }}
            }
            HorizontalDivider(color=Color(0xFFE2E5E9))
            OutlinedButton(account::logout,enabled=!state.busy,modifier=Modifier.fillMaxWidth().testTag("logout-current")){Text("로그아웃")}
            TextButton({delete=true},enabled=!state.busy){Text("계정 탈퇴",color=MaterialTheme.colorScheme.error)}
        }
        if(state.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
        state.message?.let{Text(it,color=MaterialTheme.colorScheme.error,fontSize=12.sp)}
    }
    if(legal)PrivacyInfo{legal=false}
    if(appInfo)AppDialog(onDismissRequest={appInfo=false},title={Text("뚜버기")},text={
        Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
            Text("앱 버전 v${BuildConfig.VERSION_NAME}",modifier=Modifier.testTag("app-version"),fontWeight=FontWeight.SemiBold)
            Text("대중교통과 도보로 떠나는 전남 여행\n\n$OPERATOR_NAME\nwaboranggae.help@gmail.com")
        }
    },confirmButton={TextButton({appInfo=false}){Text("닫기")}})
    if(delete)AppDialog(onDismissRequest={delete=false},title={Text("계정을 탈퇴할까요?")},text={Text("계정과 저장한 코스가 영구 삭제되며 복구할 수 없습니다. 카카오·구글 계정 자체는 삭제하지 않습니다.")},confirmButton={TextButton({delete=false;account.deleteAccount()}){Text("탈퇴하기")}},dismissButton={TextButton({delete=false}){Text("취소")}})
}
