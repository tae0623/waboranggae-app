package kr.co.waboranggae.nativepilot.data
import okhttp3.HttpUrl
fun mayAttachDebugImageKey(base:HttpUrl?,url:HttpUrl):Boolean =
    base!=null && base.isHttps && url.scheme==base.scheme && url.host==base.host && url.port==base.port
        && url.encodedPath==base.encodedPath.trimEnd('/')+"/api/media/tour-image"
