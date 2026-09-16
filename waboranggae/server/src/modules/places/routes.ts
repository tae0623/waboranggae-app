import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { searchPlaces, PlaceSearchUnavailable, resolveMapPoint } from './search';

export const placesRouter = Router();
export const mapPointSchema=z.object({selectionSource:z.literal('map-tap'),latitude:z.number().min(32).max(40),longitude:z.number().min(123).max(133),name:z.string().trim().max(80).optional()}).strict();
placesRouter.post('/places/resolve',async(request,response,next)=>{
  try{const p=mapPointSchema.parse(request.body);const place=await resolveMapPoint(p.latitude,p.longitude,p.name);
    if(!place){response.status(404).json({error:'이 위치의 주소를 찾지 못했어요. 가까운 장소를 선택해 주세요.'});return;}
    response.json({place});
  }catch(error){if(error instanceof PlaceSearchUnavailable){response.status(503).json({error:'장소 정보를 잠시 불러올 수 없어요.'});return;}next(error);}
});

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
