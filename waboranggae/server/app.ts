import {RequiredVisitError} from "./src/shared/public-error";
import { bodyParserError, declaredBodyLimit, MAX_REQUEST_BYTES } from './src/shared/request-error';
import 'dotenv/config';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import helmet from 'helmet';
import path from 'node:path';
import { teamAccess } from './src/middleware/teamAccess';
import { buildKakaoMapHtml } from '../src/domain/kakaoMapHtml';
import { mapsRouter } from './src/modules/maps/routes';
import { kakaoStatus } from './src/modules/recommendation/data/kakao';
import {
  checkOllamaConnection,
  getOllamaRuntimeConfig,
  isOllamaCoursePlannerEnabled,
  isOllamaEnabled,
} from './src/modules/analysis/ollama';
import { analysisRouter } from './src/modules/analysis/routes';
import { recommendationRouter } from './src/modules/recommendation/routes';
import { PlaceSearchUnavailable } from './src/modules/places/search';
import { explanationRouter } from './src/modules/explanation/routes';
import { userRouter } from './src/modules/user/routes';
import { authRouter } from './src/auth/routes';
import { authenticateToken } from './src/middleware/auth';
import { assertJwtSecrets } from './src/auth/jwt';
import { apiLimiter, generationLimiter, placeSearchLimiter } from './src/middleware/rateLimiter';
import { TourApiProvider } from './src/modules/recommendation/data/tour-api';
import { isLockerApiConfigured } from './src/modules/recommendation/data/conveniences';
import { isBusStopApiConfigured } from './src/modules/recommendation/data/bus-stops';
import { getBusRouteApiStatus } from './src/modules/recommendation/data/bus-routes';
import { mediaRouter } from './src/modules/media/routes';
import { hotPlacesRouter } from './src/modules/hot-places/routes';
import { placesRouter } from './src/modules/places/routes';
import { weatherRouter } from './src/modules/weather/routes';
import { socialRouter } from './src/auth/social';
import { legalRouter } from './src/legal';
import { databaseReady, readiness } from './src/runtime/health';
import { productionProblems } from './src/runtime/production-config';
import { edgePathPrefix } from './src/runtime/edge-path';
import { edgeValidation } from './src/runtime/edge-validation';

export const app = express();

assertJwtSecrets();
const configProblems = productionProblems(process.env);
if (configProblems.length) throw new Error(configProblems.join('; '));

app.disable('x-powered-by');
app.use(edgePathPrefix);
app.use(edgeValidation);
if (process.env.TEAM_DEV_MODE === 'true') app.set('trust proxy', 'loopback');
else if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(value => value.trim()).filter(Boolean));

// 보안 헤더
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null, imgSrc: ["'self'", "data:", "https:"], styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"] } } }));

// CORS - 로컬 개발 주소와 배포 환경에서 지정한 앱 주소만 허용
const LOCAL_ORIGINS = [
  'http://localhost:8081',              // Expo / Docker web
  'http://localhost:19000',             // Expo 개발 서버
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const DEPLOYED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...(process.env.NODE_ENV === 'production' ? [] : LOCAL_ORIGINS), ...DEPLOYED_ORIGINS])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      // 개발 환경에서는 관대함
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Access-Key'],
  maxAge: 86400,
}));

app.use(declaredBodyLimit);
app.use(express.json({ limit: MAX_REQUEST_BYTES }));
app.use(['/auth', '/api/user'], (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/legal', legalRouter);
app.get('/livez', (_req, res) => res.set('Cache-Control','no-store').json({ok:true}));
app.get('/readyz', readiness);
app.use(teamAccess);
app.get('/dev/health', (_req, res) => res.json({ ok: true, service: 'waboranggae-team' }));
app.get('/maps/embed', (req, res) => {
  res.removeHeader('X-Frame-Options');
  // Kakao SDK chooses its secondary script protocol from location.protocol.
  // Permit its exact HTTP CDN only for a loopback development page; HTTPS production stays HTTPS-only.
  const localScript = process.env.NODE_ENV !== 'production' && !req.secure && ['localhost', '127.0.0.1', '::1'].includes(req.hostname)
    ? ' http://t1.daumcdn.net' : '';
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.kakao.com https://*.daumcdn.net" + localScript + "; style-src 'self' 'unsafe-inline'; img-src https: http: data:; connect-src https://*.kakao.com https://*.daumcdn.net; frame-ancestors *");
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(buildKakaoMapHtml(kakaoStatus().freeTierConfirmed ? process.env.KAKAO_MAP_JS_KEY?.trim() || '' : ''));
});
if (process.env.TEAM_DEV_MODE === 'true') {
  app.use('/_expo', express.static(path.resolve('dist-team/_expo')));
  app.use('/native', express.static(path.resolve('dist-team')));
  app.use(express.static(path.resolve('web/dist')));
}

// Health check
app.get('/health', async (_request, response) => {
  const ready = await databaseReady();
  // Public production probes must not expose provider/model/configuration details.
  if (process.env.NODE_ENV === 'production') {
    response.status(ready ? 200 : 503).set('Cache-Control','no-store').json({ ok:ready });
    return;
  }
  const ollamaStatus = await checkOllamaConnection();
  const ollamaRuntime = getOllamaRuntimeConfig();
  const tourApiProvider = new TourApiProvider();
  response.status(ready ? 200 : 503).json({
    ok: ready,
    kakao: kakaoStatus(),
    ollamaEnabled: isOllamaEnabled(),
    ollamaCoursePlannerEnabled: isOllamaCoursePlannerEnabled(),
    ollamaReachable: ollamaStatus.reachable,
    ollamaModelAvailable: ollamaStatus.modelAvailable,
    ollamaModel: ollamaRuntime.model,
    ollamaTimeoutMs: ollamaRuntime.timeoutMs,
    ollamaContextLength: ollamaRuntime.contextLength,
    ollamaKeepAlive: ollamaRuntime.keepAlive,
    tourApiConfigured: tourApiProvider.isConfigured(),
    lockerApiConfigured: isLockerApiConfigured(),
    busStopApiConfigured: isBusStopApiConfigured(),
    busRouteApi: getBusRouteApiStatus(),  });
});

// 인증 라우팅 (공개) — rate limit은 auth/routes.ts에서 경로별 적용
app.use('/auth', authRouter);
app.use('/auth/social', socialRouter);

// 공개 API (비로그인 검색/추천 허용)
app.use('/api', apiLimiter);
app.use(['/api/analyze', '/api/recommend', '/api/explain', '/api/routes/segment'], generationLimiter);
app.use('/api/places/search', placeSearchLimiter);
app.use('/api', analysisRouter);
app.use('/api', recommendationRouter);
app.use('/api', explanationRouter);
app.use('/api', mediaRouter);
app.use('/api', hotPlacesRouter);
app.use('/api', placesRouter);
app.use('/api', mapsRouter);
app.use('/api', weatherRouter);

// 사용자 API (JWT 인증 필요)
app.use('/api', authenticateToken, userRouter);

// 에러 핸들링
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const bodyError = bodyParserError(error);
  if (bodyError) { response.status(bodyError.status).json({ error: bodyError.error }); return; }
  if(error instanceof RequiredVisitError){response.status(error.status).json({code:error.code,error:error.message});return;}
  if(error instanceof PlaceSearchUnavailable){response.status(503).json({code:'PLACE_SEARCH_UNAVAILABLE',error:'지도 서비스를 일시적으로 사용할 수 없어요. 나중에 다시 시도해 주세요.'});return;}
  const isValidationError = error instanceof z.ZodError;
  const internalMessage = isValidationError
    ? error.issues.map((issue) => issue.message).join(', ')
    : error instanceof Error
      ? error.message
      : 'Unknown server error';
  // Prisma/upstream error messages can contain queries, personal data or URLs with API keys.
  if (!isValidationError) console.error('[waboranggae] Request failed (details redacted)');
  const message = !isValidationError && (process.env.NODE_ENV === 'production' || process.env.TEAM_DEV_MODE === 'true')
    ? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
    : internalMessage;
  response.status(isValidationError ? 400 : 500).json({ error: message });
});

