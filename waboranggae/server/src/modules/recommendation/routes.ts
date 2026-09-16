import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rankCourses } from '../../../../src/domain/rankCourses';
import { DemoProvider } from './data/demo';
import { TourApiProvider, listJeonnamCities } from './data/tour-api';
import { enrichCourses } from './enrich';
import { travelPreferencesSchema } from '../../shared/schemas';
import { isOllamaCoursePlannerEnabled, planCoursesWithOllama } from '../analysis/ollama';
import { assignGroundedCourseTitles, collectPlanningCandidates, mergePlannedCourses } from './planner';
import { normalizeTravelStart } from '../../../../src/domain/startLocation';
import { attachRoutingToCourses } from './routing';
import {prepareLocalTrip, appendAccessTrip, preferencesForSelection} from './local-trip';
import { rankValidatedCourses, verifyTopCourses } from './verification';
import { courseDataSource } from '../../../../src/domain/courseDataSource';
import type { CourseDataSource } from '../../../../src/types/travel';
export { rankValidatedCourses } from './verification';

export const recommendationRouter = Router();

// Explicit refresh for expired results and user edits; initial results are already checked.
recommendationRouter.post('/recommend/refresh-route',async(request,response,next)=>{
  try{
    const body=z.object({preferences:travelPreferencesSchema,courseId:z.string().max(200),placeIds:z.array(z.string().max(200)).min(1).max(40)}).parse(request.body);
    const preferences=normalizeTravelStart(body.preferences),recommendation=await getRecommendation(preferences);
    const original=recommendation.courses.find(c=>c.id===body.courseId);
    const pool=new Map(recommendation.courses.flatMap(c=>c.places).map(p=>[p.id,p]));
    if(!original||new Set(body.placeIds).size!==body.placeIds.length||body.placeIds.some(id=>!pool.has(id))){response.status(400).json({error:'추천이 만료되었습니다. 다시 추천해 주세요.'});return;}
    const selectedPlaces=new Map(original.places.map(p=>[p.id,p]));
    const places=body.placeIds.map(id=>selectedPlaces.get(id)??pool.get(id)!);
    const localPreferences=preferencesForSelection(preferences,original,places);
    const routed=await attachRoutingToCourses(localPreferences,[{...original,places,routeSegments:undefined}],{live:true});
    const course=rankValidatedCourses(localPreferences,assignGroundedCourseTitles(localPreferences,routed))[0];
    // Return actual failed constraints too; never keep displaying the old estimate as a passing route.
    response.json({course,checkedAt:new Date().toISOString(),notice:course?.routeSource==='kakao'?'카카오 시간 반영 · 조회 시점 기준':'일부 구간은 추정 시간입니다.'});
  }catch(error){next(error);}
});

recommendationRouter.post('/recommend/edit', async (request, response, next) => {
  try {
    const body = z.object({ preferences: travelPreferencesSchema, courseId: z.string().max(200), placeIds: z.array(z.string().max(200)).min(1).max(40) }).parse(request.body);
    const preferences = normalizeTravelStart(body.preferences);
    const recommendation = await getRecommendation(preferences);
    const original = recommendation.courses.find(course => course.id === body.courseId);
    const pool = new Map(recommendation.courses.flatMap(course => course.places).map(place => [place.id, place]));
    if (!original || new Set(body.placeIds).size !== body.placeIds.length || body.placeIds.some(id => !pool.has(id))) {
      response.status(400).json({ error: '현재 추천의 실제 장소만 편집할 수 있습니다. 코스를 다시 추천받아 주세요.' }); return;
    }
    const selectedPlaces=new Map(original.places.map(p=>[p.id,p]));
    const places = body.placeIds.map(id => selectedPlaces.get(id)??pool.get(id)!);
    if (places.some((place, i) => i > 0 && ['food','cafe'].includes(place.category) && place.category === places[i - 1]?.category)) {
      response.status(400).json({ error: '식사 또는 카페를 연속으로 배치할 수 없습니다.' }); return;
    }
    const localPreferences=preferencesForSelection(preferences,original,places);
    const routed = await attachRoutingToCourses(localPreferences, [{ ...original, places, routeSegments: undefined }], {live:true});
    const course = rankValidatedCourses(localPreferences, assignGroundedCourseTitles(localPreferences,routed))[0];
    if (!course || !course.constraintPassed) {
      response.status(400).json({ error: '선택한 순서는 여행 시간·이동 조건을 충족하지 못합니다. 장소를 줄이거나 순서를 바꿔 주세요.' }); return;
    }
    response.json({ course });
  } catch (error) { next(error); }
});

const demoProvider = new DemoProvider();
const tourApiProvider = new TourApiProvider();
const RECOMMENDATION_CACHE_TTL_MS = 5 * 60 * 1_000;

function isDemoCourseFallbackAllowed() {
  const raw = (process.env.ALLOW_DEMO_COURSE_FALLBACK ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')).trim().toLowerCase();
  return !['0', 'false', 'off'].includes(raw);
}

type RecommendationPayload = {
  courses: ReturnType<typeof rankCourses>;
  source: CourseDataSource;
  planningSource: 'ollama' | 'rules';
  fetchedAt: string;
  fallbackReason: string | null;
  tourApiConfigured: boolean;
};
const recommendationCache = new Map<string, { expiresAt: number; value: RecommendationPayload }>();
const pendingRecommendations = new Map<string, Promise<RecommendationPayload>>();
// Avoid retaining precise start coordinates in expired cache keys indefinitely.
const pruneRecommendationCache = () => { for (const [key,item] of recommendationCache) if(item.expiresAt<=Date.now()) recommendationCache.delete(key); };
setInterval(pruneRecommendationCache,60_000).unref();

async function createRecommendation(preferences: z.infer<typeof travelPreferencesSchema>): Promise<RecommendationPayload> {
  const tourApiConfigured = tourApiProvider.isConfigured();
  const allowDemo = isDemoCourseFallbackAllowed();
  const tourCourses = await tourApiProvider.fetchCourses(preferences);
  let plannedCourses = tourCourses;
  let source: CourseDataSource = tourCourses.length ? courseDataSource(tourCourses) : 'tour-api';
  let fallbackReason: string | null = null;

  if (tourCourses.length) {
    const candidates = collectPlanningCandidates(tourCourses, preferences);
    const outlines = isOllamaCoursePlannerEnabled()
      ? await planCoursesWithOllama(preferences, candidates)
      : null;
    plannedCourses = mergePlannedCourses(preferences, tourCourses, outlines);
  }

  if (!plannedCourses.length) {
    fallbackReason = tourCourses.length
      ? '이 출발지와 시작 시각에 맞는 동선을 찾지 못했어요. 출발지나 식사 선택을 바꿔 주세요.'
      : tourApiConfigured ? '관광정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
      : '관광정보 서비스 연결을 확인해 주세요.';
    if (allowDemo && !preferences.requiredContentId) {
      plannedCourses = await demoProvider.fetchCourses(preferences);
      source = 'demo';
      fallbackReason += ' 시연 코스로 대체했습니다.';
    } else {
      plannedCourses = [];
    }
  }

  plannedCourses = await attachRoutingToCourses(preferences, plannedCourses);
  const enriched = await enrichCourses(plannedCourses);
  const ranked = source !== 'demo'
    ? await verifyTopCourses(preferences, enriched)
    : rankValidatedCourses(preferences, enriched).slice(0, 3);
  if(preferences.requiredContentId && !ranked.some(c=>c.constraintPassed))
    fallbackReason='선택한 장소를 포함해 시간·이동·식사 조건을 만족하는 코스를 찾지 못했어요. 여행 시간을 늘리거나 조건을 조정해 주세요.';
  return {
    courses: ranked,
    source: source === 'demo' ? source : courseDataSource(ranked.length ? ranked : plannedCourses),
    planningSource: ranked[0]?.planningSource ?? 'rules',
    fetchedAt: new Date().toISOString(),
    fallbackReason,
    tourApiConfigured,
  };
}

function getRecommendation(preferences: z.infer<typeof travelPreferencesSchema>) {
  pruneRecommendationCache();
  const key = JSON.stringify(preferences);
  const cached = recommendationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  const pending = pendingRecommendations.get(key);
  if (pending) return pending;

  const request = prepareLocalTrip(preferences).then(async context=>{
    const result=await createRecommendation(context.preferences);
    return {...result,courses:await appendAccessTrip(context,result.courses)};
  })
    .then((value) => {
      if(recommendationCache.size>=200) recommendationCache.delete(recommendationCache.keys().next().value!);
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
