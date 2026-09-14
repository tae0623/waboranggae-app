import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { searchPlaces } from './search';

export const placesRouter = Router();

const querySchema = z.object({
  q: z.string().trim().min(1).max(80),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

placesRouter.get('/places/search', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const { q, lat, lng } = querySchema.parse(request.query);
    const places = await searchPlaces(q, { latitude: lat, longitude: lng });
    response.json({ places });
  } catch (error) {
    next(error);
  }
});
