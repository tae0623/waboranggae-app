import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({find:vi.fn()}));
vi.mock('../server/src/db/client',()=>({prisma:{user:{findUnique:mocks.find}}}));
import { requireConsentForAccountWrite } from '../server/src/middleware/privacyConsent';
import { needsPrivacyConsent,PRIVACY_NOTICE_VERSION,PRIVACY_OPERATOR_NAME } from '../src/domain/privacyNotice';
import { readFileSync } from 'node:fs';
beforeEach(()=>vi.clearAllMocks());
async function check(method:string,user:any){mocks.find.mockResolvedValue(user);const req:any={method,user:{userId:'fixture'}},res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();await requireConsentForAccountWrite(req,res,next);return {res,next};}
describe('최초 동의와 기존 계정의 권리',()=>{
  it('동의 기록이 없거나 이전 버전이면 재확인한다',()=>{for(const user of [null,{}, {consentVersion:'old',consentedAt:'date'},{consentVersion:PRIVACY_NOTICE_VERSION}])expect(needsPrivacyConsent(user)).toBe(true);});
  it('현재 버전에 동의한 계정은 재로그인마다 묻지 않는다',()=>{expect(needsPrivacyConsent({consentVersion:PRIVACY_NOTICE_VERSION,consentedAt:'date'})).toBe(false);});
  it('기존 동의 없는 계정의 새로운 저장은 UI를 우회해도 막는다',async()=>{for(const method of ['POST','PATCH','PUT']){const r=await check(method,{consentVersion:null,consentedAt:null});expect(r.res.status).toHaveBeenCalledWith(403);expect(r.res.json).toHaveBeenCalledWith(expect.objectContaining({code:'PRIVACY_CONSENT_REQUIRED'}));expect(r.next).not.toHaveBeenCalled();}});
  it('이미 동의한 계정의 저장을 허용한다',async()=>{const r=await check('POST',{consentVersion:PRIVACY_NOTICE_VERSION,consentedAt:new Date()});expect(r.next).toHaveBeenCalledWith();});
  it('동의를 거부해도 기존 정보 열람과 삭제를 막지 않는다',async()=>{for(const method of ['GET','DELETE']){const r=await check(method,null);expect(r.next).toHaveBeenCalledWith();}expect(mocks.find).not.toHaveBeenCalled();});
  it('DB 실패를 동의한 것으로 취급하지 않는다',async()=>{mocks.find.mockRejectedValue(new Error('test'));const next=vi.fn();await requireConsentForAccountWrite({method:'POST',user:{userId:'fixture'}} as any,{} as any,next);expect(next).toHaveBeenCalledWith(expect.any(Error));});
  it('네이티브 안내 버전과 운영자명이 서버·웹과 같다',()=>{const source=readFileSync('android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/AccountViewModel.kt','utf8');expect(source).toContain(`NOTICE_VERSION="${PRIVACY_NOTICE_VERSION}"`);expect(source).toContain(`OPERATOR_NAME="${PRIVACY_OPERATOR_NAME}"`);});
});
