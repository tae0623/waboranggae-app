import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { analyzeWithOllama } from './ollama';
import { parseTravelText } from './parser';
import { travelPreferencesSchema } from '../../shared/schemas';
import { normalizeTravelStart } from '../../../../src/domain/startLocation';

export const analysisRouter = Router();

analysisRouter.post('/analyze', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = z.object({ query: z.string().trim().min(3).max(240) }).parse(request.body);
    const aiPreferences = await analyzeWithOllama(body.query);
    response.json({
      preferences: normalizeTravelStart(aiPreferences ?? parseTravelText(body.query)),
      source: aiPreferences ? 'ollama' : 'rules',
    });
  } catch (error) {
    next(error);
  }
});
