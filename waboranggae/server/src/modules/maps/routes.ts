import { Router } from 'express';
import { z } from 'zod';
import { fetchKakaoRoute, kakaoStatus } from '../recommendation/data/kakao';
import { kakaoDirectionsUrl } from '../../../../src/domain/kakaoLinks';

export const mapsRouter = Router();
const point = z.object({
  name: z.string().min(1).max(200),
  latitude: z.number().min(32).max(40),
  longitude: z.number().min(123).max(133),
});
export const segmentRequestSchema = z.object({ from: point, to: point, mode: z.enum(['walk', 'transit']) });
mapsRouter.post('/routes/segment', async (request, response, next) => {
  try {
    const { from, to, mode } = segmentRequestSchema.parse(request.body);
    const segment = await fetchKakaoRoute(from, to, mode);
    const status = kakaoStatus();
    response.json({
      segment,
      externalUrl: kakaoDirectionsUrl(from, to, mode),
      notice: segment
        ? '조회 시점의 구간 경로입니다. 전체 여행 시간표는 예상값이며 실제 출발 전 다시 확인하세요.'
        : !status.restKeyConfigured || !status.freeTierConfirmed
          ? '앱 내 경로 조회 준비 중입니다. 카카오맵 길찾기는 바로 이용할 수 있습니다.'
          : '경로를 확인하지 못했습니다. 카카오맵 길찾기에서 확인해 주세요.',
    });
  } catch (error) { next(error); }
});

