import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { analyzeWithOllama } from './ollama';
import { applyExplicitTravelSignals, parseTravelText } from './parser';
import { travelPreferencesSchema } from '../../shared/schemas';
import { normalizeTravelStart } from '../../../../src/domain/startLocation';

export const analysisRouter = Router();

analysisRouter.post('/analyze', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = z.object({ query: z.string().trim().min(3).max(240) }).parse(request.body);
    const rulePreferences = parseTravelText(body.query);
    const aiPreferences = await analyzeWithOllama(body.query);
    response.json({
      preferences: normalizeTravelStart(aiPreferences
        ? applyExplicitTravelSignals(body.query, aiPreferences)
        : rulePreferences),
      source: aiPreferences ? 'ollama' : 'rules',
    });
  } catch (error) {
    next(error);
  }
});
