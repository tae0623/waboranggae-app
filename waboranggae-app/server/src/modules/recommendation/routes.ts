import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rankCourses } from './ranker';
import { DemoProvider } from './data/demo';
import { TourApiProvider } from './data/tour-api';
import { travelPreferencesSchema } from '../shared/schemas';

export const recommendationRouter = Router();

const demoProvider = new DemoProvider();
const tourApiProvider = new TourApiProvider();

recommendationRouter.post('/recommend', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = z.object({ preferences: travelPreferencesSchema }).parse(request.body);

    // TourAPI를 먼저 시도하고, 실패하면 Demo 데이터 사용
    let liveCourses = await tourApiProvider.fetchCourses(body.preferences);
    const source = liveCourses.length ? 'tour-api' : 'demo';

    if (!liveCourses.length) {
      liveCourses = await demoProvider.fetchCourses(body.preferences);
    }

    const ranked = rankCourses(body.preferences, liveCourses);

    response.json({
      courses: ranked,
      source,
      fetchedAt: liveCourses.length ? new Date().toISOString() : null,
    });
  } catch (error) {
    next(error);
  }
});
