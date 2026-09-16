import { Router } from 'express';
import { z } from 'zod';
import { currentWeather } from './service';
import {travelForecast} from './forecast';
export const weatherRouter = Router();
weatherRouter.get('/weather/forecast',async(req,res,next)=>{
  try{
    const q=z.object({lat:z.coerce.number().min(33).max(39),lng:z.coerce.number().min(124).max(132),date:z.iso.date(),startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('00:00'),endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('23:59')}).refine(q=>q.startTime<=q.endTime).parse(req.query);
    res.json(await travelForecast(q.lat,q.lng,q.date,q.startTime,q.endTime));
  }catch(error){next(error);}
});
weatherRouter.get('/weather/current', async (req, res, next) => {
  try {
    const point = z.object({ lat: z.coerce.number().min(33).max(39), lng: z.coerce.number().min(124).max(132) }).parse(req.query);
    res.json(await currentWeather(point.lat, point.lng));
  } catch (error) { next(error); }
});
