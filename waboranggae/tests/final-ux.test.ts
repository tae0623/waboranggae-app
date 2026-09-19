import {describe,it,expect} from 'vitest';
import {nearbyAdditions,bestInsertion} from '../src/domain/routeInsertion';
import {validatePasswordRequirements} from '../server/src/utils/crypto';
import {readFileSync} from 'node:fs';
const p=(id:string,longitude:number)=>({id,name:id,latitude:35,longitude});
describe('release UX contracts without paid API calls',()=>{
 it('shows build versions while keeping signup consent separate from data attribution',()=>{
  const account=readFileSync('android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/AccountScreens.kt','utf8');
  expect(account).toContain('앱 버전 v${BuildConfig.VERSION_NAME}');
  expect(account).not.toContain('개인정보·데이터 출처 자세히 보기');
  expect(account).toContain('if(signup)TextButton({legal=true},modifier=Modifier.testTag("signup-privacy-details"))');
  expect(account).toContain('if(legal)PrivacyInfo(includeAttributions=false){legal=false}');
  expect(account).toContain('if(includeAttributions)TextButton');
  expect(account).toContain('consent&&state.signupBotAvailable');
  const webInfo=readFileSync('web/src/AppInfo.tsx','utf8');
  expect(webInfo).toContain("import {version} from '../../package.json'");
  expect(webInfo).toContain('앱 버전 v{version}');
  const version=JSON.parse(readFileSync('package.json','utf8')).version;
  expect(readFileSync('android-native/app/build.gradle.kts','utf8')).toContain('versionName = "'+version+'"');
 });
 it('does not turn login progress into a save error or decorate home dates with eyes',()=>{
  const root='android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/';
  const detail=readFileSync(root+'CourseDetail.kt','utf8');
  expect(detail).toContain('if(auth.saveError!=null&&!auth.busy)');
  expect(detail).not.toContain('if(auth.message!=null&&!auth.busy)');
  expect(readFileSync(root+'WebHome.kt','utf8')).not.toContain('👀');
 });
 it('does not require uppercase while preserving length, number and symbol checks',()=>{
  expect(validatePasswordRequirements('samplepass9!')).toBeNull();
  expect(validatePasswordRequirements('samplepass')).not.toBeNull();
  expect(validatePasswordRequirements('a9!')).not.toBeNull();
  expect(validatePasswordRequirements('가'.repeat(26)+'a9!')).not.toBeNull();
 });
 it('inserts a place between neighbouring stops instead of blindly appending',()=>{
  const result=bestInsertion([p('A',127),p('B',127.02)],p('C',127.01),p('origin',126.99));
  expect(result.index).toBe(1);expect(result.detourKm).toBeLessThan(.001);
 });
 it('ranks detour proximity, excludes visited days and deduplicates',()=>{
  const route=[p('A',127),p('B',127.02)];
  expect(nearbyAdditions(route,[p('far',128),p('near',127.01),p('near',127.01),p('A',127),p('visited',127.001)],p('origin',126.99),['visited']).map(x=>x.place.id)).toEqual(['near','far']);
 });
 it('does not invent proximity for missing coordinates',()=>{
  expect(nearbyAdditions<{id:string;name:string;latitude?:number;longitude?:number}>([p('a',127)],[{id:'bad',name:'bad'}])).toEqual([]);
 });
 it('separates profile settings from account actions and exposes both daily scores',()=>{
  const web=readFileSync('web/src/App.tsx','utf8');
  expect(web).toContain('trip-bundle');expect(web).toContain('CourseScoreReport c={day.course}');
  expect(web).toContain('이 날짜 코스 편집');expect(web).toContain('앱 설정');
  expect(readFileSync('web/src/AccountActions.tsx','utf8')).toContain("await ask('닉네임 수정'");
  const native=readFileSync('android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/AccountViewModel.kt','utf8');
  expect(native.indexOf('onSaved()')).toBeLessThan(native.indexOf('try {refreshLists()}'));
 });
});
