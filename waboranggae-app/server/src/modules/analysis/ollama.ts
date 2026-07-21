import { z } from 'zod';
import { ExplainRequest, RecommendationReason, TravelPreferences } from '../../../src/types/travel';
import { reasonSchema, travelPreferencesSchema } from '../shared/schemas';

const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'qwen3:8b';

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

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
        format: jsonSchema,
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
      throw new Error(`HTTP ${response.status}`);
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
      '지역이 없으면 전라남도 순천을 사용하세요.',
      'pace는 적게 걷기나 이동약자 조건이면 easy, 최대한 많이 보기면 full, 그 외에는 balanced입니다.',
      'summary는 60자 이내의 자연스러운 한국어 문장으로 작성하세요.',
      '확실하지 않은 조건을 사실처럼 만들지 마세요.',
    ].join('\n'),
    query,
  );
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
