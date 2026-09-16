import express from 'express';
import { z } from 'zod';
import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mediaRouter } from '../server/src/modules/media/routes';
let server: Server, base: string;
const httpFetch = globalThis.fetch;
beforeAll(async () => {
  const app = express(); app.use('/api', mediaRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
    res.status(error instanceof z.ZodError ? 400 : 502).json({ error: 'image unavailable' }));
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/media/tour-image?url=`;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
const request = (url = 'https://tong.visitkorea.or.kr/fixture.jpg') => httpFetch(base + encodeURIComponent(url));
describe('image proxy security without upstream traffic', () => {
  it.each(['http://127.0.0.1/private', 'http://169.254.169.254/latest/meta-data',
    'https://tong.visitkorea.or.kr.attacker.invalid/a', 'file:///etc/passwd'])
  ('blocks SSRF destination %s before fetch', async url => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect((await request(url)).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it('validates redirect targets again and cancels the previous body', async () => {
    const cancel = vi.fn(), body = new ReadableStream({ cancel });
    const fetch = vi.fn(async () => new Response(body, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetch); expect((await request()).status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(1); expect(cancel).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: 'manual' }));
  });
  it('blocks active SVG content even on an allowed hostname', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<svg onload="alert(1)"/>', { headers: { 'Content-Type': 'image/svg+xml' } })));
    const response = await request(); expect(response.status).toBe(502); expect(await response.text()).not.toContain('<svg');
  });
  it('bounds streamed bytes even without Content-Length', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); }, cancel,
    }), { headers: { 'Content-Type': 'image/jpeg' } })));
    expect((await request()).status).toBe(502); expect(cancel).toHaveBeenCalled();
  });
  it('cancels a rejected upstream error body', async () => {
    const cancel = vi.fn(); vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { status: 404 })));
    expect((await request()).status).toBe(502); expect(cancel).toHaveBeenCalled();
  });
  it('returns an allowed raster image with cache and embedding headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpg' } })));
    const response = await request(); expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/jpeg');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
  });
});
