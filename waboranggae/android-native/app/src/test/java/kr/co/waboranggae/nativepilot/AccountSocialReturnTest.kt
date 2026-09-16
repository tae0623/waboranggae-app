package kr.co.waboranggae.nativepilot

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.Assert.*

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class AccountSocialReturnTest {
    @Before fun setup(){Dispatchers.setMain(StandardTestDispatcher())}
    @After fun teardown(){Dispatchers.resetMain()}
    private class Fake(val consent:Boolean=false):TravelRepository by HttpTravelRepository("https://example.invalid","") {
        var accepted=0;var polls=0;var start:JsonObject?=null
        override suspend fun restoreSession()=false
        override suspend fun acceptSession(value:JsonObject){accepted++}
        override suspend fun setLoginOptions(options:LoginOptions){}
        override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement=when(path){
            "/auth/social/providers"->buildJsonObject{put("providers",JsonArray(emptyList()))}
            "/auth/social/kakao/start"->{start=body;buildJsonObject{put("flowId","f".repeat(64));put("pollSecret","s".repeat(64));put("authorizationUrl","https://kauth.kakao.com/oauth/authorize?state=fixture")}}
            "/auth/social/result"->{
                polls++;assertEquals("s".repeat(64),body!!.text("pollSecret"))
                buildJsonObject{put("status",if(consent)"consent_required" else if(polls<2)"pending" else "complete");
                    put("user",buildJsonObject{put("id","fixture");put("consentVersion",NOTICE_VERSION);put("consentedAt","2026-09-17T00:00:00Z")})}
            }
            else->JsonArray(emptyList())
        }
    }
    @Test fun identifiesAndroidButWaitsForAuthenticatedPollingResult()=runTest {
        val repo=Fake();val vm=AccountViewModel(repo);advanceUntilIdle()
        vm.social("kakao");runCurrent();assertEquals("android",repo.start!!.text("client"));assertEquals(0,repo.accepted)
        advanceTimeBy(3000);runCurrent();assertEquals(0,repo.accepted);assertNull(vm.state.value.user)
        advanceTimeBy(3000);runCurrent();assertEquals(1,repo.accepted);assertFalse(vm.state.value.showLogin);assertNull(vm.state.value.authorizationUrl)
    }
    @Test fun providerCompletionDoesNotSkipFirstConsent()=runTest {
        val repo=Fake(true);val vm=AccountViewModel(repo);advanceUntilIdle();vm.social("kakao");advanceUntilIdle()
        assertTrue(vm.state.value.needsConsent);assertNotNull(vm.state.value.pendingSocial);assertEquals(0,repo.accepted)
    }
    @Test fun cancellingStopsPendingPollingWithoutSigningIn()=runTest {
        val repo=Fake();val vm=AccountViewModel(repo);advanceUntilIdle();vm.social("kakao");runCurrent();vm.cancel();advanceUntilIdle()
        assertEquals(0,repo.accepted);assertEquals(0,repo.polls);assertNull(vm.state.value.authorizationUrl)
    }
}
