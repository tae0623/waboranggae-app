package kr.co.waboranggae.nativepilot

import kr.co.waboranggae.nativepilot.data.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class LoginOptionsTest {
 private class Tokens:SessionStore {var value:String?=null;override fun read()=value;override fun write(refresh:String?){value=refresh}}
 private class Options:LoginOptionsStore {var value=LoginOptions();override fun read()=value;override fun write(value:LoginOptions){this.value=value}}
 private val session=buildJsonObject{put("accessToken","access");put("refreshToken","refresh")}
 private fun client(paths:MutableList<String> = mutableListOf())=OkHttpClient.Builder().addInterceptor{chain->
  paths+=chain.request().url.encodedPath
  val body=if(chain.request().url.encodedPath=="/auth/refresh")"""{"accessToken":"renewed","refreshToken":"renewed-refresh"}"""else "{}"
  Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("fixture").body(body.toResponseBody()).build()
 }.build()
 @Test fun defaultDoesNotPersistOrRestoreToken()=runBlocking<Unit>{
  val tokens=Tokens();val prefs=Options();val repo=HttpTravelRepository("https://example.org","",client(),tokens,prefs)
  repo.acceptSession(session);assertNull(tokens.value)
  repo.api("/api/user/me",auth=true)
  assertFalse(HttpTravelRepository("https://example.org","",client(),tokens,prefs).restoreSession())
 }
 @Test fun optedInAutoLoginRestoresEncryptedStoreContractAndRotates()=runBlocking<Unit>{
  val tokens=Tokens();val prefs=Options();val repo=HttpTravelRepository("https://example.org","",client(),tokens,prefs)
  repo.setLoginOptions(LoginOptions(rememberId=true,autoLogin=true,email="fixture@example.invalid"))
  repo.acceptSession(session);assertEquals("refresh",tokens.value)
  val next=HttpTravelRepository("https://example.org","",client(),tokens,prefs)
  assertTrue(next.restoreSession());assertEquals("renewed-refresh",tokens.value)
  assertEquals("fixture@example.invalid",next.loginOptions().email)
 }
 @Test fun turningOffOptionsDeletesSavedValuesButKeepsCurrentSession()=runBlocking<Unit>{
  val tokens=Tokens();val prefs=Options();val repo=HttpTravelRepository("https://example.org","",client(),tokens,prefs)
  repo.setLoginOptions(LoginOptions(true,true,"fixture@example.invalid"));repo.acceptSession(session)
  repo.setLoginOptions(LoginOptions(false,false,"must-not-persist"))
  assertNull(tokens.value);assertEquals("",prefs.value.email)
  repo.api("/api/user/me",auth=true)
 }
 @Test fun logoutUpgradesThenRevokesOnlyCurrentSessionAndPreservesSavedId()=runBlocking<Unit>{
  val paths=mutableListOf<String>();val tokens=Tokens();val prefs=Options()
  val repo=HttpTravelRepository("https://example.org","",client(paths),tokens,prefs)
  repo.setLoginOptions(LoginOptions(true,true,"fixture@example.invalid"));repo.acceptSession(session)
  repo.logoutCurrentSession()
  assertEquals(listOf("/auth/refresh","/auth/logout/current"),paths);assertNull(tokens.value)
  assertEquals("fixture@example.invalid",prefs.value.email)
  try{repo.api("/api/user/me",auth=true);fail("Logged out")}catch(e:ApiFailure){assertEquals(401,e.status)}
 }
 @Test fun legacyStoredTokenDoesNotOptUserIntoAutoLogin()=runBlocking<Unit>{
  val tokens=Tokens().apply{value="legacy"};val repo=HttpTravelRepository("https://example.org","",client(),tokens,Options())
  assertFalse(repo.restoreSession());assertNull(tokens.value)
 }
}
