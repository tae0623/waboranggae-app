import { describe, expect, it } from 'vitest';
import { buildLeafletHtml } from '../src/domain/mapHtml';
import { RankedCourse } from '../src/types/travel';

const from = { name: '순천 터미널', latitude: 34.9475959, longitude: 127.4913557 };
const to = { name: '순천만국가정원', latitude: 34.9289, longitude: 127.5095 };

describe('directions integration', () => {
  it('renders the selected terminal as a separate origin marker and starts the route there', () => {
    const course = {
      id: 'test', city: '순천', title: '터미널 출발 코스', subtitle: '', accent: '#0D5C45', softAccent: '#DDF3A7',
      durationHours: 6, distanceKm: 4.1, walkMinutes: 5, transitMinutes: 16,
      metrics: { transitAccess: 90, walkingEase: 90, nearbyLinks: 80 },
      places: [{
        id: 'garden', name: '순천만국가정원', category: 'nature', address: '순천시', stayMinutes: 90,
        arrival: '10:21', moveLabel: '버스 21분', description: '정원 산책과 자연 경관을 즐기는 장소', tags: ['nature'], mapPoint: { x: 100, y: 100 },
        latitude: to.latitude, longitude: to.longitude, imageUrl: 'https://tong.visitkorea.or.kr/test/garden.jpg',
      }],
      conveniences: [], fitScore: 95, walkingScore: 90, preferenceScore: 94, timeFitScore: 92, courseQualityScore: 88,
      scoreBreakdown: { transitAccess: 90, walkingEase: 90, nearbyLinks: 80 },
      walkingBreakdown: { walk: 90, transit: 88, time: 80, transfer: 100, distance: 85, efficiency: 82 },
      recommendationBreakdown: { preference: 94, walking: 90, timeFit: 92, courseQuality: 88 },
      scoreFacts: { walkMinutes: 5, transitMinutes: 16, moveMinutes: 21, stayMinutes: 90, tripMinutes: 111, transferCount: 0, distanceKm: 4.1, averageMoveMinutes: 21, stayRatio: 0.81, averageStopDistanceMeters: null },
      constraintPassed: true, constraintViolations: [],
      matchedInterests: ['nature'], reason: { headline: '', summary: '', evidence: [], source: 'rules' },
      origin: { ...from, address: '순천종합버스터미널', source: 'nominatim' },
      routeSource: 'kakao',
      routeSegments: [{
        fromName: from.name, toName: to.name, distanceKm: 4.1, totalMinutes: 21, walkMinutes: 5,
        transitMinutes: 16, modeLabel: '도보·버스', instruction: '도보 5분 → 67번 버스 16분',
        steps: [{ mode: 'walk', label: '도보', minutes: 5 }, { mode: 'bus', route: '67', label: '67번 버스', minutes: 16, fromStop: '순천역', toStop: '국가정원역' }],
        source: 'kakao', geometry: [from, to],
      }],
    } satisfies RankedCourse;
    const html = buildLeafletHtml(course);

    expect(html).toContain('출발 · 순천 터미널');
    expect(html).toContain('34.9475959');
    expect(html).toContain('카카오 조회 구간 경로');
    expect(html?.indexOf('34.9475959')).toBeLessThan(html?.indexOf('34.9289') ?? 0);
    expect(html).not.toContain('순천역');
    expect(html).toContain('https://tong.visitkorea.or.kr/test/garden.jpg');
    expect(html).toContain("img.alt=p.name+' 관광 이미지'");
    expect(html).toContain("marker.on('mouseover',keepOpen)");
    expect(html).toContain("img.loading='eager'");
    expect(html).toContain("popup.addEventListener('mouseenter'");
    expect(html).toContain('정원 산책과 자연 경관을 즐기는 장소');
  });
});
