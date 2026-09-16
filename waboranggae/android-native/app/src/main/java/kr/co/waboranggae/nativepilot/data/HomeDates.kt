package kr.co.waboranggae.nativepilot.data

import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

fun HotPlace.visibleOnHome(today:LocalDate=LocalDate.now(ZoneId.of("Asia/Seoul"))):Boolean {
    if(source!="festival" && category!="축제·행사")return true
    val start=runCatching{LocalDate.parse(eventStartDate?.replace("-",""),DateTimeFormatter.BASIC_ISO_DATE)}.getOrNull()?:return false
    val end=runCatching{LocalDate.parse((eventEndDate?:eventStartDate)?.replace("-",""),DateTimeFormatter.BASIC_ISO_DATE)}.getOrNull()?:return false
    return !end.isBefore(start) && !end.isBefore(today)
}
