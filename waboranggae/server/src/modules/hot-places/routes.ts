import { Router, Request, Response, NextFunction } from 'express';
import { listHotPlaces } from './service';
import { pickLoginBackdrop } from './backdrop';

export const hotPlacesRouter = Router();

hotPlacesRouter.get('/hot-places', async (_request: Request, response: Response, next: NextFunction) => {
  try {
    response.json(await listHotPlaces(6));
  } catch (error) {
    next(error);
  }
});

hotPlacesRouter.get('/login-photo', async (_request: Request, response: Response, next: NextFunction) => {
  try {
    response.json(await pickLoginBackdrop());
  } catch (error) {
    next(error);
  }
});
