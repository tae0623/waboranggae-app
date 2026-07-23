import { Interest, Pace, TravelPreferences } from '../../../src/types/travel';
import { INTEREST_LABELS, PACE_LABELS } from '../../../src/domain/labels';

const CITY_NAMES = [
  '순천', '여수', '목포', '담양', '광양', '나주', '보성', '해남', '강진', '고흥', '곡성',
  '구례', '무안', '영광', '영암', '완도', '장성', '장흥', '진도', '함평', '화순', '신안',
];

const INTEREST_KEYWORDS: Record<Interest, string[]> = {
  nature: ['자연', '정원', '바다', '숲', '풍경', '산책'],
  food: ['맛집', '음식', '먹거리', '미식', '밥', '해산물'],
  cafe: ['카페', '커피', '디저트', '쉬고'],
  photo: ['사진', '포토', '인생샷', '풍경'],
  market: ['시장', '로컬', '전통시장'],
  history: ['역사', '문화유산', '박물관', '근대'],
};

function withObjectParticle(value: string) {
  const lastCode = value.charCodeAt(value.length - 1);
  const isHangulSyllable = lastCode >= 0xac00 && lastCode <= 0xd7a3;
  const hasBatchim = isHangulSyllable && (lastCode - 0xac00) % 28 !== 0;
  return `${value}${hasBatchim ? '을' : '를'}`;
}

export function parseTravelText(text: string): TravelPreferences {
  const normalized = text.trim();
  const city = CITY_NAMES.find((name) => normalized.includes(name)) ?? '순천';
  const startMatch = normalized.match(/([가-힣A-Za-z0-9]+(?:역|터미널|항|숙소))/);
  const durationMatch = normalized.match(/(\d+(?:\.\d+)?)\s*시간/);

  const easyPattern = /많이 걷지|적게 걷|천천히|여유|무릎|아이|부모님/;
  const fullPattern = /많이 보|알차게|빽빽|최대한/;
  const pace: Pace = easyPattern.test(normalized)
    ? 'easy'
    : fullPattern.test(normalized)
      ? 'full'
      : 'balanced';

  const interests = (Object.keys(INTEREST_KEYWORDS) as Interest[]).filter((interest) =>
    INTEREST_KEYWORDS[interest].some((keyword) => normalized.includes(keyword)),
  );

  const resolvedInterests: Interest[] = interests.length ? interests : ['nature', 'food'];
  const lowMobility = /무릎|휠체어|유모차|부모님|아이|오르막.*피/.test(normalized);
  const wantsLuggageStorage = /캐리어|짐|물품.*보관|보관함/.test(normalized);
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

  return {
    region: '전라남도',
    city,
    startLocation: startMatch?.[1] ?? `${city}역`,
    startType: /터미널/.test(normalized) ? 'terminal' : /숙소|호텔|펜션/.test(normalized) ? 'lodging' : 'station',
    travelDate: null,
    durationHours: durationMatch ? Math.min(12, Math.max(2, Number(durationMatch[1]))) : 6,
    pace,
    preferLocal: /로컬|골목|전통|시장/.test(normalized),
    interests: resolvedInterests,
    companions,
    lowMobility,
    wantsLuggageStorage,
    publicTransportOnly: !/자가용|렌터카|렌트카/.test(normalized),
    summary: `${city}에서 ${withObjectParticle(labels.join('·'))} 즐기는 ${PACE_LABELS[pace]} 뚜벅이 여행`,
    confidence: normalized.length > 18 ? 0.91 : 0.76,
  };
}
