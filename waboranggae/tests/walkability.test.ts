import { describe, expect, it } from 'vitest';
import {
  nearbyLinksScore,
  WALKABILITY_WEIGHTS,
  walkingEaseScore,
  weightedWalkabilityScore,
} from '../src/domain/walkability';

describe('standardized walkability score', () => {
  it('keeps every style weight at a total of 100 percent', () => {
    for (const weights of Object.values(WALKABILITY_WEIGHTS)) {
      expect(Object.values(weights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    }
  });

  it('normalizes walking burden by selected trip duration', () => {
    expect(walkingEaseScore(6, 6, 'easy')).toBe(100);
    expect(walkingEaseScore(96, 6, 'easy')).toBe(40);
  });

  it('normalizes average distance between linked stops', () => {
    expect(nearbyLinksScore(3, 3)).toBe(100);
    expect(nearbyLinksScore(18, 3)).toBe(40);
  });

  it('uses only the weighted standardized metrics for the final score', () => {
    expect(weightedWalkabilityScore({
      transitAccess: 90,
      walkingEase: 80,
      nearbyLinks: 70,
    }, 'balanced')).toBe(81);
  });
});
