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
  let total = 0;
  for (let elapsed = 0; elapsed < wall; elapsed += 15) {
    const tod = ((origin + elapsed) % 1_440 + 1_440) % 1_440;
    if (tod >= 22 * 60 || tod < 8 * 60) continue;
    total += 15;
  }
  return Math.max(60, total);
}

export function wallClockHours(...args: Parameters<typeof wallClockMinutes>) {
  return Math.round(wallClockMinutes(...args) / 6) / 10;
}

export function touringHours(...args: Parameters<typeof touringMinutes>) {
  return Math.max(1, Math.round(touringMinutes(...args) / 6) / 10);
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
  if (meals?.length) return [...new Set(meals)];
  if (mealPreference === 'none') return [];
  if (mealPreference === 'lunch') return ['lunch'];
  if (mealPreference === 'dinner') return ['dinner'];
  if (mealPreference === 'both') return ['lunch', 'dinner'];
  return ['lunch', 'dinner'];
}

export function wantsMeals(
  mealPreference: 'auto' | 'none' | 'lunch' | 'dinner' | 'both',
  meals?: MealKind[],
) {
  return mealsFromPreference(mealPreference, meals).length > 0;
}

export function planningHours(preferences: {
  travelDate: string | null;
  travelEndDate?: string | null;
  startTime: string;
  endTime?: string;
  durationHours: number;
}) {
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
  travelDate: string | null;
  travelEndDate?: string | null;
  startTime: string;
  endTime?: string;
  durationHours: number;
}) {
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
