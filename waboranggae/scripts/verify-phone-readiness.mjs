import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';
const base='http://127.0.0.1:8788';
const team=parse(await readFile('.env.team.local')), env=parse(await readFile('.env'));
const headers={'Content-Type':'application/json','X-Dev-Access-Key':team.TEAM_ACCESS_KEY};
const results=[];
async function send(path,method='GET',body,token) {
  const response=await fetch(base+path,{method,headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(100000)});
  const data=await response.json().catch(()=>({}));
  return {status:response.status,body:data,cache:response.headers.get('cache-control')};
}
assert.equal((await fetch(base+'/')).status,401);
assert.equal((await send('/api/user/me')).status,401);
results.push('팀 인증 및 사용자 인증 없이 개인 데이터 접근 차단');
const providers=await send('/auth/social/providers');
assert.deepEqual(providers.body.providers.map(p=>p.id),['kakao','google']);
assert.ok(providers.body.providers.every(p=>p.enabled));
results.push('카카오·구글 로그인 설정 활성화');
const weather=await send('/api/weather/current?lat=34.95&lng=127.48');
assert.equal(weather.status,200);
results.push('날씨 API 응답: '+(weather.body.available===false?'조회 불가 상태 명시':'응답 확인'));
assert.equal((await send('/api/explain','POST',{course:{},preferences:{}})).status,400);
results.push('잘못된 AI 설명 요청 거부');
const prefs={region:'전라남도',city:'순천',startLocation:'순천 터미널',startType:'terminal',travelDate:null,startTime:'10:00',durationHours:6,mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'친구',lowMobility:false,publicTransportOnly:true,summary:'순천 터미널 출발 6시간 자연·맛집·카페 여행',confidence:1};
const recommended=await send('/api/recommend','POST',{preferences:prefs});
assert.equal(recommended.status,200); assert.equal(recommended.body.source,'tour-api');
const course=recommended.body.courses[0];assert.ok(course);
const edited=await send('/api/recommend/edit','POST',{preferences:prefs,courseId:course.id,placeIds:course.places.map(p=>p.id)});
assert.equal(edited.status,200,JSON.stringify(edited.body));
assert.deepEqual(edited.body.course.places.map(p=>p.id),course.places.map(p=>p.id));
assert.equal(edited.body.course.origin.name,course.origin.name);
assert.equal((await send('/api/recommend/edit','POST',{preferences:prefs,courseId:course.id,placeIds:['not-a-real-place']})).status,400);
results.push('실제 관광정보 기반 편집 재계산·출발지 유지·가짜 장소 차단');
const marker=randomBytes(8).toString('hex'), accounts=[];
try {
  for(let i=0;i<2;i++) {
    const login={email:'phone-test-'+marker+'-'+i+'@example.invalid',password:randomBytes(20).toString('hex')+'!Aa1'};
    const created=await send('/auth/signup','POST',{...login,displayName:'휴대폰 검증 계정'});
    assert.equal(created.status,201);accounts.push({...login,...created.body});
  }
  const [a,b]=accounts;
  const me=await send('/api/user/me','GET',undefined,a.accessToken);
  assert.equal(me.body.password,undefined);assert.equal(me.cache,'no-store');
  const bookmark={courseId:course.id,courseName:course.title,city:course.city,snapshot:course};
  assert.equal((await send('/api/user/bookmarks/add','POST',bookmark,a.accessToken)).status,201);
  assert.equal((await send('/api/user/bookmarks/add','POST',bookmark,a.accessToken)).status,201);
  const saved=await send('/api/user/bookmarks','GET',undefined,a.accessToken);
  assert.equal(saved.body.length,1);assert.deepEqual(saved.body[0].snapshot.places.map(p=>p.id),course.places.map(p=>p.id));
  assert.equal((await send('/api/user/bookmarks','GET',undefined,b.accessToken)).body.length,0);
  const history=await send('/api/user/search-history','POST',{query:prefs.summary,preferences:prefs},a.accessToken);
  assert.equal(history.status,201);
  await send('/api/user/search-history/'+history.body.id,'DELETE',undefined,b.accessToken);
  const logs=await send('/api/user/search-history','GET',undefined,a.accessToken);
  assert.ok(logs.body.some(item=>item.id===history.body.id));assert.equal(logs.body[0].preferences.startType,'terminal');
  assert.equal((await send('/api/user/bookmarks?limit=-1','GET',undefined,a.accessToken)).status,400);
  results.push('다른 계정의 북마크·검색 이력 접근/삭제 차단, 코스와 조건 복원, 중복 저장 안전성');
  assert.equal((await send('/auth/logout','POST',{},a.accessToken)).status,200);
  assert.equal((await send('/api/user/me','GET',undefined,a.accessToken)).status,401);
  assert.equal((await send('/auth/refresh','POST',{refreshToken:a.refreshToken})).status,401);
  results.push('로그아웃 후 기존 access/refresh 토큰 모두 거부');
} finally {
  // Cleanup ONLY the two synthetic accounts created above, never an existing real user.
  for(const account of accounts) {
    const signedIn=await send('/auth/login','POST',{email:account.email,password:account.password});
    assert.equal(signedIn.status,200);
    assert.equal((await send('/api/user/me','DELETE',undefined,signedIn.body.accessToken)).status,200);
    assert.equal((await send('/api/user/me','GET',undefined,signedIn.body.accessToken)).status,401);
  }
}
results.push('이번 검사에서 만든 임시 계정만 삭제, 삭제된 계정 토큰 차단');
const secretNames=['DATA_GO_KR_KEY','KAKAO_REST_API_KEY','KAKAO_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_CLIENT_SECRET','JWT_SECRET','JWT_REFRESH_SECRET','DATABASE_URL','TMAP_API_KEY'];
async function scan(dir) {
  for(const item of await readdir(dir,{withFileTypes:true})) {
    const path=dir+'/'+item.name;
    if(item.isDirectory())await scan(path);
    else if(/\.(js|json|html|css)$/.test(item.name)) {
      const text=await readFile(path,'utf8');
      for(const name of secretNames)for(const value of [env[name],team[name]])if(value&&value.length>12)assert.ok(!text.includes(value),'클라이언트에 서버 비밀값 포함: '+name);
    }
  }
}
await scan('web/dist');
results.push('웹 배포 번들에 서버 API 시크릿·DB/JWT 비밀값 없음');
const report={checkedAt:new Date().toISOString(),results,remaining:['카카오·구글 실제 계정 동의 및 토큰 교환은 사용자 실기 테스트 필요','Galaxy S20+ 앱 종료/재실행 및 네트워크 전환 테스트 필요','APK/AAB 서명 빌드와 Play Console 테스트 미실행']};
await writeFile('.runtime/phone-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
