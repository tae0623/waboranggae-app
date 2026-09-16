import { describe, expect, it } from 'vitest';
import { parseTravelText } from '../src/domain/demoEngine';
import { Place } from '../src/types/travel';
import {
  assignGroundedCourseTitles,
  buildCoursesFromOutlines,
  buildRulePlannedCourses,
  mealWindowsFor,
  minimumCourseDurationMinutes,
  parseClock,
  validateScheduledPlaces,
} from '../server/src/modules/recommendation/planner';
import { classifyTourItemCategory } from '../server/src/modules/recommendation/data/tour-api';

function place(id: string, category: Place['category'], latitude: number, longitude: number): Place {
  return {
    id,
    name: id,
    category,
    address: '전남 순천시 테스트로',
    stayMinutes: 60,
    arrival: '10:00',
    moveLabel: '테스트 이동',
    description: '테스트 장소',
    tags: category === 'food' ? ['food'] : category === 'cafe' ? ['cafe'] : ['nature'],
    mapPoint: { x: 0, y: 0 },
    latitude,
    longitude,
  };
}

const candidates = [
  place('정원', 'nature', 34.95, 127.49),
  place('박물관', 'history', 34.951, 127.491),
  place('남도식당', 'food', 34.952, 127.492),
  place('시장식당', 'food', 34.953, 127.493),
  place('로컬카페', 'cafe', 34.954, 127.494),
  place('정원카페', 'cafe', 34.9545, 127.4945),
  place('습지', 'nature', 34.955, 127.495),
];

function hasSameDiningCategory(a: Place['category'], b: Place['category']) {
  return (a === 'food' && b === 'food') || (a === 'cafe' && b === 'cafe');
}

describe('hybrid itinerary planner', () => {
  it('validates a second-day lunch against its own day rather than reusing first-day lunch',()=>{
    const p={...parseTravelText('순천 자연 6시간'),travelDate:'2026-10-01',travelEndDate:'2026-10-02',startTime:'10:00',endTime:'18:00',durationHours:32,mealPreference:'both' as const};
    const schedule=[
      {...candidates[0]!,id:'day1-a',arrival:'10:00',stayMinutes:90},
      {...candidates[2]!,id:'day1-lunch',arrival:'11:45'},
      {...candidates[1]!,id:'day1-b',arrival:'13:00',stayMinutes:120},
      {...candidates[3]!,id:'day1-dinner',arrival:'18:00'},
      {...candidates[0]!,id:'day1-c',arrival:'20:00',stayMinutes:120},
      {...candidates[1]!,id:'day2-a',arrival:'08:00',stayMinutes:120},
      {...candidates[2]!,id:'day2-lunch',arrival:'12:00'},
      {...candidates[0]!,id:'day2-b',arrival:'16:00',stayMinutes:120},
    ];
    expect(validateScheduledPlaces(p,schedule).filter(x=>x.includes('식사 시간'))).toEqual([]);
  });
  it('automatically reserves one lunch and prevents consecutive restaurants', () => {
    const preferences = parseTravelText('순천에서 오전 10시부터 자연과 카페를 6시간 여유롭게 보고 싶어');
    const windows = mealWindowsFor(preferences);
    const courses = buildRulePlannedCourses(preferences, candidates);

    expect(windows.map((window) => window.kind)).toEqual(['lunch']);
    expect(windows[0]?.end).toBe(13 * 60 + 30);
    expect(courses.length).toBeGreaterThan(0);
    for (const course of courses) {
      const foodIndexes = course.places
        .map((item, index) => item.category === 'food' ? index : -1)
        .filter((index) => index >= 0);
      expect(foodIndexes).toHaveLength(1);
      for (let index = 1; index < course.places.length; index += 1) {
        expect(
          hasSameDiningCategory(course.places[index - 1]!.category, course.places[index]!.category),
        ).toBe(false);
      }
      const food = course.places[foodIndexes[0]!]!;
      expect(parseClock(food.arrival)).toBeGreaterThanOrEqual(11 * 60 + 30);
      expect(parseClock(food.arrival)).toBeLessThanOrEqual(13 * 60 + 30);
      expect(course.transitMinutes).toBeGreaterThanOrEqual(25);
      expect(course.durationHours).toBeGreaterThanOrEqual(5.5);
      expect(course.durationHours).toBeLessThanOrEqual(6.4);
      const firstCafeIndex = course.places.findIndex((item) => item.category === 'cafe');
      if (firstCafeIndex >= 0) expect(course.places[firstCafeIndex - 1]?.category).toBe('food');
      expect(validateScheduledPlaces(preferences, course.places)).toEqual([]);
    }
  });

  it('repairs an LLM outline with back-to-back restaurants before validation', () => {
    const preferences = parseTravelText('순천에서 오전 11시부터 점심 맛집과 자연을 5시간 보고 싶어');
    const courses = buildCoursesFromOutlines(preferences, candidates, [{
      title: '잘못된 일정',
      placeIds: ['남도식당', '시장식당', '정원'],
      rationale: '테스트',
    }]);

    expect(courses).toHaveLength(1);
    expect(courses[0]?.places.filter((item) => item.category === 'food')).toHaveLength(1);
    expect(validateScheduledPlaces(preferences, courses[0]!.places)).toEqual([]);
    expect(courses[0]?.validationNotes).toContain('AI 순서 시간표 보정');
  });

  it('repairs repeated cafes and puts the first cafe after the meal', () => {
    const preferences = parseTravelText('순천에서 오전 10시부터 자연과 카페와 점심을 6시간 보고 싶어');
    const courses = buildCoursesFromOutlines(preferences, candidates, [{
      title: '카페가 몰린 일정',
      placeIds: ['로컬카페', '정원카페', '남도식당', '정원'],
      rationale: '테스트',
    }]);

    expect(courses).toHaveLength(1);
    expect(courses[0]?.places.filter((item) => item.category === 'cafe').length).toBeGreaterThan(0);
    expect(validateScheduledPlaces(preferences, courses[0]!.places)).toEqual([]);
    const firstCafeIndex = courses[0]!.places.findIndex((item) => item.category === 'cafe');
    expect(courses[0]!.places[firstCafeIndex - 1]?.category).toBe('food');
    for (let index = 1; index < courses[0]!.places.length; index += 1) {
      expect(
        hasSameDiningCategory(courses[0]!.places[index - 1]!.category, courses[0]!.places[index]!.category),
      ).toBe(false);
    }
  });

  it('rejects any scheduled route with adjacent cafe stops', () => {
    const preferences = parseTravelText('순천에서 오전 10시부터 자연과 카페와 점심을 6시간 보고 싶어');
    const invalid = [
      { ...candidates[0]!, arrival: '10:25' },
      { ...candidates[4]!, arrival: '11:40' },
      { ...candidates[5]!, arrival: '12:40' },
      { ...candidates[2]!, arrival: '13:40' },
    ];

    expect(validateScheduledPlaces(preferences, invalid)).toContain('카페가 연속으로 배치되었습니다.');
  });

  it('rejects a 3.5-hour itinerary when the user selected 6 hours', () => {
    const preferences = {
      ...parseTravelText('순천에서 자연을 6시간 보고 식사 없이 여행하고 싶어'),
      mealPreference: 'none' as const,
    };
    const tooShort = [
      { ...candidates[0]!, arrival: '10:25', stayMinutes: 70 },
      { ...candidates[1]!, arrival: '11:40', stayMinutes: 70 },
      { ...candidates[6]!, arrival: '12:55', stayMinutes: 40 },
    ];

    expect(minimumCourseDurationMinutes(6)).toBe(5.5 * 60);
    expect(validateScheduledPlaces(preferences, tooShort)).toContain(
      '전체 일정이 선택한 여행 시간에 비해 너무 짧습니다.',
    );
  });

  it('rejects a cafe scheduled before the meal when both are requested', () => {
    const preferences = parseTravelText('순천에서 오전 10시부터 자연과 카페와 점심을 6시간 보고 싶어');
    const invalid = [
      { ...candidates[4]!, arrival: '10:25' },
      { ...candidates[0]!, arrival: '11:30' },
      { ...candidates[2]!, arrival: '12:40' },
    ];

    expect(validateScheduledPlaces(preferences, invalid)).toContain(
      '식사가 포함된 코스의 첫 카페는 식사 다음 순서에 배치해야 합니다.',
    );
  });

  it('rejects an LLM outline containing an unknown candidate id', () => {
    const preferences = parseTravelText('순천에서 자연과 점심을 5시간 보고 싶어');
    const courses = buildCoursesFromOutlines(preferences, candidates, [{
      title: '근거 없는 일정',
      placeIds: ['정원', '존재하지않는장소'],
      rationale: '테스트',
    }]);

    expect(courses).toEqual([]);
  });

  it('never emits a one-stop itinerary', () => {
    const preferences = parseTravelText('순천에서 점심만 2시간 먹고 싶어');
    expect(buildRulePlannedCourses(preferences, [candidates[2]!])).toEqual([]);
  });

  it('distinguishes cafes from restaurants within TourAPI food content type', () => {
    expect(classifyTourItemCategory({ contenttypeid: '39', title: '카페와온' })).toBe('cafe');
    expect(classifyTourItemCategory({ contenttypeid: '39', title: '브루웍스' })).toBe('cafe');
    expect(classifyTourItemCategory({ contenttypeid: '39', title: '강변장어' })).toBe('food');
  });

  it('creates distinct grounded titles for different routes even when their old titles collide', () => {
    const preferences = parseTravelText('순천에서 자연과 사진과 점심을 6시간 보고 싶어');
    const courses = buildRulePlannedCourses(preferences, candidates);
    expect(courses.length).toBeGreaterThanOrEqual(2);
    const duplicatedTitles = courses.slice(0, 2).map((course) => ({ ...course, title: '순천 자연·사진 뚜벅이 코스 1' }));
    const titled = assignGroundedCourseTitles(preferences, duplicatedTitles);

    expect(new Set(titled.map((course) => course.title)).size).toBe(titled.length);
    expect(titled[0]?.title).toContain(preferences.city);
    expect(titled[0]?.places.some((place) => titled[0]!.title.includes(place.name))).toBe(true);
  });

  it('keeps complete representative place names without title ellipsis', () => {
    const preferences = parseTravelText('순천에서 자연과 점심을 6시간 보고 싶어');
    const courses = buildRulePlannedCourses(preferences, candidates).slice(0, 2);
    expect(courses.length).toBeGreaterThan(0);
    const fullNames = ['아주긴이름의생태문화자연관찰공원', '역사문화예술이함께하는복합문화관'];
    const titled = assignGroundedCourseTitles(preferences, courses.map(course => ({
      ...course, places: course.places.map((item, index) => ({ ...item, name: fullNames[index % 2]! })),
    })));
    for (const course of titled) {
      expect(course.title).not.toMatch(/…|\.\.\./);
      expect(fullNames.some(name => course.title.includes(name))).toBe(true);
    }
  });
  it('does not cut 시립 from the actual place name',()=>{
    const preferences=parseTravelText('순천에서 자연과 점심을 6시간 보고 싶어');
    const course=buildRulePlannedCourses(preferences,candidates)[0]!;
    const titled=assignGroundedCourseTitles(preferences,[{...course,places:[{...candidates[1]!,name:'순천시립 그림책 도서관'}]}])[0]!;
    expect(titled.title).toContain('시립 그림책 도서관');
    expect(titled.title).not.toContain('·립 ');
  });

  it('opens lunch on both days for an overnight window', () => {
    const preferences = {
      ...parseTravelText('순천에서 자연과 점심을 보고 싶어'),
      travelDate: '2026-09-24',
      travelEndDate: '2026-09-25',
      startTime: '12:00',
      endTime: '13:00',
      durationHours: 25,
      meals: ['lunch'] as Array<'lunch'>,
      mealPreference: 'lunch' as const,
    };
    expect(mealWindowsFor(preferences).map((window) => window.kind)).toEqual(['lunch', 'lunch']);
  });
});
