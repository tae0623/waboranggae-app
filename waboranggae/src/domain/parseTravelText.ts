import { INTEREST_LABELS, PACE_LABELS } from './labels';
import { JEONNAM_CITIES_BY_LENGTH } from './jeonnamCities';
import { normalizeStartLocation } from './startLocation';
import { explicitTripTiming, wordSignals } from './travelInput';
import {
  Interest,
  MealPreference,
  Pace,
  StartLocationType,
  TravelPreferences,
} from '../types/travel';

const INTEREST_KEYWORDS: Record<Interest, string[]> = {
  nature: ['자연', '정원', '바다', '숲', '풍경', '산책'],
  food: ['맛집', '음식', '먹거리', '미식', '밥', '해산물', '먹고', '먹고 싶'],
  cafe: ['카페', '커피', '디저트', '쉬고'],
  photo: ['사진', '포토', '인생샷', '풍경'],
  market: ['시장', '로컬', '전통시장'],
  history: ['역사', '문화유산', '박물관', '근대'],
};

export const DEFAULT_QUERY =
  '순천역에서 시작해서 많이 걷지 않고 정원, 맛집, 카페를 여유롭게 보고 싶어요.';

function inferMealPreference(text: string): MealPreference {
  if (/밥\s*먹고\s*(?:출발|시작)/.test(text) || wordSignals(text,['식사','밥','맛집']).negative) return 'none';
  const lunch = wordSignals(text,['점심']).positive;
  const dinner = wordSignals(text,['저녁','석식']).positive;
  if (lunch && dinner) return 'both';
  if (lunch) return 'lunch';
  if (dinner) return 'dinner';
  return 'auto';
}

function withObjectParticle(value: string) {
  const lastCode = value.charCodeAt(value.length - 1);
  const isHangulSyllable = lastCode >= 0xac00 && lastCode <= 0xd7a3;
  const hasBatchim = isHangulSyllable && (lastCode - 0xac00) % 28 !== 0;
  return `${value}${hasBatchim ? '을' : '를'}`;
}

/** 규칙 기반 자연어 → TravelPreferences (클라이언트·서버 공통) */
export function parseTravelText(text: string, now = new Date()): TravelPreferences {
  const normalized = text.trim();
  const city = JEONNAM_CITIES_BY_LENGTH.find((name) => wordSignals(normalized,[name]).positive) ?? '순천';
  const startMatches = [...normalized.matchAll(/([가-힣A-Za-z0-9]*(?:터미널|정류장|선착장|숙소|역|항))(?=에서|부터|은|는|말고|\s|$|[,.!])/g)];
  const startMatch = startMatches.find(m=>!/^\s*(?:은|는|이|가)?\s*(?:말고|제외|아니)/.test(normalized.slice(m.index!+m[0].length)));

  const easyPattern = /많이\s*걷지|적게\s*걷|천천히|여유|무릎|아이|부모님|휠체어|유모차/;
  const fullPattern = /많이 보|알차게|빽빽|최대한/;
  const pace: Pace = easyPattern.test(normalized)
    ? 'easy'
    : fullPattern.test(normalized)
      ? 'full'
      : 'balanced';

  const signals = interestSignals(normalized);
  const interests = signals.positive;

  const mealPreference = inferMealPreference(normalized);
  const resolvedInterests: Interest[] = (interests.length ? interests : ['nature', 'food'] as Interest[]).filter(i=>!signals.excluded.includes(i) && !(i==='food' && mealPreference==='none'));
  if (mealPreference !== 'auto' && mealPreference !== 'none' && !resolvedInterests.includes('food')) {
    resolvedInterests.push('food');
  }
  const lowMobility = /무릎|휠체어|유모차|부모님|아이|오르막.*피/.test(normalized);
  const companions = /아이|아기|유모차/.test(normalized)
    ? '아이와 함께'
    : /부모님|어르신/.test(normalized)
      ? '부모님과 함께'
      : /혼자|혼행/.test(normalized)
        ? '혼자'
        : /친구/.test(normalized)
          ? '친구와 함께'
          : '동행 미지정';

  const labels = resolvedInterests.slice(0, 3).map((item) => INTEREST_LABELS[item]);

  const startText = startMatch?.[1] || normalized;
  const startType: StartLocationType = /현재\s*위치/.test(normalized) ? 'current' : /여객터미널|선착장|항$/.test(startText)
    ? 'custom'
    : /터미널/.test(startText)
    ? 'terminal'
    : /숙소|호텔|펜션/.test(normalized)
      ? 'lodging'
      : /(?:역)(?:에서|\s|$)/.test(startMatch?.[1] || '')
        ? 'station'
        : startMatch
          ? 'custom'
          : 'station';
  const startLocation = normalizeStartLocation(city, startType, startMatch?.[1]);

  return {
    region: '전라남도',
    city,
    startLocation,
    startType,
    ...explicitTripTiming(normalized,now),
    mealPreference,
    pace,
    preferLocal: /로컬|골목|전통|시장/.test(normalized),
    interests: resolvedInterests,
    companions,
    lowMobility,
    publicTransportOnly: !wordSignals(normalized,['자가용','렌터카','렌트카']).positive,
    summary: `${startLocation}에서 ${withObjectParticle(labels.join('·'))} 즐기는 ${PACE_LABELS[pace]} 뚜벅이 여행`,
    confidence: normalized.length > 18 ? 0.91 : 0.76,
  };
}

/** LLM이 명시된 출발지·시간·식사·여행 강도를 바꾸지 못하도록 결정적 신호를 덮어씁니다. */
export function applyExplicitTravelSignals(text: string, ai: TravelPreferences, now = new Date()): TravelPreferences {
  const normalized = text.trim();
  const rules = parseTravelText(normalized,now);
  const explicitCity = JEONNAM_CITIES_BY_LENGTH.some(city=>normalized.includes(city));
  const explicitStart = /(?:역|터미널|정류장|선착장|항|숙소|현재\s*위치)(?=에서|부터|은|는|말고|\s|$|[,.!])/.test(normalized);
  const explicitPace = /많이\s*걷지|적게\s*걷|천천히|여유|무릎|아이|부모님|많이 보|알차게|빽빽|최대한|휠체어|유모차/.test(normalized);
  const explicitMeal = /점심|저녁|석식|식사|맛집|밥|먹고|먹고 싶/.test(normalized);
  const signals = interestSignals(normalized);
  const explicitInterests = signals.positive;
  if (explicitMeal && rules.mealPreference !== 'none' && !explicitInterests.includes('food')) {
    explicitInterests.push('food');
  }

  // Text analysis cannot establish geographic provenance. Keep selected UI coordinates in
  // /recommend requests, but never return model-generated coordinates/addresses from /analyze.
  const { startAddress, startLatitude, startLongitude, lodgingName, lodgingAddress, lodgingLatitude, lodgingLongitude,
    travelDate, travelEndDate, endTime, meals, preferredTransit, ...safeAi } = ai;
  const mealPreference = explicitMeal ? rules.mealPreference : ai.mealPreference;
  const interests = [...new Set(explicitInterests.length ? explicitInterests : ai.interests)]
    .filter(i=>!signals.excluded.includes(i) && !(i==='food' && mealPreference==='none'));
  const result: TravelPreferences = {
    ...safeAi,
    region: '전라남도',
    city: explicitCity || !JEONNAM_CITIES_BY_LENGTH.includes(ai.city) ? rules.city : ai.city,
    ...explicitTripTiming(normalized,now),
    ...(explicitStart || !normalized.includes(ai.startLocation)
      ? { startType: rules.startType, startLocation: rules.startLocation } : {}),
    ...(explicitPace ? { pace: rules.pace, lowMobility: rules.lowMobility } : {}),
    mealPreference,
    meals: mealPreference==='none' ? [] : mealPreference==='lunch' ? ['lunch'] : mealPreference==='dinner' ? ['dinner'] : mealPreference==='both' ? ['lunch','dinner'] : undefined,
    companions: rules.companions,
    lowMobility: rules.lowMobility,
    interests: interests.length ? interests : rules.interests,
    publicTransportOnly: rules.publicTransportOnly,
  };
  // Do not retain a model summary that contradicts corrected fields or promises accessibility.
  result.summary = `${result.city} ${result.startLocation} 출발 ${result.durationHours}시간 · ${result.interests.map(i=>INTEREST_LABELS[i]).join('·')} · ${PACE_LABELS[result.pace]}`;
  return result;
}

function interestSignals(text: string) {
  const all = (Object.keys(INTEREST_KEYWORDS) as Interest[]).map(interest=>({interest,...wordSignals(text,INTEREST_KEYWORDS[interest])}));
  return {positive:all.filter(x=>x.positive).map(x=>x.interest), excluded:all.filter(x=>x.negative && !x.positive).map(x=>x.interest), only:all.some(x=>x.only)};
}
