@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package kr.co.waboranggae.nativepilot.ui

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

const val ACCOUNT_CONSENT_TEXT="[계정 이용 필수] 계정 관리 목적으로 이메일·표시 이름·비밀번호 해시(이메일 가입) 또는 공급자 식별자·표시 이름(소셜 로그인), 동의 버전·시각을 탈퇴 시까지 수집·이용하는 데 동의합니다. 클라우드 검증에서는 Supabase의 서버와 DB에 저장·처리됩니다. 거부해도 게스트 이용과 기존 계정 삭제는 가능합니다. 여행 조건·코스 저장은 별도 선택입니다."
@Composable fun AccountConsentScreen(state:AccountState,account:AccountViewModel) {
    var consent by remember{mutableStateOf(false)};var legal by remember{mutableStateOf(false)};var delete by remember{mutableStateOf(false)}
    Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp).testTag("privacy-consent-page"),verticalArrangement=Arrangement.spacedBy(16.dp)) {
        Text("처음 이용 전 확인해 주세요",fontSize=27.sp,fontWeight=FontWeight.Bold)
        Text("운영자: $OPERATOR_NAME\n문의: waboranggae.help@gmail.com\n안내 버전: $NOTICE_VERSION",fontSize=12.sp)
        Text(ACCOUNT_CONSENT_TEXT)
        Row(verticalAlignment=Alignment.CenterVertically){Checkbox(consent,{consent=it},enabled=!state.busy,modifier=Modifier.testTag("privacy-agree-checkbox"));Text("위 개인정보 수집·이용에 동의합니다.")}
        TextButton({legal=true}){Text("개인정보 수집·이용 상세 안내")}
        WebAction("동의하고 계속하기",{account.agreePrivacy(consent)},enabled=consent && !state.busy,modifier=Modifier.testTag("privacy-agree-submit"))
        TextButton(account::guest,enabled=!state.busy){Text("동의하지 않고 게스트로 이용")}
        if(state.user!=null){Text("게스트 전환은 기존 계정 삭제가 아닙니다. 기존 계정 삭제는 새 동의 없이 가능합니다.",fontSize=12.sp);TextButton({delete=true},enabled=!state.busy){Text("기존 계정 삭제")}}
        state.message?.let{Text(it,color=MaterialTheme.colorScheme.error)}
        if(state.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
    }
    if(legal)PrivacyInfo{legal=false}
    if(delete)AppDialog(onDismissRequest={delete=false},title={Text("기존 계정을 삭제할까요?")},text={Text("계정과 저장한 여행 정보를 영구 삭제합니다. 복구할 수 없습니다.")},confirmButton={TextButton({delete=false;account.deleteAccount()}){Text("영구 삭제")}},dismissButton={TextButton({delete=false}){Text("취소")}})
}

@Composable fun PrivacyInfo(onDismiss:()->Unit) {
    val context=LocalContext.current
    AppDialog(onDismissRequest=onDismiss,title={Text("개인정보·출처 안내")},text={
        Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
            Text("개발 테스트 안내 · $NOTICE_VERSION\n운영자: $OPERATOR_NAME\n문의: waboranggae.help@gmail.com\n아직 스토어 출시용 최종 방침이 아닙니다.",color=MaterialTheme.colorScheme.error)
            Text("계정 관리: 이메일 가입은 이메일·표시 이름·비밀번호 해시, 소셜 로그인은 공급자 식별자·표시 이름 및 동의 버전을 탈퇴할 때까지 저장합니다. 비밀번호 원문은 저장하지 않습니다. 동의하지 않으면 계정 기능 없이 게스트로 여행을 찾을 수 있습니다.")
            Text("선택 로그인 설정: 아이디 저장은 이메일만 이 기기에 암호화해 저장합니다. 자동 로그인은 선택한 경우에만 갱신 토큰을 암호화해 저장합니다. 비밀번호는 저장하지 않으며, 선택을 해제하면 해당 저장 정보를 지웁니다.")
            Text("선택 저장: 코스·최근 여행을 직접 저장할 때 출발 장소·좌표·일시·취향 등이 계정과 함께 저장됩니다. 각 항목 삭제 또는 탈퇴 시 삭제됩니다. 여행 이력 자동 저장은 하지 않습니다.")
            Text("추천에 필요한 장소·좌표·여행 조건은 서버, 관광·지도·날씨·교통 서비스로 전송됩니다. 보조 AI는 서버의 Ollama를 이용합니다. 선택적 가까운 순 검색은 대략적인 단말기 위치를 기기 안에서만 사용합니다. 좌표는 서버·카카오에 전송하거나 저장하지 않으며 화면 종료 시 해제됩니다. 동의 여부만 이 기기에 저장하고 내 여행에서 변경할 수 있습니다. 지도·이미지·소셜 로그인 및 개발용 Cloudflare 중계 사업자는 접속 IP 등 통신 정보를 처리할 수 있습니다.")
            if(BuildConfig.API_BASE_URL.startsWith("https://drtxexwznmpmiclvrjji.supabase.co/"))Text("현재 클라우드 검증 앱은 PC·Cloudflare 중계를 거치지 않고 Supabase Edge Functions와 PostgreSQL DB를 사용합니다. 계정 정보·동의 기록·직접 저장한 여행 정보가 Supabase에 저장됩니다. DB 설정 리전은 ap-northeast-2이며, API 실행·접속 로그 등 모든 처리가 같은 국가에서만 이루어진다는 보장은 아닙니다. 이 서버에서는 Ollama를 사용하지 않습니다. 외부 사업자 로그·백업 보관 및 국외 처리 세부사항은 출시 전 확정 대상입니다.")
            Text("한국관광공사 TourAPI·포토코리아 / 공공데이터포털 / 기상청 / 카카오맵 / 버스 공공데이터. 사진별 권리자·공공누리 유형은 원 제공처의 조건을 따릅니다. 출처 표기만으로 모든 사진의 이용 허락이 완료되는 것은 아닙니다.")
            Text("글꼴: Pretendard (SIL OFL 1.1). 앱 아이콘: 기존 웹 지도 도형과 새로 그린 걷는 사람 실루엣. 지도·발자국 원화는 팀 원저작물 여부 확인이 필요합니다. 기존 Noto Emoji 자산의 라이선스는 보관합니다.")
            TextButton(onClick={context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(BuildConfig.API_BASE_URL+"/legal/privacy")))}){Text("전체 개인정보 안내 · 운영자 연락처")}
            TextButton(onClick={context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(BuildConfig.API_BASE_URL+"/legal/attributions")))}){Text("데이터·오픈소스 출처 및 이용 조건")}
        }
    },confirmButton={TextButton(onDismiss){Text("닫기")}})
}
@Composable fun LoginScreen(travel:TravelUiState,model:TravelViewModel,state:AccountState,account:AccountViewModel) {
    val context=LocalContext.current
    // Authentication fields are not captured by screenshots/recents or state restoration.
    DisposableEffect(Unit){val window=(context as? Activity)?.window;window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE);onDispose{window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)}}
    var photoReady by remember{mutableStateOf(false)}
    var signup by remember{mutableStateOf(false)}
    var email by remember{mutableStateOf(state.savedEmail)};var password by remember{mutableStateOf("")};var name by remember{mutableStateOf("")}
    var consent by remember{mutableStateOf(false)};var legal by remember{mutableStateOf(false)}
    Box(Modifier.fillMaxSize().background(Color(0xFF14532D)).testTag("login-page")) {
        LoginScenery(Modifier.fillMaxSize()){photoReady=it}
        Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
            Spacer(Modifier.height(20.dp))
            Text("뚜버기",color=Color.White,fontSize=34.sp,fontWeight=FontWeight.Black)
            Text("전남 뚜벅이 여행",color=Color.White)
            Surface(shape=RoundedCornerShape(26.dp),color=Color.White.copy(alpha=.95f)){
                Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){WebChip("로그인",!signup){signup=false};WebChip("회원가입",signup){signup=true}}
                    if(signup)OutlinedTextField(name,{name=it.take(50)},label={Text("표시 이름 (2~50자)")},singleLine=true,modifier=Modifier.fillMaxWidth().testTag("signup-name"),enabled=!state.busy)
                    OutlinedTextField(email,{email=it.take(254)},label={Text("이메일")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email),singleLine=true,modifier=Modifier.fillMaxWidth().testTag("login-email"),enabled=!state.busy)
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
                    if(signup)Text("8자 이상 · 대문자·소문자·숫자·특수문자 포함",fontSize=11.sp,color=Muted)
                    if(signup)Row(verticalAlignment=Alignment.CenterVertically){Checkbox(consent,{consent=it},enabled=!state.busy,modifier=Modifier.testTag("signup-consent"));Text("[필수] 개인정보 수집·이용 동의",fontSize=12.sp)}
                    TextButton({legal=true}){Text("개인정보·데이터 출처 자세히 보기")}
                    WebAction(if(signup)"회원가입" else "로그인",{account.login(email,password,name,signup,consent);password=""},enabled=!state.busy && (!signup || consent) && email.isNotBlank() && password.isNotBlank(),modifier=Modifier.testTag("login-submit"))
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
            if(photoReady)Text("배경 사진: Unsplash",fontSize=11.sp,color=Color.White.copy(alpha=.8f),modifier=Modifier.align(Alignment.CenterHorizontally).padding(top=4.dp,bottom=8.dp).testTag("login-photo-credit"))
        }
    }
    if(legal)PrivacyInfo{legal=false}
}
@Composable fun MyTravel(state:AccountState,account:AccountViewModel,model:TravelViewModel) {
    var legal by remember{mutableStateOf(false)};var delete by remember{mutableStateOf(false)}
    var clearHistory by remember{mutableStateOf(false)};var name by remember(state.user){mutableStateOf(state.user?.text("displayName").orEmpty())}
    LaunchedEffect(state.user?.text("id")){account.load()}
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp).testTag("my-travel"),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Text("내 여행",fontSize=28.sp,fontWeight=FontWeight.Black)
        if(state.user==null){Text("저장한 여행을 보려면 로그인해 주세요. 게스트 추천은 계속 이용할 수 있습니다.");WebAction("로그인 / 회원가입",account::loginScreen)}
        else {
            Text("${state.user.text("displayName")} 님",fontSize=20.sp,fontWeight=FontWeight.Bold)
            OutlinedTextField(name,{name=it.take(50)},label={Text("표시 이름")},singleLine=true,modifier=Modifier.fillMaxWidth())
            TextButton({account.updateName(name)},enabled=!state.busy && name.trim().length>=2){Text("이름 수정")}
            Text("저장한 코스",fontSize=20.sp,fontWeight=FontWeight.Bold)
            if(state.bookmarks.isEmpty())Text("아직 저장한 코스가 없습니다.",color=Muted)
            state.bookmarks.forEach{item->
                Surface(shape=RoundedCornerShape(18.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(14.dp)){
                    Text(item.text("courseName"),fontWeight=FontWeight.Bold)
                    Text(item.text("city"),fontSize=12.sp,color=Muted)
                    Row{TextButton({val snapshot=item["snapshot"] as? JsonObject;if(snapshot!=null)model.openSaved(snapshot)},enabled=item["snapshot"] is JsonObject){Text("코스 열기")};TextButton({account.removeBookmark(item.text("courseId"))},enabled=!state.busy){Text("저장 취소")}}
                }}
            }
            Text("최근 여행 조건",fontSize=20.sp,fontWeight=FontWeight.Bold)
            Text("직접 저장한 조건만 표시합니다. 다시 추천할 때 날짜와 출발지를 확인하세요.",fontSize=12.sp,color=Muted)
            if(state.history.isEmpty())Text("저장한 여행 조건이 없습니다.",color=Muted)
            state.history.forEach{item->
                Surface(shape=RoundedCornerShape(18.dp),color=Color.White){Column(Modifier.fillMaxWidth().padding(14.dp)){
                    Text(item.text("query"));Row{
                        TextButton({(item["preferences"] as? JsonObject)?.let{model.restorePreferences(it)}},enabled=item["preferences"] is JsonObject){Text("조건 다시 열기")}
                        TextButton({account.removeHistory(item.text("id"))},enabled=!state.busy){Text("삭제")}
                    }
                }}
            }
            if(state.history.isNotEmpty())TextButton({clearHistory=true},enabled=!state.busy){Text("여행 조건 전체 삭제")}
            if(state.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
            state.message?.let{Text(it,fontSize=12.sp,color=Purple)}
            OutlinedButton(account::logout,enabled=!state.busy,modifier=Modifier.fillMaxWidth().testTag("logout-current")){Text("로그아웃")}
            if(state.message!=null)TextButton(account::localLogout,enabled=!state.busy){Text("연결 실패 시 이 기기 로그인 정보만 삭제")}
            TextButton({delete=true},enabled=!state.busy){Text("계정 삭제",color=MaterialTheme.colorScheme.error)}
        }
        LocationPreferenceButton()
        TextButton({legal=true}){Text("개인정보·데이터·오픈소스 안내")}
    }
    if(legal)PrivacyInfo{legal=false}
    if(delete)AppDialog(onDismissRequest={delete=false},title={Text("계정을 영구 삭제할까요?")},text={Text("계정·북마크·여행 이력·앱 내 소셜 연결 정보를 삭제하며 복구할 수 없습니다. 카카오·구글 계정 자체는 삭제하지 않습니다.")},confirmButton={TextButton({delete=false;account.deleteAccount()}){Text("영구 삭제")}},dismissButton={TextButton({delete=false}){Text("취소")}})
    if(clearHistory)AppDialog(onDismissRequest={clearHistory=false},title={Text("저장한 여행 조건을 모두 삭제할까요?")},text={Text("이 계정의 여행 이력만 삭제합니다. 복구할 수 없습니다.")},confirmButton={TextButton({clearHistory=false;account.removeHistory(null)}){Text("삭제")}},dismissButton={TextButton({clearHistory=false}){Text("취소")}})
}
