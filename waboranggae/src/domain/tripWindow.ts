import type { TravelPreferences } from '../types/travel';
export function clockMinutes(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return 10 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function dayIndex(ymd: string) {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

export function wallClockMinutes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
) {
  const days = dayIndex(endDate) - dayIndex(startDate);
  return Math.max(30, days * 1_440 + clockMinutes(endTime) - clockMinutes(startTime));
}

export function touringMinutes(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
) {
  const wall = wallClockMinutes(startDate, startTime, endDate, endTime);
  const origin = clockMinutes(startTime);
  if (startDate === endDate) return wall;
  let total = 0;
  const finish = origin + wall;
  for (let day = 0; day * 1440 < finish; day++) {
    total += Math.max(0, Math.min(finish, day * 1440 + 22 * 60) - Math.max(origin, day * 1440 + 8 * 60));
  }
  return total;
}

export function wallClockHours(...args: Parameters<typeof wallClockMinutes>) {
  return Math.round(wallClockMinutes(...args) / 6) / 10;
}

export function touringHours(...args: Parameters<typeof touringMinutes>) {
  return touringMinutes(...args) / 60;
}

export function isOvernightTrip(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && startDate !== endDate);
}

/** 22:00–08:00은 숙소 체류로 보고 일정을 다음 날 아침으로 넘깁니다. */
export function skipNightClock(clock: number, tripStart: number) {
  if (clock <= tripStart) return clock;
  const dayStart = Math.floor(clock / 1_440) * 1_440;
  const tod = clock - dayStart;
  if (tod >= 22 * 60) return dayStart + 1_440 + 8 * 60;
  if (tod < 8 * 60) return dayStart + 8 * 60;
  return clock;
}

/** 자정을 넘긴 시각 문자열을 이전 시각 기준으로 이어 붙입니다. */
export function unfoldClock(previous: number, clockOfDay: number) {
  const ofDay = ((clockOfDay % 1_440) + 1_440) % 1_440;
  let next = Math.floor(previous / 1_440) * 1_440 + ofDay;
  if (next + 180 < previous) next += 1_440;
  return next;
}

export function distanceKmBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** 숙소에서 평균 거리가 가까울수록 뚜벅이 동선 점수를 올립니다. */
export function lodgingProximityScore(averageKm: number) {
  if (averageKm <= 0.8) return 100;
  if (averageKm >= 8) return 40;
  return Math.round(100 - (averageKm - 0.8) / 7.2 * 60);
}

export type MealKind = 'breakfast' | 'lunch' | 'dinner';

export function mealsFromPreference(
  mealPreference: 'auto' | 'none' | 'lunch' | 'dinner' | 'both',
  meals?: MealKind[],
): MealKind[] {
  if (meals !== undefined) return [...new Set(meals)];
  if (mealPreference === 'none') return [];
  if (mealPreference === 'lunch') return ['lunch'];
  if (mealPreference === 'dinner') return ['dinner'];
  if (mealPreference === 'both') return ['lunch', 'dinner'];
  return ['breakfast', 'lunch', 'dinner'];
}

export function wantsMeals(
  mealPreference: 'auto' | 'none' | 'lunch' | 'dinner' | 'both',
  meals?: MealKind[],
) {
  return mealsFromPreference(mealPreference, meals).length > 0;
}

export function planningHours(preferences: {
  scheduleMode?: 'fixed' | 'course-first';
  pace?: string;
  travelDate: string | null;
  travelEndDate?: string | null;
  startTime: string;
  endTime?: string;
  durationHours: number;
}) {
  if(preferences.scheduleMode==='course-first'){
    const suggested=preferences.pace==='easy'?4.5:preferences.pace==='full'?7.5:6;
    const available=(clockMinutes(preferences.endTime || '23:59')-clockMinutes(preferences.startTime))/60;
    return Math.max(0.5,Math.min(suggested,available));
  }
  if (preferences.travelDate && preferences.travelEndDate && preferences.endTime) {
    return touringHours(
      preferences.travelDate,
      preferences.startTime,
      preferences.travelEndDate,
      preferences.endTime,
    );
  }
  return preferences.durationHours;
}

export function wallLimitMinutes(preferences: {
  scheduleMode?: 'fixed' | 'course-first';
  travelDate: string | null;
  travelEndDate?: string | null;
  startTime: string;
  endTime?: string;
  durationHours: number;
}) {
  if(preferences.scheduleMode==='course-first')return Math.max(0,clockMinutes(preferences.endTime || '23:59')-clockMinutes(preferences.startTime));
  if (preferences.travelDate && preferences.travelEndDate && preferences.endTime) {
    return wallClockMinutes(
      preferences.travelDate,
      preferences.startTime,
      preferences.travelEndDate,
      preferences.endTime,
    );
  }
  return preferences.durationHours * 60;
}

export interface MealWindow {
  kind: 'breakfast' | 'lunch' | 'dinner';
  label: string;
  start: number;
  end: number;
}

const MEAL_WINDOWS: Record<MealWindow['kind'], MealWindow> = {
  breakfast: { kind: 'breakfast', label: '아침', start: 8 * 60, end: 9 * 60 + 30 },
  lunch: { kind: 'lunch', label: '점심', start: 11 * 60 + 30, end: 13 * 60 + 30 },
  dinner: { kind: 'dinner', label: '저녁', start: 17 * 60 + 30, end: 19 * 60 + 30 },
};

function overlapsTrip(window: MealWindow, start: number, end: number) {
  // Match the native selection and the scheduler's 60-minute minimum meal stay.
  const arrival = Math.max(start, window.start);
  return arrival <= window.end && arrival + 60 <= end;
}

function requestedKinds(preferences: TravelPreferences): MealWindow['kind'][] {
  return mealsFromPreference(preferences.mealPreference, preferences.meals);
}

export function tripEndClock(preferences: TravelPreferences) {
  if(preferences.scheduleMode==='course-first')return clockMinutes(preferences.endTime || '23:59');
  if (preferences.travelDate && preferences.travelEndDate && preferences.endTime) {
    return clockMinutes(preferences.startTime) + wallClockMinutes(
      preferences.travelDate,
      preferences.startTime,
      preferences.travelEndDate,
      preferences.endTime,
    );
  }
  return clockMinutes(preferences.startTime) + preferences.durationHours * 60;
}

export function mealWindowsFor(preferences: TravelPreferences): MealWindow[] {
  if (preferences.mealPreference === 'none' && !preferences.meals?.length) return [];
  const start = clockMinutes(preferences.startTime);
  const automatic = preferences.mealPreference === 'auto' && preferences.meals === undefined;
  const end = preferences.scheduleMode==='course-first' && automatic
    ? Math.min(tripEndClock(preferences),start+planningHours(preferences)*60) : tripEndClock(preferences);
  const kinds = requestedKinds(preferences);
  const windows: MealWindow[] = [];
  for (let dayStart = 0; dayStart < end; dayStart += 1_440) {
    for (const kind of kinds) {
      const base = MEAL_WINDOWS[kind];
      const window = {
        ...base,
        start: base.start + dayStart,
        end: base.end + dayStart,
      };
      // Automatic meals leave room for the initial local transfer; explicit choices remain strict.
      const earliest = automatic ? start + 25 : start;
      if (overlapsTrip(window, earliest, end)) windows.push(window);
      if (windows.length >= 10) return windows;
    }
  }
  return windows;
}
