import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { rankCourses } from './ranker';
import { DemoProvider } from './data/demo';
import { TourApiProvider, listJeonnamCities } from './data/tour-api';
import { enrichCourses } from './enrich';
import { travelPreferencesSchema } from '../shared/schemas';

export const recommendationRouter = Router();

const demoProvider = new DemoProvider();
const tourApiProvider = new TourApiProvider();

recommendationRouter.get('/regions/jeonnam-cities', async (_request: Request, response: Response, next: NextFunction) => {
  try {
    const cities = await listJeonnamCities();
    response.json({ region: '전라남도', cities });
  } catch (error) {
    next(error);
  }
});

recommendationRouter.post('/recommend', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const body = z.object({ preferences: travelPreferencesSchema }).parse(request.body);

    let liveCourses = await tourApiProvider.fetchCourses(body.preferences);
    const source = liveCourses.length ? 'tour-api' : 'demo';

    if (!liveCourses.length) {
      liveCourses = await demoProvider.fetchCourses(body.preferences);
    }

    const enriched = await enrichCourses(liveCourses);
    const ranked = rankCourses(body.preferences, enriched);

    response.json({
      courses: ranked,
      source,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
