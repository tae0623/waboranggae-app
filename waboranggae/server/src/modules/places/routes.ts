import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { searchPlaces, PlaceSearchUnavailable } from './search';

export const placesRouter = Router();

export const placeSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
}).strict();

placesRouter.get('/places/search', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const { q } = placeSearchQuerySchema.parse(request.query);
    const places = await searchPlaces(q);
    response.json({ places });
  } catch (error) {
    if(error instanceof PlaceSearchUnavailable){response.status(503).json({error:'장소 검색을 일시적으로 사용할 수 없습니다. 호출 한도 또는 제공처 연결 상태를 확인해 주세요.'});return;}
    next(error);
  }
});
