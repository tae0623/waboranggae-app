import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { courseSnapshotSchema } from '../../shared/courseSnapshot';
import { travelPreferencesSchema } from '../../shared/schemas';
import { generateExplanation } from './generator';

export const explanationRouter = Router();

explanationRouter.post('/explain', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const payload = z.object({ preferences: travelPreferencesSchema, course: courseSnapshotSchema }).parse(request.body);
    if (!payload?.preferences || !payload?.course) {
      response.status(400).json({ error: 'preferences and course are required' });
      return;
    }

    const reason = await generateExplanation(payload);
    response.json({ reason });
  } catch (error) {
    next(error);
  }
});
