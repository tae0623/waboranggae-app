import 'dotenv/config';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import helmet from 'helmet';
import {
  checkOllamaConnection,
  getOllamaRuntimeConfig,
  isOllamaCoursePlannerEnabled,
  isOllamaEnabled,
} from './src/modules/analysis/ollama';
import { analysisRouter } from './src/modules/analysis/routes';
import { recommendationRouter } from './src/modules/recommendation/routes';
import { explanationRouter } from './src/modules/explanation/routes';
import { userRouter } from './src/modules/user/routes';
import { authRouter } from './src/auth/routes';
import { authenticateToken } from './src/middleware/auth';
import { apiLimiter, generationLimiter } from './src/middleware/rateLimiter';
import { TourApiProvider } from './src/modules/recommendation/data/tour-api';
import { getTmapTransitStatus, isTmapTransitConfigured } from './src/modules/recommendation/data/tmap-transit';
import { isLockerApiConfigured } from './src/modules/recommendation/data/conveniences';
import { isBusStopApiConfigured } from './src/modules/recommendation/data/bus-stops';
import { getBusRouteApiStatus } from './src/modules/recommendation/data/bus-routes';
import { mediaRouter } from './src/modules/media/routes';

export const app = express();
const port = Number(process.env.PORT || 8787);

if (process.env.NODE_ENV === 'production') {
  const unsafeSecrets = [
    process.env.JWT_SECRET,
    process.env.JWT_REFRESH_SECRET,
  ].some((value) => !value || value.includes('change-this') || value.includes('replace-with'));
  if (unsafeSecrets) throw new Error('운영 환경의 JWT 비밀키를 안전한 값으로 설정해야 합니다.');
}

app.disable('x-powered-by');

// 보안 헤더
app.use(helmet());

// CORS - 로컬 개발 주소와 배포 환경에서 지정한 앱 주소만 허용
const LOCAL_ORIGINS = [
  'http://localhost:8081',              // Expo / Docker web
  'http://localhost:19000',             // Expo 개발 서버
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const DEPLOYED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...LOCAL_ORIGINS, ...DEPLOYED_ORIGINS])];

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
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '128kb' }));

// Health check
app.get('/health', async (_request, response) => {
  const ollamaStatus = await checkOllamaConnection();
  const ollamaRuntime = getOllamaRuntimeConfig();
  const tourApiProvider = new TourApiProvider();
  response.json({
    ok: true,
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
    busRouteApi: getBusRouteApiStatus(),
    tmapTransitConfigured: isTmapTransitConfigured(),
    tmapTransit: getTmapTransitStatus(),
  });
});

// 인증 라우팅 (공개) — rate limit은 auth/routes.ts에서 경로별 적용
app.use('/auth', authRouter);

// 공개 API (비로그인 검색/추천 허용)
app.use('/api', apiLimiter);
app.use(['/api/analyze', '/api/recommend', '/api/explain'], generationLimiter);
app.use('/api', analysisRouter);
app.use('/api', recommendationRouter);
app.use('/api', explanationRouter);
app.use('/api', mediaRouter);

// 사용자 API (JWT 인증 필요)
app.use('/api', authenticateToken, userRouter);

// 에러 핸들링
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const isValidationError = error instanceof z.ZodError;
  const internalMessage = isValidationError
    ? error.issues.map((issue) => issue.message).join(', ')
    : error instanceof Error
      ? error.message
      : 'Unknown server error';
  if (!isValidationError) console.error('[waboranggae]', internalMessage);
  const message = !isValidationError && process.env.NODE_ENV === 'production'
    ? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
    : internalMessage;
  response.status(isValidationError ? 400 : 500).json({ error: message });
});

export const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[waboranggae] server listening on http://localhost:${port}`);
  console.log(`[waboranggae] Ollama: ${isOllamaEnabled() ? process.env.OLLAMA_MODEL || 'qwen3:8b' : 'disabled'} · TourAPI: ${new TourApiProvider().isConfigured() ? 'configured' : 'demo fallback'} · TMAP: ${isTmapTransitConfigured() ? 'configured' : 'estimated fallback'}`);
});
