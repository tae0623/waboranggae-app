package kr.co.waboranggae.nativepilot.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

// Small code-native line icons; avoids bundling the entire extended icon catalogue in a debug APK.
object PilotIcons {
    val Home by lazy { icon("Home","M3,12 L5,10 M5,10 L12,3 L19,10 M5,10 V20 A1,1 0,0,0 6,21 H9 M19,10 L21,12 M19,10 V20 A1,1 0,0,1 18,21 H15 M9,21 A1,1 0,0,0 10,20 V16 A1,1 0,0,1 11,15 H13 A1,1 0,0,1 14,16 V20 A1,1 0,0,0 15,21 M9,21 H15") }
    val List by lazy { icon("List","M4 6h16M4 10h16M4 14h16M4 18h16") }
    val User by lazy { icon("User","M16,7 A4,4 0,1,1 8,7 A4,4 0,1,1 16,7 Z M12,14 A7,7 0,0,0 5,21 H19 A7,7 0,0,0 12,14 Z") }
    val Search by lazy { icon("Search","M21,21 L15,15 M17,10 A7,7 0,1,1 3,10 A7,7 0,1,1 17,10 Z") }
    val Bell by lazy { icon("Bell","M15,17 H20 L18.595,15.595 A2.032,2.032 0,0,1 18,14.158 V11 A6.002,6.002 0,0,0 14,5.341 V5 A2,2 0,1,0 10,5 V5.341 C7.67,6.165 6,8.388 6,11 V14.159 C6,14.697 5.786,15.214 5.405,15.595 L4,17 H9 M15,17 V18 A3,3 0,1,1 9,18 V17 M15,17 H9") }
    private fun icon(name:String,path:String)=ImageVector.Builder(name,24.dp,24.dp,24f,24f).apply {
        addPath(pathData=PathParser().parsePathString(path).toNodes(),stroke=SolidColor(Color.Black),
            strokeLineWidth=1.9f,strokeLineCap=StrokeCap.Round,strokeLineJoin=StrokeJoin.Round)
    }.build()
    val Route=icon("Route","M6,6 A2,2 0,1 1,2,6 A2,2 0,1 1,6,6 M18,18 A2,2 0,1 1,22,18 A2,2 0,1 1,18,18 M6,6 L17,6 Q22,6 20,10 Q19,12 14,12 L10,12 Q4,12 4,16 Q4,18 9,18 L18,18")
    val Map=icon("Map","M9,20 L3.553,17.276 A1,1 0,0,1 3,16.382 V5.618 A1,1 0,0,1 4.447,4.724 L9,7 M9,20 L15,17 M9,20 V7 M15,17 L19.553,19.276 A1,1 0,0,0 21,18.382 V7.618 A1,1 0,0,0 20.447,6.724 L15,4 M15,17 V4 M15,4 L9,7")
    val Bus=icon("Bus","M5,19 L5,21 M19,19 L19,21 M7,3 L17,3 Q20,3 20,6 L20,17 Q20,19 18,19 L6,19 Q4,19 4,17 L4,6 Q4,3 7,3 Z M4,11 L20,11 M8,15 L8,15.1 M16,15 L16,15.1 M9,6 L15,6")
    val Schedule=icon("Schedule","M22,12 A10,10 0,1 1,2,12 A10,10 0,1 1,22,12 M12,6 L12,12 L16,14")
    val Walk=icon("Walk","M15,4 A2,2 0,1 1,11,4 A2,2 0,1 1,15,4 M9,12 L11,8 L14,9 L17,12 L20,12 M12,9 L10,16 L7,21 M11,14 L15,17 L15,22 M10,9 L6,12 L3,12")
    val Open=icon("Open","M14,3 L21,3 L21,10 M21,3 L10,14 M11,3 L5,3 Q3,3 3,5 L3,19 Q3,21 5,21 L19,21 Q21,21 21,19 L21,13")
    val Close=icon("Close","M6,6 L18,18 M18,6 L6,18")
    val Check=icon("Check","M5,12 L10,17 L19,7")
    val Down=icon("Down","M6,9 L12,15 L18,9")
}
