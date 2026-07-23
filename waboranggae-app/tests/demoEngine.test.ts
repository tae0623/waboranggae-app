import { describe, expect, it } from 'vitest';
import { parseTravelText, rankCourses } from '../src/domain/demoEngine';

describe('natural-language travel parser', () => {
  it('extracts walking, interest, start, and luggage conditions from Korean', () => {
    const result = parseTravelText('순천역에서 많이 걷지 않고 정원과 맛집을 보고 싶어요. 캐리어도 맡겨야 해요.');

    expect(result.city).toBe('순천');
    expect(result.startLocation).toBe('순천역');
    expect(result.startType).toBe('station');
    expect(result.pace).toBe('easy');
    expect(result.interests).toEqual(expect.arrayContaining(['nature', 'food']));
    expect(result.wantsLuggageStorage).toBe(true);
    expect(result.publicTransportOnly).toBe(true);
  });

  it('recognizes a compact history and market request', () => {
    const result = parseTravelText('목포역에서 역사와 전통시장을 알차게 5시간 보고 싶어');

    expect(result.city).toBe('목포');
    expect(result.durationHours).toBe(5);
    expect(result.pace).toBe('full');
    expect(result.interests).toEqual(expect.arrayContaining(['history', 'market']));
  });

  it('uses the correct Korean object particle in the summary', () => {
    const result = parseTravelText('여수에서 바다 사진을 알차게 보고 싶어');
    expect(result.summary).toContain('사진을 즐기는');
  });
});

describe('walkability ranking', () => {
  it('ranks the requested city first and returns grounded evidence', () => {
    const preferences = parseTravelText('여수엑스포역에서 바다 사진과 카페 위주로 여행하고 싶어요');
    const courses = rankCourses(preferences);

    expect(courses[0]?.city).toBe('여수');
    expect(courses[0]?.fitScore).toBeGreaterThan(80);
    expect(courses[0]?.reason.evidence.join(' ')).toContain('대중교통 접근성');
    expect(courses[0]?.reason.evidence.join(' ')).toContain('도보 부담도');
  });
});
