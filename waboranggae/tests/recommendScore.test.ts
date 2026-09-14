import { describe, expect, it } from 'vitest';
import { COURSES } from '../src/data/courses';
import { parseTravelText, rankCourses } from '../src/domain/demoEngine';
import {
  FINAL_SCORE_WEIGHTS,
  WALKING_SCORE_WEIGHTS,
  evaluateCourse,
  finalRecommendationScore,
  hardConstraintViolations,
  placePreferenceScore,
  preferenceScore,
  walkingScore,
} from '../src/domain/recommendScore';
import { Course, TravelPreferences } from '../src/types/travel';

function preferences(overrides: Partial<TravelPreferences> = {}): TravelPreferences {
  return {
    region: '전라남도',
    city: '순천',
    startLocation: '순천역',
    startType: 'station',
    travelDate: null,
    startTime: '10:00',
    durationHours: 6,
    mealPreference: 'lunch',
    pace: 'easy',
    preferLocal: false,
    interests: ['nature', 'photo'],
    companions: '혼자',
    lowMobility: false,
    publicTransportOnly: true,
    summary: '테스트',
    confidence: 0.8,
    ...overrides,
  };
}

function course(overrides: Partial<Course> = {}): Course {
  return {
    ...COURSES[0]!,
    id: 'test-course',
    walkMinutes: 30,
    transitMinutes: 20,
    durationHours: 6,
    distanceKm: 4,
    ...overrides,
  };
}

describe('recommendation scoring', () => {
  it('keeps final and walking weights at 100 percent', () => {
    expect(Object.values(FINAL_SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(Object.values(WALKING_SCORE_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
  });

  it('drops a long-walk course before scoring when the user asked to walk less', () => {
    const facts = {
      walkMinutes: 85,
      transitMinutes: 20,
      moveMinutes: 105,
      stayMinutes: 240,
      tripMinutes: 345,
      transferCount: 1,
      distanceKm: 6,
      averageMoveMinutes: 20,
      stayRatio: 0.7,
      averageStopDistanceMeters: 180,
    };
    expect(hardConstraintViolations(preferences({ pace: 'easy' }), facts).join(' ')).toContain('도보');
    expect(hardConstraintViolations(preferences({ pace: 'full' }), facts)).toEqual([]);
  });

  it('gives the same walk time a higher walking score to a user who wants more walking', () => {
    const target = course({ walkMinutes: 70, transitMinutes: 15, durationHours: 8 });
    const easy = evaluateCourse(preferences({ pace: 'easy' }), target);
    const full = evaluateCourse(preferences({ pace: 'full' }), target);
    expect(easy.constraintPassed).toBe(false);
    expect(full.constraintPassed).toBe(true);
    expect(full.walkingBreakdown.walk).toBeGreaterThan(easy.walkingBreakdown.walk);
  });

  it('prefers a nature-photo course over a food-heavy course for a nature-photo user', () => {
    const user = preferences({ interests: ['nature', 'photo'] });
    const naturePlace = { category: 'nature' as const, tags: ['nature', 'photo'] as const };
    const foodPlace = { category: 'food' as const, tags: ['food'] as const };
    expect(placePreferenceScore(naturePlace, user)).toBeGreaterThan(placePreferenceScore(foodPlace, user));

    const natureCourse = course({
      id: 'nature-course',
      places: COURSES[0]!.places.map((place, index) => (
        index === 1 ? { ...place, category: 'nature', tags: ['nature', 'photo'] } : place
      )),
    });
    const foodCourse = course({
      id: 'food-course',
      places: COURSES[0]!.places.map((place) => ({ ...place, category: 'food', tags: ['food'] })),
    });
    expect(preferenceScore(user, natureCourse)).toBeGreaterThan(preferenceScore(user, foodCourse));
  });

  it('combines preference and walking instead of using walkability alone', () => {
    const scored = evaluateCourse(preferences(), course({ walkMinutes: 25, transitMinutes: 18 }));
    expect(scored.fitScore).toBe(finalRecommendationScore(scored.recommendationBreakdown));
    expect(scored.walkingScore).toBe(walkingScore(scored.walkingBreakdown));
    expect(scored.fitScore).not.toBe(scored.walkingScore);
    expect(scored.reason.evidence.join(' ')).toContain('취향 적합도');
    expect(scored.reason.summary).toContain('총 도보');
  });

  it('hides failing courses when a valid candidate remains', () => {
    const user = parseTravelText('순천역에서 많이 걷지 않고 정원과 맛집을 보고 싶어요.');
    const longWalk = course({ id: 'too-long', city: '순천', walkMinutes: 90, places: COURSES[0]!.places });
    const ranked = rankCourses(user, [longWalk, COURSES[0]!]);
    expect(ranked.every((item) => item.walkMinutes <= 60)).toBe(true);
    expect(ranked[0]?.city).toBe('순천');
  });
});
