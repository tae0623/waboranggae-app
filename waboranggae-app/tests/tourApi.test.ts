import { describe, expect, it } from 'vitest';
import { parseTravelText } from '../src/domain/demoEngine';
import { distanceKm, tourItemsToCourses, TourApiItem } from '../server/providers/tourApi';

const TOUR_ITEMS: TourApiItem[] = [
  { contentid: '1', contenttypeid: '12', title: '순천만습지', addr1: '전남 순천시', mapx: '127.509', mapy: '34.885' },
  { contentid: '2', contenttypeid: '14', title: '순천 문화관', addr1: '전남 순천시', mapx: '127.512', mapy: '34.887' },
  { contentid: '3', contenttypeid: '39', title: '순천 로컬 식당', addr1: '전남 순천시', mapx: '127.515', mapy: '34.889' },
  { contentid: '4', contenttypeid: '38', title: '순천 전통시장', addr1: '전남 순천시', mapx: '127.518', mapy: '34.891' },
];

describe('TourAPI normalization', () => {
  it('converts public tourism items into the app course model', () => {
    const preferences = parseTravelText('순천에서 자연과 맛집 위주로 6시간 여행하고 싶어요.');
    const courses = tourItemsToCourses(TOUR_ITEMS, preferences);

    expect(courses).toHaveLength(1);
    expect(courses[0]?.city).toBe('순천');
    expect(courses[0]?.title).toContain('순천');
    expect(courses[0]?.places).toHaveLength(4);
    expect(courses[0]?.places.map((place) => place.name)).toContain('순천만습지');
    expect(courses[0]?.subtitle).toContain('한국관광공사');
  });

  it('calculates coordinate distance without calling an external API', () => {
    const distance = distanceKm(
      { latitude: 34.885, longitude: 127.509 },
      { latitude: 34.887, longitude: 127.512 },
    );
    expect(distance).toBeGreaterThan(0.2);
    expect(distance).toBeLessThan(0.5);
  });
});

