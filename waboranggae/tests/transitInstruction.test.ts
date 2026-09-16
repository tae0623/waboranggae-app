import { describe, expect, it } from 'vitest';
import { routingTestUtils } from '../server/src/modules/recommendation/routing';
import {
  applyStopBasedTransitHints,
  formatTransitInstruction,
  hintTransitFromStops,} from '../server/src/modules/recommendation/transit-instruction';
import { Place } from '../src/types/travel';

describe('transit instruction', () => {
  it('writes ride minutes and stops into one sentence', () => {
    expect(formatTransitInstruction([
      { mode: 'walk', label: '도보', minutes: 5 },
      { mode: 'bus', route: '67', label: '67번 버스', minutes: 16, fromStop: '순천역', toStop: '국가정원역' },
    ])).toBe('도보 5분 → 67번 버스 16분 · 순천역 → 국가정원역');
  });

  it('estimates walking vs transit without inventing a bus number', () => {
    const walking = routingTestUtils.estimateRoute(
      { name: '순천만국가정원', latitude: 34.9289, longitude: 127.5095 },
      { name: '순천만습지', latitude: 34.925, longitude: 127.512 },
    );
    expect(walking.instruction).toMatch(/도보/);
    expect(walking.steps.every((step) => step.mode === 'walk')).toBe(true);

    const transit = routingTestUtils.estimateRoute(
      { name: '순천역', latitude: 34.9476, longitude: 127.4914 },
      { name: '낙안읍성', latitude: 34.907, longitude: 127.341 },
    );
    expect(transit.instruction).toMatch(/버스 약 \d+분/);
    expect(transit.steps.some((step) => step.mode === 'bus' && !step.route)).toBe(true);
  });

  it('fills bus numbers from shared nearby stops when directions are estimated', () => {
    const hinted = hintTransitFromStops(
      { stopName: '순천역', sampleRouteNumbers: ['67', '71', '960'] },
      { stopName: '국가정원', sampleRouteNumbers: ['67', '16'] },
      5,
      16,
    );
    expect(hinted?.instruction).toBe('도보 약 5분 → 67번 버스 약 16분 · 순천역 → 국가정원');
    expect(hinted?.steps[1]).toMatchObject({ route: '67', label: '67번 버스', minutes: 16 });
  });

  it('does not overwrite a verified Kakao instruction', () => {
    const place = {
      id: 'garden',
      name: '순천만국가정원',
      category: 'nature',
      address: '순천',
      stayMinutes: 80,
      arrival: '10:21',
      moveLabel: '도보 5분 → 67번 버스 16분 · 순천역 → 국가정원역',
      description: '',
      tags: ['nature'],
      mapPoint: { x: 0, y: 0 },
      walkMinutesFromPrevious: 5,
      transitMinutesFromPrevious: 16,
      routeSource: 'kakao',
      transitSteps: [
        { mode: 'walk', label: '도보', minutes: 5 },
        { mode: 'bus', route: '67', label: '67번 버스', minutes: 16 },
      ],
    } satisfies Place;

    expect(applyStopBasedTransitHints(
      [place],
      new Map([['garden', { stopName: '국가정원', sampleRouteNumbers: ['16'] }]]),
      { stopName: '순천역', sampleRouteNumbers: ['71'] },
    )[0]?.moveLabel).toBe(place.moveLabel);
  });
});
