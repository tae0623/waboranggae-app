import { z } from 'zod';
import { ExplainRequest, Place, RecommendationReason, TravelPreferences } from '../../../../src/types/travel';
import { reasonSchema, analysisPreferencesSchema } from '../../shared/schemas';
import { desiredStopCount, mealWindowsFor, PlannedCourseOutline, stopBudgetHours } from '../recommendation/planner';
import { OptionalServiceGate } from '../../runtime/bulkhead';

const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'qwen3:8b';
const ollamaTimeoutMs = Math.min(20_000, positiveInteger(process.env.OLLAMA_TIMEOUT_MS, 15_000));
const ollamaContextLength = positiveInteger(process.env.OLLAMA_NUM_CTX, 4_096);
const ollamaKeepAlive = process.env.OLLAMA_KEEP_ALIVE || '30m';
const ollamaGate = new OptionalServiceGate(1);

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function milliseconds(nanoseconds?: number) {
  return Math.round(Number(nanoseconds || 0) / 1_000_000);
}

function logOllamaTiming(task: string, payload: OllamaChatResponse, wallMs: number) {
  const tokens = Number(payload.eval_count || 0);
  const evalSeconds = Number(payload.eval_duration || 0) / 1_000_000_000;
  const tokensPerSecond = evalSeconds > 0 ? Math.round(tokens / evalSeconds * 10) / 10 : 0;
  console.log(
    `[waboranggae] Ollama ${task} 완료 · ${wallMs}ms (load ${milliseconds(payload.load_duration)}ms, prompt ${payload.prompt_eval_count || 0}tok, output ${tokens}tok, ${tokensPerSecond}tok/s)`,
  );
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

/** 버튼 추천은 빠른 규칙 엔진이 기본이며, LLM 코스 실험은 명시적으로 켠 경우에만 실행합니다. */
export function isOllamaCoursePlannerEnabled() {
  return isOllamaEnabled() && process.env.OLLAMA_COURSE_PLANNER_ENABLED === 'true';
}

export function getOllamaRuntimeConfig() {
  return {
    model: ollamaModel,
    timeoutMs: ollamaTimeoutMs,
    contextLength: ollamaContextLength,
    keepAlive: ollamaKeepAlive,
  };
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
  task: string,
  maxPredict: number,
): Promise<T | null> {
  if (!isOllamaEnabled() || !ollamaGate.acquire()) return null;
  let successful = false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs);
  const startedAt = Date.now();

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
        keep_alive: ollamaKeepAlive,
        // llama.cpp 빌드에 따라 복잡한 JSON Schema grammar 초기화가 실패할 수 있습니다.
        // JSON 모드로 생성한 뒤 아래 Zod 스키마로 동일하게 엄격 검증합니다.
        format: 'json',
        options: {
          temperature: 0,
          num_ctx: ollamaContextLength,
          num_predict: maxPredict,
        },
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
      throw new Error(`HTTP ${response.status}${/CUDA|0xc0000409/.test(detail)?' (CUDA 초기화 실패)':''}`);
    }

    const payload = await response.json() as OllamaChatResponse;
    logOllamaTiming(task, payload, Date.now() - startedAt);
    const content = payload.message?.content;
    if (!content) return null;

    const parsed = schema.safeParse(JSON.parse(extractJson(content)));
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((issue) => issue.message).join(', '));
    }
    successful = true;
    return parsed.data;
  } catch (error) {
    const message = error instanceof Error && /^(HTTP \d{3}|This operation was aborted|The operation was aborted)/.test(error.message) ? error.message : '연결 또는 응답 형식 확인 필요';
    console.warn(`[waboranggae] Ollama ${task} 실패 (${Date.now() - startedAt}ms), 검증된 규칙 엔진으로 전환합니다: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
    ollamaGate.release(successful);
  }
}

export async function analyzeWithOllama(query: string): Promise<TravelPreferences | null> {
  const value = await generateStructured(
    analysisPreferencesSchema,
    [
      '당신은 전라남도 대중교통·도보 여행 조건 분석기입니다.',
      '사용자의 한국어 문장을 추천 필터로 변환하세요.',
      '주소, 좌표, 숙소명, 날짜, 종료시각을 생성하지 마세요. 날짜와 시각 계산은 서버가 담당합니다.',
      '출발 시간이 없으면 startTime은 10:00으로 두세요.',
      'mealPreference는 식사 제외면 none, 점심이면 lunch, 저녁이면 dinner, 둘 다면 both, 명시가 없으면 auto입니다.',
      'startType이 terminal이면 startLocation도 터미널이어야 하고, station이면 역, lodging이면 숙소여야 합니다.',
      '역이 없거나 사용자가 버스정류장·여객터미널·관광지 등 다른 거점을 지정하면 startType은 custom으로 두고 그 장소명을 보존하세요.',
      '항구나 선착장 이름은 터미널로 바꾸지 말고 반드시 startType custom과 원래 장소명을 보존하세요.',
      '지역이 없으면 전라남도 순천을 사용하세요.',
      '사용자가 명시한 전남 시·군 이름을 순천으로 바꾸지 마세요. 제외·빼고·안 함은 해당 조건을 원하지 않는다는 뜻입니다.',
      'pace는 적게 걷기나 이동약자 조건이면 easy, 최대한 많이 보기면 full, 그 외에는 balanced입니다.',
      '알차게·빽빽하게·최대한 많이는 pace full입니다. 점심·저녁·식사를 원하면 interests에 food를 포함하세요.',
      'summary는 60자 이내의 자연스러운 한국어 문장으로 작성하세요.',
      '확실하지 않은 조건을 사실처럼 만들지 마세요.',
    ].join('\n'),
    query,
    '조건분석',
    420,
  );
  return value ? { ...value, travelDate: null } : null;
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
      targetPlaceCount: Math.min(desiredStopCount(stopBudgetHours(preferences)), candidates.length),
      mealWindows,
      candidates: groundedCandidates,
    }),
    '코스계획',
    700,
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
    transitAccessEvidence: request.course.transitAccessEvidence,
    places: request.course.places.map((place) => ({
      name: place.name,
      category: place.category,
      address: place.address,
      moveLabel: place.moveLabel,
      tags: place.tags,
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
    '추천설명',
    420,
  );
}
