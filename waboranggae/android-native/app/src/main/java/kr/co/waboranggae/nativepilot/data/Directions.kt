package kr.co.waboranggae.nativepilot.data

import java.net.URLEncoder

data class CourseDirections(val from:MapStop,val to:MapStop,val transit:Boolean) {
    private fun label(value:String)=URLEncoder.encode(value,"UTF-8").replace("+","%20")
    fun webUrl()="https://map.kakao.com/link/by/"+(if(transit)"traffic" else "walk")+
        "/"+label(from.name)+","+from.coordinate.latitude+","+from.coordinate.longitude+
        "/"+label(to.name)+","+to.coordinate.latitude+","+to.coordinate.longitude
    fun appUrl()="kakaomap://route?sp="+from.coordinate.latitude+","+from.coordinate.longitude+
        "&ep="+to.coordinate.latitude+","+to.coordinate.longitude+"&by="+(if(transit)"publictransit" else "foot")
}
fun Course.directionsTo(selected:MapStop):CourseDirections? {
    val stops=mapStops();val index=stops.indexOfFirst{it.id==selected.id}
    if(index<0 || stops.size<2)return null
    val toIndex=if(index==0)1 else index
    val from=stops[toIndex-1];val to=stops[toIndex]
    val route=routeSegments.getOrNull(toIndex-1)
    val transit=route==null || route.transitMinutes>0 || route.steps.any{it.mode in listOf("bus","subway","train","transit")}
    return CourseDirections(from,to,transit)
}

