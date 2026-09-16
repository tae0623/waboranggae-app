package kr.co.waboranggae.nativepilot

import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.Assert.*

@OptIn(ExperimentalCoroutinesApi::class)
class AccountRecoveryTest {
    @Before fun setup() { Dispatchers.setMain(StandardTestDispatcher()) }
    @After fun teardown() { Dispatchers.resetMain() }
    private class Fake : TravelRepository by HttpTravelRepository("https://example.org","") {
        var failProviders=true
        var requests=0
        var startFailure=false
        override suspend fun restoreSession()=false
        override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement {
            if(path=="/auth/social/providers") {
                requests++
                if(failProviders)throw ApiFailure("offline")
                return buildJsonObject { put("providers",buildJsonArray { add(buildJsonObject { put("id","kakao");put("enabled",true) }) }) }
            }
            if(path.endsWith("/start")) {
                if(startFailure)throw ApiFailure("로그인 요청이 만료되었습니다.",400)
                return buildJsonObject { put("flowId","a".repeat(64));put("pollSecret","b".repeat(64));put("authorizationUrl","https://kauth.kakao.com/oauth/authorize") }
            }
            return buildJsonObject { put("status","pending") }
        }
    }
    @Test fun providerFailureCanBeRetriedAfterConnectionRecovers()=runTest {
        val repo=Fake();val vm=AccountViewModel(repo);advanceUntilIdle()
        assertNotNull(vm.state.value.providersError);assertFalse(vm.state.value.providersLoading)
        repo.failProviders=false;vm.refreshProviders();advanceUntilIdle()
        assertNull(vm.state.value.providersError);assertEquals(1,vm.state.value.providers.size);assertEquals(2,repo.requests)
    }
    @Test fun reopeningLoginRefreshesProviderAvailability()=runTest {
        val repo=Fake();val vm=AccountViewModel(repo);advanceUntilIdle()
        repo.failProviders=false;vm.loginScreen();advanceUntilIdle()
        assertNull(vm.state.value.providersError);assertTrue(vm.state.value.showLogin)
    }
    @Test fun socialBadRequestDoesNotClaimPasswordIsInvalid()=runTest {
        val repo=Fake().apply{failProviders=false;startFailure=true};val vm=AccountViewModel(repo);advanceUntilIdle()
        vm.social("kakao");advanceUntilIdle()
        assertEquals("로그인 요청이 만료되었습니다.",vm.state.value.message);assertFalse(vm.state.value.busy)
    }
    @Test fun missingBrowserStopsPollingAndExplainsRecovery()=runTest {
        val repo=Fake().apply{failProviders=false};val vm=AccountViewModel(repo);advanceUntilIdle()
        vm.social("kakao");runCurrent();assertNotNull(vm.state.value.authorizationUrl)
        vm.browserFailed();advanceUntilIdle()
        assertFalse(vm.state.value.busy);assertNull(vm.state.value.authorizationUrl)
        assertTrue(vm.state.value.message!!.contains("브라우저"))
    }
}
