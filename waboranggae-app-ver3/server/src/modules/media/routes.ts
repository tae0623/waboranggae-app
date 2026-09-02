import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const mediaRouter = Router();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function parseTourImageUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'tong.visitkorea.or.kr') {
    throw new Error('허용되지 않은 관광 이미지 주소입니다.');
  }
  return url;
}

mediaRouter.get('/media/tour-image', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const query = z.object({ url: z.string().url().max(1200) }).parse(request.query);
    const imageUrl = parseTourImageUrl(query.url);
    const upstream = await fetch(imageUrl, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'waboranggae-app/1.0' },
    });
    if (!upstream.ok) throw new Error(`관광 이미지 응답 오류: HTTP ${upstream.status}`);
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) throw new Error('이미지 형식이 아닌 응답입니다.');
    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES) throw new Error('관광 이미지 용량이 너무 큽니다.');
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('관광 이미지 용량이 너무 큽니다.');
    response
      .set('Content-Type', contentType)
      // Leaflet srcDoc/WebView는 앱과 다른 출처로 취급되므로, 검증된 관광공사 이미지만 표시를 허용합니다.
      .set('Cross-Origin-Resource-Policy', 'cross-origin')
      .set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      .send(bytes);
  } catch (error) {
    next(error);
  }
});
