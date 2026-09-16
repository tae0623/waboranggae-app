import type { RequestHandler } from 'express';

export const MAX_REQUEST_BYTES = 128 * 1024;
// Reject declared oversized bodies before the Node-compatible stream parser runs on Edge.
// The parser's own byte limit still covers chunked/undeclared and decompressed bodies.
export const declaredBodyLimit: RequestHandler = (request, response, next) => {
  const length = request.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > MAX_REQUEST_BYTES) {
    response.status(413).json({ error: '요청 데이터가 너무 큽니다.' }); return;
  }
  next();
};

/** Reflect only known body-parser codes, never the input body or internal message. */
export function bodyParserError(error: unknown): { status: number; error: string } | null {
  if (!error || typeof error !== 'object' || !('type' in error)) return null;
  switch (error.type) {
    case 'entity.parse.failed': return { status: 400, error: '요청 형식을 확인해 주세요.' };
    case 'entity.too.large': return { status: 413, error: '요청 데이터가 너무 큽니다.' };
    case 'encoding.unsupported':
    case 'charset.unsupported': return { status: 415, error: '지원하지 않는 요청 형식입니다.' };
    default: return null;
  }
}
