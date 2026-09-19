import { describe,it,expect } from 'vitest';
import { consentSchema,PRIVACY_NOTICE_VERSION } from '../server/src/privacy';
import { privacyHtml,SUPPORT_EMAIL } from '../server/src/legalContent';
import { PRIVACY_OPERATOR_NAME } from '../src/domain/privacyNotice';
import { toPhotoImages } from '../server/src/modules/hot-places/photokorea';
import { parseTourImageUrl,rasterContentType } from '../server/src/modules/media/routes';
describe('개인정보·저작자 메타데이터',()=>{
  it('관광공사의 image/jpg는 JPEG로 정규화하되 SVG/HTML은 허용하지 않는다',()=>{
    expect(rasterContentType('image/jpg')).toBe('image/jpeg');expect(rasterContentType('IMAGE/JPEG; charset=utf-8')).toBe('image/jpeg');
    expect(rasterContentType('image/svg+xml')).toBeNull();expect(rasterContentType('text/html')).toBeNull();
  });
  it('관광 이미지 프록시의 외부 호스트·인증정보·비표준 포트를 거부한다',()=>{
    for(const url of ['http://127.0.0.1/private','https://tong.visitkorea.or.kr.evil.example/image','https://user:pass@tong.visitkorea.or.kr/image','https://tong.visitkorea.or.kr:5432/image'])expect(()=>parseTourImageUrl(url)).toThrow();
    expect(parseTourImageUrl('http://tong.visitkorea.or.kr/cms2/image.jpg').hostname).toBe('tong.visitkorea.or.kr');
  });
  it('동의 누락·거절·지난 버전은 명시적으로 거부한다',()=>{
    expect(consentSchema.safeParse({}).success).toBe(false);
    expect(consentSchema.safeParse({privacyConsent:false,consentVersion:PRIVACY_NOTICE_VERSION}).success).toBe(false);
    expect(consentSchema.safeParse({privacyConsent:true,ageConfirmed:true,consentVersion:'old'}).success).toBe(false);
    expect(consentSchema.safeParse({privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION}).success).toBe(true);
    expect(consentSchema.safeParse({privacyConsent:true,consentVersion:PRIVACY_NOTICE_VERSION}).success).toBe(false);
    expect(consentSchema.safeParse({privacyConsent:true,ageConfirmed:false,consentVersion:PRIVACY_NOTICE_VERSION}).success).toBe(false);
    expect(consentSchema.safeParse({privacyConsent:true,ageConfirmed:'true',consentVersion:PRIVACY_NOTICE_VERSION}).success).toBe(false);
  });
  it('사진 저작자를 버리지 않고 반환한다',()=>{
    const images=toPhotoImages([{galWebImageUrl:'https://tong.visitkorea.or.kr/example.jpg',galPhotographer:'공공데이터 사진가',galContentId:'123'}]);
    expect(images[0]?.photographer).toBe('공공데이터 사진가');expect(images[0]?.contentId).toBe('123');
  });
  it('운영자와 승인된 보관·연령 정책을 공개한다',()=>{
    expect(SUPPORT_EMAIL).toBe('waboranggae.help@gmail.com');
    expect(privacyHtml()).toContain(SUPPORT_EMAIL);expect(privacyHtml()).toContain('만 14세 이상');
    expect(privacyHtml()).toContain('90일 이내');expect(privacyHtml()).toContain('최대 7일');
    expect(privacyHtml()).toContain(PRIVACY_OPERATOR_NAME);
  });
});
