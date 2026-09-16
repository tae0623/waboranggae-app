import { describe, expect, it } from 'vitest';
import { categoryFromKakao, isAddressQuery } from '../server/src/modules/places/search';

describe('departure place search', () => {
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
