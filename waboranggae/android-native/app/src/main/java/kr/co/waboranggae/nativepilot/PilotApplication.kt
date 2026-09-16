package kr.co.waboranggae.nativepilot

import android.app.Application
import com.kakao.vectormap.KakaoMapSdk
import coil.ImageLoader
import coil.ImageLoaderFactory
import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import kr.co.waboranggae.nativepilot.data.mayAttachDebugImageKey

class PilotApplication : Application(), ImageLoaderFactory {
    override fun newImageLoader():ImageLoader {
        val base=BuildConfig.API_BASE_URL.toHttpUrlOrNull()
        val client=OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
            .addInterceptor{chain->
                val request=chain.request()
                val trusted=mayAttachDebugImageKey(base,request.url)
                val next=if(BuildConfig.DEBUG && trusted && BuildConfig.DEV_ACCESS_KEY.isNotBlank())
                    request.newBuilder().header("X-Dev-Access-Key",BuildConfig.DEV_ACCESS_KEY).build() else request
                chain.proceed(next)
            }.build()
        return ImageLoader.Builder(this).okHttpClient(client).build()
    }
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.KAKAO_NATIVE_APP_KEY.isNotBlank()) {
            KakaoMapSdk.init(this, BuildConfig.KAKAO_NATIVE_APP_KEY)
        }
    }
}
