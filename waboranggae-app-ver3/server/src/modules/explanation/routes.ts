import { Router, Request, Response, NextFunction } from 'express';
import { ExplainRequest } from '../../../../src/types/travel';
import { generateExplanation } from './generator';

export const explanationRouter = Router();

explanationRouter.post('/explain', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const payload = request.body as ExplainRequest;
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
