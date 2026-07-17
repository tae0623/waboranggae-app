import 'dotenv/config';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { parseTravelText } from '../src/domain/demoEngine';
import { rankCourses } from '../src/domain/demoEngine';
import { ExplainRequest } from '../src/types/travel';
import { analyzeWithOllama, checkOllamaConnection, explainWithOllama, isOllamaEnabled } from './providers/ollama';
import { fetchTourApiCourses, isTourApiConfigured } from './providers/tourApi';
import { travelPreferencesSchema } from './schemas';

export const app = express();
const port = Number(process.env.PORT || 8787);

app.disable('x-powered-by');
app.use(cors({ origin: true, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '128kb' }));

app.get('/health', async (_request, response) => {
  const ollamaStatus = await checkOllamaConnection();
  response.json({
    ok: true,
    ollamaEnabled: isOllamaEnabled(),
    ollamaReachable: ollamaStatus.reachable,
    ollamaModelAvailable: ollamaStatus.modelAvailable,
    ollamaModel: process.env.OLLAMA_MODEL || 'qwen3:8b',
    tourApiConfigured: isTourApiConfigured(),
  });
});

app.post('/api/analyze', async (request, response, next) => {
  try {
    const body = z.object({ query: z.string().trim().min(3).max(240) }).parse(request.body);
    const aiPreferences = await analyzeWithOllama(body.query);
    response.json({
      preferences: aiPreferences ?? parseTravelText(body.query),
      source: aiPreferences ? 'ollama' : 'rules',
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/recommend', async (request, response, next) => {
  try {
    const body = z.object({ preferences: travelPreferencesSchema }).parse(request.body);
    const liveCourses = await fetchTourApiCourses(body.preferences);
    const source = liveCourses.length ? 'tour-api' : 'demo';
    response.json({
      courses: rankCourses(body.preferences, liveCourses.length ? liveCourses : undefined),
      source,
      fetchedAt: liveCourses.length ? new Date().toISOString() : null,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/explain', async (request, response, next) => {
  try {
    const payload = request.body as ExplainRequest;
    if (!payload?.preferences || !payload?.course) {
      response.status(400).json({ error: 'preferences and course are required' });
      return;
    }

    const aiReason = await explainWithOllama(payload);
    response.json({ reason: aiReason ?? payload.course.reason });
  } catch (error) {
    next(error);
  }
});

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
  console.log(`[waboranggae] Ollama: ${isOllamaEnabled() ? process.env.OLLAMA_MODEL || 'qwen3:8b' : 'disabled'} · TourAPI: ${isTourApiConfigured() ? 'configured' : 'demo fallback'}`);
});
