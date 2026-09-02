import { describe, expect, it } from 'vitest';
import {
  classifyTourItemCategory,
  distanceKm,
  filterJeonnamCityItems,
  findRequestedTourRegion,
  normalizeTourImageUrl,
  TourApiItem,
} from '../server/src/modules/recommendation/data/tour-api';

const TOUR_ITEMS: TourApiItem[] = [
  { contentid: '1', contenttypeid: '12', title: '순천만습지', addr1: '전남 순천시', mapx: '127.509', mapy: '34.885' },
  { contentid: '2', contenttypeid: '14', title: '순천 문화관', addr1: '전남 순천시', mapx: '127.512', mapy: '34.887' },
  { contentid: '3', contenttypeid: '39', title: '순천 로컬 식당', addr1: '전남 순천시', mapx: '127.515', mapy: '34.889' },
  { contentid: '4', contenttypeid: '38', title: '순천 전통시장', addr1: '전남 순천시', mapx: '127.518', mapy: '34.891' },
];

describe('TourAPI normalization', () => {
  it('classifies public tourism content with the runtime provider rules', () => {
    expect(TOUR_ITEMS.map(classifyTourItemCategory)).toEqual([
      'nature', 'history', 'food', 'market',
    ]);
  });

  it('calculates coordinate distance without calling an external API', () => {
    const distance = distanceKm(
      { latitude: 34.885, longitude: 127.509 },
      { latitude: 34.887, longitude: 127.512 },
    );
    expect(distance).toBeGreaterThan(0.2);
    expect(distance).toBeLessThan(0.5);
  });

  it('uses the 2026 integrated legal-dong region for a Jeonnam request', () => {
    const region = findRequestedTourRegion([
      { name: '서울특별시', code: '11' },
      { name: '전남광주통합특별시', code: '12' },
    ], '전라남도');

    expect(region?.code).toBe('12');
  });

  it('removes Gwangju districts from the Jeonnam city list', () => {
    const cities = filterJeonnamCityItems([
      { name: '순천시', code: '150' },
      { name: '동구', code: '210' },
      { name: '신안군', code: '870' },
    ]);

    expect(cities).toEqual([
      { name: '순천', code: '150' },
      { name: '신안', code: '870' },
    ]);
  });

  it('keeps the original TourAPI image URL for the server-side proxy', () => {
    expect(normalizeTourImageUrl('http://tong.visitkorea.or.kr/example.jpg'))
      .toBe('http://tong.visitkorea.or.kr/example.jpg');
    expect(normalizeTourImageUrl('https://tong.visitkorea.or.kr/example.jpg'))
      .toBe('https://tong.visitkorea.or.kr/example.jpg');
    expect(normalizeTourImageUrl('not-a-url')).toBeUndefined();
  });
});
