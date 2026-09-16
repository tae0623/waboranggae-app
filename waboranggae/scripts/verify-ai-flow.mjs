const apiBaseUrl = (process.env.API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(process.env.TEAM_ACCESS_KEY ? { 'X-Dev-Access-Key': process.env.TEAM_ACCESS_KEY } : {}), ...options.headers },
    signal: AbortSignal.timeout(180_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${payload.error || '응답 오류'}`);
  return payload;
}

const health = await request('/health', { method: 'GET' });
if (!health.ollamaReachable || !health.ollamaModelAvailable) {
  throw new Error(`Ollama 준비 실패: reachable=${health.ollamaReachable}, model=${health.ollamaModelAvailable}`);
}

const analysis = await request('/api/analyze', {
  method: 'POST',
  body: JSON.stringify({ query: '순천에서 자연과 맛집, 카페를 보고 많이 걷지 않는 6시간 여행을 원해요.' }),
});
if (analysis.source !== 'ollama') throw new Error(`자연어 분석이 Ollama를 사용하지 않았습니다: ${analysis.source}`);

const requestedPreferences = {
  ...analysis.preferences,
  // UI에서 터미널 버튼을 누른 조건을 재현하면서, 서버의 방어적 정규화도 함께 확인합니다.
  startType: 'terminal',
  startLocation: `${analysis.preferences.city}역`,
};
const recommendation = await request('/api/recommend', {
  method: 'POST',
  body: JSON.stringify({ preferences: requestedPreferences }),
});
const course = recommendation.courses?.[0];
if (!course) throw new Error('추천 코스가 반환되지 않았습니다.');
if (recommendation.source !== 'tour-api') {
  throw new Error(`추천이 TourAPI를 사용하지 않았습니다: ${recommendation.source}`);
}
if (!['ollama', 'rules'].includes(recommendation.planningSource)) {
  throw new Error(`일정 구성 출처가 올바르지 않습니다: ${recommendation.planningSource}`);
}
if (!course.subtitle?.includes('시간표 검증 완료')) {
  throw new Error('추천 코스가 시간표 검증을 통과한 결과가 아닙니다.');
}
if (!course.places[0]?.moveLabel?.includes(`${analysis.preferences.city} 터미널에서`)) {
  throw new Error(`터미널 출발 조건이 첫 이동에 반영되지 않았습니다: ${course.places[0]?.moveLabel}`);
}
if (course.origin?.name !== `${analysis.preferences.city} 터미널`) {
  throw new Error(`지도 출발 마커가 터미널이 아닙니다: ${course.origin?.name}`);
}
if (!Number.isFinite(course.origin?.latitude) || !Number.isFinite(course.origin?.longitude)) {
  throw new Error('터미널 출발 마커에 실제 좌표가 없습니다.');
}
if (course.routeSegments?.[0]?.fromName !== `${analysis.preferences.city} 터미널`) {
  throw new Error(`첫 길찾기 구간이 터미널에서 시작하지 않습니다: ${course.routeSegments?.[0]?.fromName}`);
}
if (course.routeSource !== 'estimated') {
  throw new Error(`추천 미리보기는 좌표 기반 예상 경로여야 합니다: ${course.routeSource}`);
}
if (!course.validationNotes?.some((note) => note.includes(`${analysis.preferences.city} 터미널`))) {
  throw new Error('터미널 출발 거점 검증 기록이 없습니다.');
}
if (course.places.length < 2) throw new Error(`코스는 최소 2개 장소여야 합니다: ${course.places.length}`);
const expectedPlaceCount = Math.max(2, Math.min(7, Math.round(analysis.preferences.durationHours / 1.5)));
if (course.places.length < Math.min(expectedPlaceCount, 4)) {
  throw new Error(`${analysis.preferences.durationHours}시간 코스의 장소 수가 부족합니다: ${course.places.length}`);
}
const minimumDuration = analysis.preferences.durationHours - 0.5;
if (course.durationHours < minimumDuration || course.durationHours > analysis.preferences.durationHours + 0.4) {
  throw new Error(`선택한 ${analysis.preferences.durationHours}시간과 추천 ${course.durationHours}시간의 차이가 너무 큽니다.`);
}
if (analysis.preferences.pace === 'easy' && course.distanceKm > Math.max(8, analysis.preferences.durationHours * 2)) {
  throw new Error(`적게 걷기 코스의 이동권역이 너무 넓습니다: ${course.distanceKm}km`);
}
for (let index = 1; index < course.places.length; index += 1) {
  if (course.places[index - 1]?.category === 'food' && course.places[index]?.category === 'food') {
    throw new Error('음식점이 연속으로 배치되었습니다.');
  }
  if (course.places[index - 1]?.category === 'cafe' && course.places[index]?.category === 'cafe') {
    throw new Error('카페가 연속으로 배치되었습니다.');
  }
}
const foodPlaces = course.places.filter((place) => place.category === 'food');
if (foodPlaces.length !== 1) throw new Error(`6시간 코스의 점심은 1회여야 합니다: ${foodPlaces.length}`);
for (const place of foodPlaces) {
  const [hour, minute] = String(place.arrival).split(':').map(Number);
  const arrival = hour * 60 + minute;
  if (arrival < 11 * 60 + 30 || arrival > 13 * 60 + 30) {
    throw new Error(`식사 시간이 점심 시간대가 아닙니다: ${place.arrival}`);
  }
}
const firstCafeIndex = course.places.findIndex((place) => place.category === 'cafe');
if (foodPlaces.length && firstCafeIndex >= 0 && course.places[firstCafeIndex - 1]?.category !== 'food') {
  throw new Error('첫 카페가 식사 다음에 배치되지 않았습니다.');
}

const explanation = await request('/api/explain', {
  method: 'POST',
  body: JSON.stringify({ preferences: requestedPreferences, course }),
});
if (explanation.reason?.source !== 'ollama') {
  throw new Error(`추천 이유가 Ollama를 사용하지 않았습니다: ${explanation.reason?.source}`);
}

console.log(JSON.stringify({
  ok: true,
  health: {
    ollamaReachable: health.ollamaReachable,
    ollamaModelAvailable: health.ollamaModelAvailable,
    ollamaModel: health.ollamaModel,
    tourApiConfigured: health.tourApiConfigured,
  },
  analysis: {
    source: analysis.source,
    city: analysis.preferences?.city,
    pace: analysis.preferences?.pace,
  },
  recommendation: {
    source: recommendation.source,
    planningSource: recommendation.planningSource,
    courseCount: recommendation.courses.length,
    firstCourse: course.title,
    requestedDurationHours: analysis.preferences.durationHours,
    plannedDurationHours: course.durationHours,
    places: course.places.map((place) => `${place.arrival} ${place.category} ${place.name}`),
    origin: course.origin,
    routeSource: course.routeSource,
  },
  explanation: {
    source: explanation.reason?.source,
    headline: explanation.reason?.headline,
    evidenceCount: explanation.reason?.evidence?.length || 0,
  },
}, null, 2));
