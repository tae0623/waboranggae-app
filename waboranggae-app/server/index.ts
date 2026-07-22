import 'dotenv/config';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import helmet from 'helmet';
import { checkOllamaConnection, isOllamaEnabled } from './src/modules/analysis/ollama';
import { analysisRouter } from './src/modules/analysis/routes';
import { recommendationRouter } from './src/modules/recommendation/routes';
import { explanationRouter } from './src/modules/explanation/routes';
import { userRouter } from './src/modules/user/routes';
import { authRouter } from './src/auth/routes';
import { authenticateToken } from './src/middleware/auth';
import { apiLimiter } from './src/middleware/rateLimiter';
import { TourApiProvider } from './src/modules/recommendation/data/tour-api';

export const app = express();
const port = Number(process.env.PORT || 8787);

app.disable('x-powered-by');

// 보안 헤더
app.use(helmet());

// CORS - 특정 도메인만 허용
const ALLOWED_ORIGINS = [
  'http://localhost:8081',              // 개발 (Expo)
  'http://localhost:19000',             // Expo 개발 서버
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19000',
];

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
  const tourApiProvider = new TourApiProvider();
  response.json({
    ok: true,
    ollamaEnabled: isOllamaEnabled(),
    ollamaReachable: ollamaStatus.reachable,
    ollamaModelAvailable: ollamaStatus.modelAvailable,
    ollamaModel: process.env.OLLAMA_MODEL || 'qwen3:8b',
    tourApiConfigured: tourApiProvider.isConfigured(),
  });
});

// 인증 라우팅 (공개) — rate limit은 auth/routes.ts에서 경로별 적용
app.use('/auth', authRouter);

// 공개 API (비로그인 검색/추천 허용)
app.use('/api', analysisRouter);
app.use('/api', recommendationRouter);
app.use('/api', explanationRouter);

// 사용자 API (JWT 인증 필요)
app.use('/api', authenticateToken, apiLimiter, userRouter);

// 에러 핸들링
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => issue.message).join(', ')
    : error instanceof Error
      ? error.message
      : 'Unknown server error';
  response.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
});

export const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[waboranggae] server listening on http://localhost:${port}`);
  console.log(`[waboranggae] Ollama: ${isOllamaEnabled() ? process.env.OLLAMA_MODEL || 'qwen3:8b' : 'disabled'} · TourAPI: ${new TourApiProvider().isConfigured() ? 'configured' : 'demo fallback'}`);
});
