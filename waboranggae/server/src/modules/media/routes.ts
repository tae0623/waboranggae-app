import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const mediaRouter = Router();
export function rasterContentType(value:string) {
  const mime=value.split(';')[0]?.trim().toLowerCase();
  return mime==='image/jpg'?'image/jpeg':['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(mime||'')?mime:null;
}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_HOSTS = new Set([
  'tong.visitkorea.or.kr',
  'korean.visitkorea.or.kr',
  'www.visitkorea.or.kr',
  'photokorea.knto.or.kr',
]);

export function parseTourImageUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED_IMAGE_HOSTS.has(url.hostname) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) {
    throw new Error('허용되지 않은 관광 이미지 주소입니다.');
  }
  return url;
}

mediaRouter.get('/media/tour-image', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const query = z.object({ url: z.string().url().max(1200).refine(value => {
      try { parseTourImageUrl(value); return true; } catch { return false; }
    }, '허용되지 않은 관광 이미지 주소입니다.') }).parse(request.query);
    const imageUrl = parseTourImageUrl(query.url);
    let target = imageUrl;
    let upstream: globalThis.Response | undefined;
    for (let redirects=0; redirects<=3; redirects++) {
      upstream = await fetch(target, {
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'waboranggae-app/1.0' },
      redirect: 'manual',
      });
      if (![301,302,303,307,308].includes(upstream.status)) break;
      const location=upstream.headers.get('location');
      await upstream.body?.cancel();
      if(!location || redirects===3) throw new Error('관광 이미지 이동 주소를 확인할 수 없습니다.');
      target=parseTourImageUrl(new URL(location,target).href);
    }
    if(!upstream) throw new Error('관광 이미지 응답이 없습니다.');
    if (!upstream.ok) { await upstream.body?.cancel(); throw new Error(`관광 이미지 응답 오류: HTTP ${upstream.status}`); }
    const contentType = rasterContentType(upstream.headers.get('content-type') || '');
    if (!contentType) { await upstream.body?.cancel(); throw new Error('지원하지 않는 이미지 형식입니다.'); }
    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES) { await upstream.body?.cancel();throw new Error('관광 이미지 용량이 너무 큽니다.'); }
    const reader=upstream.body?.getReader();if(!reader)throw new Error('관광 이미지가 비어 있습니다.');
    const chunks:Uint8Array[]=[];let length=0;
    try { while(true) { const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>MAX_IMAGE_BYTES){await reader.cancel();throw new Error('관광 이미지 용량이 너무 큽니다.');}chunks.push(part.value); } }
    finally { reader.releaseLock(); }
    const bytes=Buffer.concat(chunks,length);
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
