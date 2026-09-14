import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rankCourses } from '../../../../src/domain/rankCourses';
import { DemoProvider } from './data/demo';
import { TourApiProvider, listJeonnamCities } from './data/tour-api';
import { enrichCourses } from './enrich';
import { travelPreferencesSchema } from '../../shared/schemas';
import { isOllamaCoursePlannerEnabled, planCoursesWithOllama } from '../analysis/ollama';
import { collectPlanningCandidates, mergePlannedCourses } from './planner';
import { normalizeTravelStart } from '../../../../src/domain/startLocation';
import { attachRoutingToCourses } from './routing';

export const recommendationRouter = Router();

const demoProvider = new DemoProvider();
const tourApiProvider = new TourApiProvider();
const RECOMMENDATION_CACHE_TTL_MS = 15 * 60 * 1_000;

function isDemoCourseFallbackAllowed() {
  const raw = (process.env.ALLOW_DEMO_COURSE_FALLBACK ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'off'].includes(raw);
}

type RecommendationPayload = {
  courses: ReturnType<typeof rankCourses>;
  source: 'tour-api' | 'demo';
  planningSource: 'ollama' | 'rules';
  fetchedAt: string;
  fallbackReason: string | null;
  tourApiConfigured: boolean;
};
const recommendationCache = new Map<string, { expiresAt: number; value: RecommendationPayload }>();
const pendingRecommendations = new Map<string, Promise<RecommendationPayload>>();

async function createRecommendation(preferences: z.infer<typeof travelPreferencesSchema>): Promise<RecommendationPayload> {
  const tourApiConfigured = tourApiProvider.isConfigured();
  const allowDemo = isDemoCourseFallbackAllowed();
  const tourCourses = await tourApiProvider.fetchCourses(preferences);
  let plannedCourses = tourCourses;
  let source: 'tour-api' | 'demo' = tourCourses.length ? 'tour-api' : 'demo';
  let fallbackReason: string | null = null;

  if (tourCourses.length) {
    const candidates = collectPlanningCandidates(tourCourses);
    const outlines = isOllamaCoursePlannerEnabled()
      ? await planCoursesWithOllama(preferences, candidates)
      : null;
    plannedCourses = mergePlannedCourses(preferences, tourCourses, outlines);
  }

  if (!plannedCourses.length) {
    fallbackReason = tourApiConfigured
      ? 'TourAPI 결과가 비어 있습니다.'
      : 'DATA_GO_KR_KEY가 없어 TourAPI를 호출하지 못했습니다.';
    if (allowDemo) {
      plannedCourses = await demoProvider.fetchCourses(preferences);
      source = 'demo';
      fallbackReason += ' 시연 코스로 대체했습니다.';
    } else {
      source = 'demo';
      plannedCourses = [];
      fallbackReason += ' ALLOW_DEMO_COURSE_FALLBACK=false라 시연 코스는 쓰지 않습니다.';
    }
  }

  plannedCourses = await attachRoutingToCourses(preferences, plannedCourses);
  const enriched = await enrichCourses(plannedCourses);
  const ranked = rankCourses(preferences, enriched).slice(0, 5);
  return {
    courses: ranked,
    source,
    planningSource: ranked[0]?.planningSource ?? 'rules',
    fetchedAt: new Date().toISOString(),
    fallbackReason,
    tourApiConfigured,
  };
}

function getRecommendation(preferences: z.infer<typeof travelPreferencesSchema>) {
  const key = JSON.stringify(preferences);
  const cached = recommendationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  const pending = pendingRecommendations.get(key);
  if (pending) return pending;

  const request = createRecommendation(preferences)
    .then((value) => {
      recommendationCache.set(key, { value, expiresAt: Date.now() + RECOMMENDATION_CACHE_TTL_MS });
      return value;
    })
    .finally(() => pendingRecommendations.delete(key));
  pendingRecommendations.set(key, request);
  return request;
}

recommendationRouter.get('/regions/jeonnam-cities', async (_request: Request, response: Response, next: NextFunction) => {
  try {
    const cities = await listJeonnamCities();
    response.json({ region: '전라남도', cities });
  } catch (error) {
    next(error);
  }
});

recommendationRouter.post('/recommend', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = z.object({ preferences: travelPreferencesSchema }).parse(request.body);
    const preferences = normalizeTravelStart(body.preferences);

    response.json(await getRecommendation(preferences));
  } catch (error) {
    next(error);
  }
});
