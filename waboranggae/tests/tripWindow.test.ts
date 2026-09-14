import { describe, expect, it } from 'vitest';
import {
  isOvernightTrip,
  lodgingProximityScore,
  skipNightClock,
  touringHours,
  wallClockHours,
  wallClockMinutes,
} from '../src/domain/tripWindow';

describe('trip window', () => {
  it('counts a same-day 10:00–16:00 trip as six hours', () => {
    expect(wallClockHours('2026-09-24', '10:00', '2026-09-24', '16:00')).toBe(6);
    expect(touringHours('2026-09-24', '10:00', '2026-09-24', '16:00')).toBe(6);
    expect(isOvernightTrip('2026-09-24', '2026-09-24')).toBe(false);
  });

  it('keeps overnight tours inside daytime hours', () => {
    expect(wallClockMinutes('2026-09-24', '12:00', '2026-09-25', '13:00')).toBe(25 * 60);
    expect(touringHours('2026-09-24', '12:00', '2026-09-25', '13:00')).toBeGreaterThan(12);
    expect(touringHours('2026-09-24', '12:00', '2026-09-25', '13:00')).toBeLessThan(18);
    expect(skipNightClock(22 * 60 + 10, 12 * 60)).toBe(24 * 60 + 8 * 60);
  });

  it('scores lodging proximity higher when places are close', () => {
    expect(lodgingProximityScore(0.4)).toBe(100);
    expect(lodgingProximityScore(1.5)).toBeGreaterThan(lodgingProximityScore(6));
  });
});
