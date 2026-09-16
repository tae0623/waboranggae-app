package kr.co.waboranggae.nativepilot
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.Test
import org.junit.Assert.*

class BrandIntroMotionTest {
    @Test fun stepsAppearInOrderThenRemainAsATrail(){
        val steps=BrandIntroSpec.steps
        assertEquals(listOf(false,true,false,true,false,true),steps.map{it.right})
        assertTrue(steps.zipWithNext().all{(a,b)->a.delayMs<b.delayMs&&a.y>b.y})
        steps.forEach{assertEquals(0f,introFootprintAlpha(it.delayMs-1f,it.delayMs),.001f)}
        assertTrue(introFootprintAlpha(600f,steps[0].delayMs)>0)
        assertEquals(0f,introFootprintAlpha(600f,steps[1].delayMs),.001f)
        steps.forEach{assertEquals(.4f,introFootprintAlpha(BrandIntroSpec.durationMs.toFloat(),it.delayMs),.001f)}
    }
    @Test fun allFootprintsFinishBeforeIntroDismissal(){
        assertTrue(BrandIntroSpec.steps.maxOf{it.delayMs}+BrandIntroSpec.stepDurationMs<BrandIntroSpec.durationMs)
    }
    @Test fun footprintOpacityStaysInRange(){
        BrandIntroSpec.steps.forEach{step->(-100..3000 step 10).forEach{assertTrue(introFootprintAlpha(it.toFloat(),step.delayMs) in 0f..1f)}}
    }
}
