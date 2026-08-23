import { z } from 'zod';
import { ExplainRequest, Place, RecommendationReason, TravelPreferences } from '../../../../src/types/travel';
import { reasonSchema, travelPreferencesSchema } from '../../shared/schemas';
import { desiredStopCount, mealWindowsFor, PlannedCourseOutline } from '../recommendation/planner';

const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'qwen3:8b';

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

const plannedCourseOutlineSchema = z.object({
  title: z.string().min(1).max(45),
  placeIds: z.array(z.string().min(1)).min(2).max(7),
  rationale: z.string().min(1).max(160),
});

const coursePlanSchema = z.object({
  routes: z.array(plannedCourseOutlineSchema).min(1).max(3),
});

export function isOllamaEnabled() {
  return process.env.OLLAMA_ENABLED !== 'false';
}

export async function checkOllamaConnection() {
  if (!isOllamaEnabled()) return { reachable: false, modelAvailable: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    if (!response.ok) return { reachable: false, modelAvailable: false };
    const payload = await response.json() as { models?: Array<{ name?: string; model?: string }> };
    const expected = ollamaModel.replace(/:latest$/, '');
    const modelAvailable = (payload.models ?? []).some((model) => {
      const installed = (model.name || model.model || '').replace(/:latest$/, '');
      return installed === expected;
    });
    return { reachable: true, modelAvailable };
  } catch {
    return { reachable: false, modelAvailable: false };
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}

async function generateStructured<T>(
  schema: z.ZodType<T>,
  systemPrompt: string,
  userContent: string,
): Promise<T | null> {
  if (!isOllamaEnabled()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const jsonSchema = z.toJSONSchema(schema);
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        think: false,
        // llama.cpp 빌드에 따라 복잡한 JSON Schema grammar 초기화가 실패할 수 있습니다.
        // JSON 모드로 생성한 뒤 아래 Zod 스키마로 동일하게 엄격 검증합니다.
        format: 'json',
        options: { temperature: 0 },
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n반드시 다음 JSON 스키마에 맞는 JSON만 출력하세요.\n${JSON.stringify(jsonSchema)}`,
          },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`HTTP ${response.status}${detail ? ` · ${detail}` : ''}`);
    }

    const payload = await response.json() as OllamaChatResponse;
    const content = payload.message?.content;
    if (!content) return null;

    const parsed = schema.safeParse(JSON.parse(extractJson(content)));
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    return parsed.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    console.warn(`[waboranggae] Ollama 요청 실패, 기본 분석으로 전환합니다: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeWithOllama(query: string): Promise<TravelPreferences | null> {
  return generateStructured(
    travelPreferencesSchema,
    [
      '당신은 전라남도 대중교통·도보 여행 조건 분석기입니다.',
      '사용자의 한국어 문장을 추천 필터로 변환하세요.',
      '명시되지 않은 날짜는 null로 두세요.',
      '출발 시간이 없으면 startTime은 10:00으로 두세요.',
      'mealPreference는 식사 제외면 none, 점심이면 lunch, 저녁이면 dinner, 둘 다면 both, 명시가 없으면 auto입니다.',
      'startType이 terminal이면 startLocation도 터미널이어야 하고, station이면 역, lodging이면 숙소여야 합니다.',
      '지역이 없으면 전라남도 순천을 사용하세요.',
      'pace는 적게 걷기나 이동약자 조건이면 easy, 최대한 많이 보기면 full, 그 외에는 balanced입니다.',
      'summary는 60자 이내의 자연스러운 한국어 문장으로 작성하세요.',
      '확실하지 않은 조건을 사실처럼 만들지 마세요.',
    ].join('\n'),
    query,
  );
}

export async function planCoursesWithOllama(
  preferences: TravelPreferences,
  candidates: Place[],
): Promise<PlannedCourseOutline[] | null> {
  if (candidates.length < 2) return null;
  const mealWindows = mealWindowsFor(preferences).map((window) => ({
    kind: window.kind,
    label: window.label,
    start: `${String(Math.floor(window.start / 60)).padStart(2, '0')}:${String(window.start % 60).padStart(2, '0')}`,
    end: `${String(Math.floor(window.end / 60)).padStart(2, '0')}:${String(window.end % 60).padStart(2, '0')}`,
  }));
  const groundedCandidates = candidates.map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    tags: place.tags,
    stayMinutes: place.stayMinutes,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
  }));

  const result = await generateStructured(
    coursePlanSchema,
    [
      '당신은 전남 뚜벅이 여행 일정 구성기입니다.',
      '반드시 candidates에 있는 id만 사용해 서로 다른 코스 최대 3개를 구성하세요.',
      '각 코스는 targetPlaceCount만큼 장소를 사용하고 같은 장소를 중복하지 마세요. 후보가 부족할 때만 더 적게 사용하세요.',
      'food는 식사이고 cafe는 휴식입니다. food를 연속 배치하지 마세요.',
      'mealWindows가 있으면 각 시간대에 food를 정확히 1곳 배치하고, 없으면 food를 배치하지 마세요.',
      'mealWindows와 cafe 관심사가 함께 있으면 첫 cafe는 food 바로 다음에 배치하세요. 식사 전에 cafe부터 배치하지 마세요.',
      '같은 category의 food 또는 cafe를 연속 배치하지 마세요.',
      '비슷한 장소만 반복하지 말고 관심사, 동행자, 걷기 선호를 고려해 자연스러운 순서를 만드세요.',
      '좌표가 가까운 장소를 우선 연결하고 멀리 떨어진 장소 사이의 불필요한 왕복을 피하세요.',
      '거리·운영시간처럼 입력에 없는 사실은 만들지 마세요. 서버가 결과를 다시 검증합니다.',
      'title은 장소명을 나열하지 말고 코스의 특징을 짧은 한국어로 표현하세요.',
    ].join('\n'),
    JSON.stringify({
      preferences: {
        city: preferences.city,
        startLocation: preferences.startLocation,
        startTime: preferences.startTime,
        durationHours: preferences.durationHours,
        mealPreference: preferences.mealPreference,
        interests: preferences.interests,
        companions: preferences.companions,
        pace: preferences.pace,
        lowMobility: preferences.lowMobility,
        publicTransportOnly: preferences.publicTransportOnly,
      },
      targetPlaceCount: Math.min(desiredStopCount(preferences.durationHours), candidates.length),
      mealWindows,
      candidates: groundedCandidates,
    }),
  );

  return result?.routes ?? null;
}

export async function explainWithOllama(request: ExplainRequest): Promise<RecommendationReason | null> {
  const groundedCourse = {
    title: request.course.title,
    city: request.course.city,
    durationHours: request.course.durationHours,
    distanceKm: request.course.distanceKm,
    walkMinutes: request.course.walkMinutes,
    transitMinutes: request.course.transitMinutes,
    fitScore: request.course.fitScore,
    scoreBreakdown: request.course.scoreBreakdown,
    places: request.course.places.map((place) => ({
      name: place.name,
      category: place.category,
      address: place.address,
      moveLabel: place.moveLabel,
      tags: place.tags,
    })),
    conveniences: request.course.conveniences.map((spot) => ({
      name: spot.name,
      type: spot.type,
      distanceLabel: spot.distanceLabel,
    })),
  };

  return generateStructured(
    reasonSchema,
    [
      '당신은 전남 뚜벅이 코스 추천 이유 작성기입니다.',
      '제공된 사용자 조건과 코스 데이터만 근거로 사용하세요.',
      '운영시간, 실시간 여유 수량, 할인, 요금처럼 입력에 없는 사실은 만들지 마세요.',
      '거리와 이동시간은 추정치일 수 있음을 고려하세요.',
      '각 evidence에는 입력 데이터의 점수, 거리 또는 장소명 중 하나 이상을 구체적으로 쓰세요.',
      '과장된 광고 문구 대신 비교 가능한 짧은 한국어를 사용하세요.',
      'source는 반드시 ollama로 반환하세요.',
    ].join('\n'),
    JSON.stringify({ preferences: request.preferences, course: groundedCourse }),
  );
}
