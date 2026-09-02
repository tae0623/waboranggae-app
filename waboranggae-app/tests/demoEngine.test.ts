import { describe, expect, it } from 'vitest';
import { parseTravelText, rankCourses } from '../src/domain/demoEngine';
import {
  applyExplicitTravelSignals,
  parseTravelText as parseServerTravelText,
} from '../server/src/modules/analysis/parser';
import { normalizeTravelStart } from '../src/domain/startLocation';

describe('natural-language travel parser', () => {
  it('extracts walking, interest, start, and luggage conditions from Korean', () => {
    const result = parseTravelText('순천역에서 많이 걷지 않고 정원과 맛집을 보고 싶어요.');

    expect(result.city).toBe('순천');
    expect(result.startLocation).toBe('순천역');
    expect(result.startType).toBe('station');
    expect(result.pace).toBe('easy');
    expect(result.interests).toEqual(expect.arrayContaining(['nature', 'food']));
    expect(result.publicTransportOnly).toBe(true);
    expect(result.startTime).toBe('10:00');
  });

  it('recognizes a compact history and market request', () => {
    const result = parseTravelText('목포역에서 역사와 전통시장을 알차게 5시간 보고 싶어');

    expect(result.city).toBe('목포');
    expect(result.durationHours).toBe(5);
    expect(result.pace).toBe('full');
    expect(result.interests).toEqual(expect.arrayContaining(['history', 'market']));
  });

  it('extracts a start time and explicit meal schedule', () => {
    const result = parseTravelText('여수에서 오후 1시에 시작해서 8시간 동안 저녁 맛집과 바다를 보고 싶어');

    expect(result.startTime).toBe('13:00');
    expect(result.durationHours).toBe(8);
    expect(result.mealPreference).toBe('dinner');
  });

  it('keeps a terminal request consistent even when the facility name is omitted', () => {
    const clientResult = parseTravelText('순천 터미널에서 오전 10시에 여행을 시작하고 싶어');
    const serverResult = parseServerTravelText('순천 터미널에서 오전 10시에 여행을 시작하고 싶어');

    expect(clientResult.startType).toBe('terminal');
    expect(clientResult.startLocation).toBe('순천 터미널');
    expect(serverResult.startType).toBe('terminal');
    expect(serverResult.startLocation).toBe('순천 터미널');
  });

  it('repairs an inconsistent AI start location and adapts demo courses', () => {
    const inconsistent = { ...parseTravelText('순천에서 여행하고 싶어'), startType: 'terminal' as const, startLocation: '순천역' };
    const normalized = normalizeTravelStart(inconsistent);
    const courses = rankCourses(normalized);

    expect(normalized.startLocation).toBe('순천 터미널');
    expect(courses[0]?.origin?.name).toBe('순천 터미널');
    expect(courses[0]?.origin?.longitude).toBeCloseTo(127.4913557);
    expect(courses[0]?.places[0]?.category).not.toBe('station');
  });

  it('uses a named port as a custom start in a region without a rail station', () => {
    const clientResult = parseTravelText('완도항에서 바다와 시장을 5시간 보고 싶어');
    const serverResult = parseServerTravelText('완도항에서 바다와 시장을 5시간 보고 싶어');

    expect(clientResult.startType).toBe('custom');
    expect(clientResult.startLocation).toBe('완도항');
    expect(serverResult.startType).toBe('custom');
    expect(serverResult.startLocation).toBe('완도항');
  });

  it('keeps explicit user signals when the LLM returns conflicting conditions', () => {
    const aiResult = {
      ...parseServerTravelText('순천역에서 자연을 여유롭게 보고 싶어'),
      city: '완도',
      startType: 'terminal' as const,
      startLocation: '완도 터미널',
      pace: 'balanced' as const,
      mealPreference: 'auto' as const,
      interests: ['nature' as const],
      durationHours: 6,
    };
    const result = applyExplicitTravelSignals('완도항에서 바다와 시장을 알차게 5시간 보고 점심도 먹고 싶어', aiResult);

    expect(result.startType).toBe('custom');
    expect(result.startLocation).toBe('완도항');
    expect(result.pace).toBe('full');
    expect(result.durationHours).toBe(5);
    expect(result.mealPreference).toBe('lunch');
    expect(result.interests).toEqual(expect.arrayContaining(['nature', 'market', 'food']));
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
