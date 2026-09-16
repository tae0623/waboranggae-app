package kr.co.waboranggae.nativepilot

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.caverock.androidsvg.SVG
import java.io.File
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Asset rendering only. Does not launch an Activity, inspect the screen, or interact with the lock screen. */
@RunWith(AndroidJUnit4::class)
class BrandAssetTest {
    @Test fun mapWalkerBrandAndWebMapRender() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val folder=File(context.getExternalFilesDir(null),"native-pilot-screens").apply{mkdirs()}
        val bitmap=Bitmap.createBitmap(432,432,Bitmap.Config.ARGB_8888)
        val walker=requireNotNull(context.getDrawable(R.drawable.ic_brand))
        val walkerCanvas=Canvas(bitmap)
        walker.setBounds(0,0,432,432);walker.draw(walkerCanvas)
        File(folder,"map-walking-mark.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
        val svg=SVG.getFromAsset(context.assets,"web_splash_map.svg")
        assertNotNull(svg.documentViewBox)
        val preview=Bitmap.createBitmap(640,1120,Bitmap.Config.ARGB_8888)
        val canvas=Canvas(preview);canvas.drawColor(android.graphics.Color.WHITE)
        svg.documentWidth=640f;svg.documentHeight=1120f;svg.renderToCanvas(canvas)
        File(folder,"web-map-render.png").outputStream().use{preview.compress(Bitmap.CompressFormat.PNG,100,it)}
        val icon=requireNotNull(context.getDrawable(R.mipmap.ic_launcher))
        val iconPreview=Bitmap.createBitmap(512,512,Bitmap.Config.ARGB_8888)
        icon.setBounds(0,0,512,512);icon.draw(Canvas(iconPreview))
        File(folder,"launcher-icon-preview.png").outputStream().use{iconPreview.compress(Bitmap.CompressFormat.PNG,100,it)}
        assertEquals("뚜버기",context.applicationInfo.loadLabel(context.packageManager).toString())
    }
}
