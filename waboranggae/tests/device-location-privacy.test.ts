import {describe,it,expect,vi,beforeEach} from 'vitest';
import {readFileSync} from 'node:fs';
const mocks=vi.hoisted(()=>({request:vi.fn(async(..._args:unknown[]):Promise<unknown>=>({documents:[]}))}));
vi.mock('../server/src/modules/recommendation/data/kakao',()=>({kakaoRequest:mocks.request,kakaoStatus:()=>({restKeyConfigured:true,freeTierConfirmed:true})}));
import {placeSearchQuerySchema} from '../server/src/modules/places/routes';
import {searchPlaces,PlaceSearchUnavailable} from '../server/src/modules/places/search';
const ui='android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/';
beforeEach(()=>mocks.request.mockClear());
describe('device location stays on device',()=>{
 it('search accepts only typed query and rejects device coordinates',()=>{
  expect(placeSearchQuerySchema.safeParse({q:'터미널'}).success).toBe(true);
  for(const data of [{lat:35,lng:127},{latitude:35,longitude:127},{location:'private'}])expect(placeSearchQuerySchema.safeParse({q:'터미널',...data}).success).toBe(false);
 });
 it('never forwards a device search center to Kakao',async()=>{
  await searchPlaces('개인위치 미전송 검사');expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(mocks.request.mock.calls[0]).toEqual(['/v2/local/search/keyword.json',{query:'개인위치 미전송 검사',size:'15',page:'1'}]);
 });
 it('does not present quota or upstream failure as an empty search',async()=>{
  mocks.request.mockResolvedValueOnce(null);
  await expect(searchPlaces('제공처 일시 실패')).rejects.toBeInstanceOf(PlaceSearchUnavailable);
 });
 it('departure map uses only selected place or raw accuracy-order search results',()=>{
  const map=readFileSync(ui+'DepartureSearchMap.kt','utf8');
  expect(map).toContain('selected?:accuracyResults.firstOrNull()');
  expect(map).not.toMatch(/DeviceOnlyLocation|LocationManager|sortOnDevice|NearbyDepartureCandidates/);
  const wizard=readFileSync(ui+'WebWizard.kt','utf8');
  expect(wizard).toContain('DepartureSearchMap(f.departure,state.suggestions)');
 });
 it('location UI has no network/storage/model channel and discards its state on exit',()=>{
  const local=readFileSync(ui+'NearbyDepartureCandidates.kt','utf8');
  expect(local).not.toMatch(/import .*?(?:okhttp|retrofit|TravelRepository|TravelViewModel|kakao|serialization|java\.io)/);
  expect(local).toContain('Lifecycle.Event.ON_STOP');expect(local).toContain('onDispose');
  expect(local).not.toMatch(/rememberSaveable\s*[({]/);expect(local).not.toMatch(/\.search\(/);
  const model=readFileSync(ui+'TravelViewModel.kt','utf8');const repo=readFileSync('android-native/app/src/main/java/kr/co/waboranggae/nativepilot/data/TravelRepository.kt','utf8');
  expect(model+repo).not.toContain('DeviceOnlyLocation');
  const manifest=readFileSync('android-native/app/src/main/AndroidManifest.xml','utf8');
  expect(manifest).toContain('ACCESS_COARSE_LOCATION');expect(manifest).not.toMatch(/ACCESS_FINE_LOCATION|ACCESS_BACKGROUND_LOCATION/);
 });
});
