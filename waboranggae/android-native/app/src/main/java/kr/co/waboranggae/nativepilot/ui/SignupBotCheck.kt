package kr.co.waboranggae.nativepilot.ui

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

private const val BOT_URL="https://waboranggae-app.pages.dev/auth/bot-check"
@SuppressLint("SetJavaScriptEnabled")
@Composable fun SignupBotCheck(onDismiss:()->Unit,onVerified:(String)->Unit){
    AppDialog(onDismissRequest=onDismiss,title={Text("자동 가입 방지 확인")},text={
        AndroidView(modifier=Modifier.fillMaxWidth().height(250.dp),factory={context->
            WebView(context).apply{
                settings.javaScriptEnabled=true
                settings.domStorageEnabled=true
                settings.allowFileAccess=false
                settings.allowContentAccess=false
                settings.setGeolocationEnabled(false)
                settings.mixedContentMode=android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                settings.setSupportMultipleWindows(false)
                addJavascriptInterface(object{
                    @JavascriptInterface fun complete(token:String){
                        if(token.length<=2048)Handler(Looper.getMainLooper()).post{onVerified(token)}
                    }
                },"DdubugiBot")
                webViewClient=object:WebViewClient(){
                    override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean=
                        request.isForMainFrame && (request.url.scheme!="https"||request.url.host!="waboranggae-app.pages.dev"||request.url.path!="/auth/bot-check")
                }
                loadUrl(BOT_URL)
            }
        },onRelease={it.stopLoading();it.removeJavascriptInterface("DdubugiBot");it.destroy()})
    },confirmButton={TextButton(onDismiss){Text("닫기")}})
}
