import { describe, expect, it } from 'vitest';
import { categoryFromKakao, isAddressQuery, cityFromAddress } from '../server/src/modules/places/search';

describe('departure place search', () => {
  it('prefers a destination city over the administrative province prefix',()=>{
    expect(cityFromAddress('전남광주통합특별시 순천시 장천3길 13')).toBe('순천');
    expect(cityFromAddress('전남 나주시 나주로 192')).toBe('나주');
    expect(cityFromAddress('전라남도 담양군 담양읍 중앙로 1')).toBe('담양');
    expect(cityFromAddress('광주광역시 서구 무진대로 904')).toBe('광주');
  });
  it('treats street addresses as address queries', () => {
    expect(isAddressQuery('전남 순천시 국가정원1호길 47')).toBe(true);
    expect(isAddressQuery('순천시 오천동 1')).toBe(true);
  });

  it('treats food keywords as place queries', () => {
    expect(isAddressQuery('삼겹살')).toBe(false);
    expect(isAddressQuery('죽녹원')).toBe(false);
  });

  it('uses the last Kakao category as the chip label', () => {
    expect(categoryFromKakao('음식점 > 한식 > 육류,고기 > 삼겹살')).toBe('삼겹살');
  });
});
