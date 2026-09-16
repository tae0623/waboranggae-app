package kr.co.waboranggae.nativepilot
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import kr.co.waboranggae.nativepilot.data.*
import kr.co.waboranggae.nativepilot.ui.*
import org.junit.*
import org.junit.Assert.*
@OptIn(ExperimentalCoroutinesApi::class)
class AccountConsentTest {
    @Before fun setup(){Dispatchers.setMain(StandardTestDispatcher())}
    @After fun teardown(){Dispatchers.resetMain()}
    private class Fake(var version:String?=null,var restore:Boolean=true):TravelRepository by HttpTravelRepository("https://example.org","") {
        var accepted=0;var cleared=false;var reads=0
        fun user()=buildJsonObject{put("id","test");if(version!=null){put("consentVersion",version);put("consentedAt","2026-09-15T00:00:00Z")}}
        override suspend fun restoreSession()=restore
        override suspend fun clearSession(){cleared=true}
        override suspend fun acceptSession(value:JsonObject){}
        override suspend fun api(path:String,method:String,body:JsonObject?,auth:Boolean):JsonElement=when(path){
            "/api/user/me"->user()
            "/auth/login"->buildJsonObject{put("user",user())}
            "/auth/consent"->{assertEquals(true,body!!["privacyConsent"]!!.jsonPrimitive.boolean);accepted++;version=NOTICE_VERSION;user()}
            "/auth/social/providers"->buildJsonObject{put("providers",JsonArray(emptyList()))}
            else->{reads++;JsonArray(emptyList())}
        }
    }
    @Test fun restoredOldSessionShowsNoticeWithoutAutoConsent()=runTest {
        val repo=Fake("old");val vm=AccountViewModel(repo);advanceUntilIdle()
        assertTrue(vm.state.value.needsConsent);assertEquals(0,repo.accepted);assertEquals(0,repo.reads)
        vm.agreePrivacy(false);advanceUntilIdle();assertTrue(vm.state.value.needsConsent)
        vm.agreePrivacy(true);advanceUntilIdle();assertFalse(vm.state.value.needsConsent);assertEquals(1,repo.accepted)
    }
    @Test fun currentVersionSkipsNoticeOnRestoreAndLogin()=runTest {
        val repo=Fake(NOTICE_VERSION);val vm=AccountViewModel(repo);advanceUntilIdle();assertFalse(vm.state.value.needsConsent)
        vm.login("test@example.invalid","password","",false,false);advanceUntilIdle()
        assertFalse(vm.state.value.needsConsent);assertFalse(vm.state.value.showLogin);assertEquals(0,repo.accepted)
    }
    @Test fun firstEmailLoginShowsNoticeAndDecliningKeepsGuestAvailable()=runTest {
        val repo=Fake(null,false);val vm=AccountViewModel(repo);advanceUntilIdle()
        vm.login("test@example.invalid","password","",false,false);advanceUntilIdle();assertTrue(vm.state.value.needsConsent)
        vm.guest();advanceUntilIdle();assertTrue(repo.cleared);assertNull(vm.state.value.user);assertFalse(vm.state.value.needsConsent);assertFalse(vm.state.value.showLogin)
    }
}
