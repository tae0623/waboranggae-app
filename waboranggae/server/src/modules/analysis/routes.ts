import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { analyzeWithOllama } from './ollama';
import { applyExplicitTravelSignals, parseTravelText } from '../../../../src/domain/parseTravelText';
import { travelPreferencesSchema } from '../../shared/schemas';
import { normalizeTravelStart } from '../../../../src/domain/startLocation';
import { travelInputIssues } from '../../../../src/domain/travelInput';

export const analysisRouter = Router();

analysisRouter.post('/analyze', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = z.object({ query: z.string().trim().min(3).max(240) }).parse(request.body);
    const now = new Date();
    const issues = travelInputIssues(body.query,now);
    if (issues.length) { response.status(400).json({error:issues.join(' '),code:'TRAVEL_INPUT_NEEDS_CONFIRMATION',issues}); return; }
    const rulePreferences = parseTravelText(body.query,now);
    const aiPreferences = await analyzeWithOllama(body.query);
    const preferences = travelPreferencesSchema.parse(normalizeTravelStart(aiPreferences
      ? applyExplicitTravelSignals(body.query, aiPreferences,now)
      : rulePreferences));
    response.json({
      preferences,
      source: aiPreferences ? 'ollama' : 'rules',
    });
  } catch (error) {
    next(error);
  }
});
