const apiBaseUrl = (process.env.API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

const cases = [
  {
    name: '터미널·적게 걷기·점심',
    query: '순천 터미널에서 오전 10시에 출발해 6시간 동안 많이 걷지 않고 자연과 점심 맛집을 보고 싶어요.',
    expected: { city: '순천', startType: 'terminal', durationHours: 6, startTime: '10:00', pace: 'easy', mealPreference: 'lunch', interests: ['nature', 'food'] },
  },
  {
    name: '철도 없는 지역·항구 출발',
    query: '완도항에서 바다와 전통시장을 알차게 5시간 여행하고 싶어요.',
    expected: { city: '완도', startType: 'custom', startLocationIncludes: '완도항', durationHours: 5, pace: 'full', interests: ['nature', 'market'] },
  },
  {
    name: '역·역사·시장',
    query: '목포역에서 역사와 전통시장을 5시간 둘러보고 싶어요.',
    expected: { city: '목포', startType: 'station', durationHours: 5, interests: ['history', 'market'] },
  },
  {
    name: '숙소·저녁·카페',
    query: '여수 숙소에서 오후 3시에 시작해 7시간 동안 바다와 카페를 보고 저녁도 먹고 싶어요.',
    expected: { city: '여수', startType: 'lodging', durationHours: 7, startTime: '15:00', mealPreference: 'dinner', interests: ['nature', 'cafe', 'food'] },
  },
];

async function request(path, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    signal: AbortSignal.timeout(180_000),
  });
  const payload = await response.json().catch(() => ({}));
  const elapsedMs = Math.round(performance.now() - startedAt);
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${payload.error || '응답 오류'}`);
  return { payload, elapsedMs };
}

function checkCase(preferences, expected) {
  const checks = [];
  for (const key of ['city', 'startType', 'durationHours', 'startTime', 'pace', 'mealPreference']) {
    if (expected[key] !== undefined) checks.push({ field: key, pass: preferences[key] === expected[key], actual: preferences[key], expected: expected[key] });
  }
  if (expected.startLocationIncludes) {
    checks.push({
      field: 'startLocation',
      pass: String(preferences.startLocation || '').includes(expected.startLocationIncludes),
      actual: preferences.startLocation,
      expected: `includes ${expected.startLocationIncludes}`,
    });
  }
  for (const interest of expected.interests || []) {
    checks.push({ field: `interest:${interest}`, pass: preferences.interests?.includes(interest), actual: preferences.interests, expected: interest });
  }
  return checks;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

const { payload: health } = await request('/health');
if (!health.ollamaReachable || !health.ollamaModelAvailable) {
  throw new Error(`Ollama 준비 실패: reachable=${health.ollamaReachable}, modelAvailable=${health.ollamaModelAvailable}, model=${health.ollamaModel}`);
}

const results = [];
for (const testCase of cases) {
  const { payload, elapsedMs } = await request('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ query: testCase.query }),
  });
  const checks = checkCase(payload.preferences || {}, testCase.expected);
  results.push({
    name: testCase.name,
    elapsedMs,
    source: payload.source,
    passedChecks: checks.filter((check) => check.pass).length,
    totalChecks: checks.length,
    pass: payload.source === 'ollama' && checks.every((check) => check.pass),
    failures: checks.filter((check) => !check.pass),
  });
}

const latencies = results.map((result) => result.elapsedMs);
const passed = results.filter((result) => result.pass).length;
const report = {
  ok: passed === results.length,
  endpoint: apiBaseUrl,
  runtime: {
    model: health.ollamaModel,
    contextLength: health.ollamaContextLength,
    keepAlive: health.ollamaKeepAlive,
    timeoutMs: health.ollamaTimeoutMs,
  },
  quality: { passed, total: results.length, passRate: `${Math.round(passed / results.length * 100)}%` },
  latencyMs: {
    firstColdOrWarm: latencies[0],
    median: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    min: Math.min(...latencies),
    max: Math.max(...latencies),
  },
  results,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
