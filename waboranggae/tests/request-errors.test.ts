import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bodyParserError, declaredBodyLimit, MAX_REQUEST_BYTES } from '../server/src/shared/request-error';
let server: Server, base: string;
beforeAll(async () => {
  const app = express(); app.use(declaredBodyLimit); app.use(express.json({ limit: MAX_REQUEST_BYTES }));
  app.post('/fixture', (_req, res) => res.json({ ok: true }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const known = bodyParserError(error); res.status(known?.status || 500).json({ error: known?.error || 'unavailable' });
  });
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/fixture`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
describe('request body rejection without reflecting private input', () => {
  it.each([
    ['{"private":"do-not-reflect",', 'application/json', 400],
    [JSON.stringify({ private: 'x'.repeat(132000) }), 'application/json', 413],
    ['{}', 'application/json; charset=latin1', 415],
  ])('returns a client error for invalid body', async (body, contentType, status) => {
    const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': String(contentType) }, body: String(body) });
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('private');
  });
  it('does not reflect unknown internal errors', () => expect(bodyParserError(new Error('secret database url'))).toBeNull());
  it('also enforces the parser limit without a declared Content-Length', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ value: 'x'.repeat(MAX_REQUEST_BYTES) }));
    const body = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
    const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half' } as RequestInit);
    expect(response.status).toBe(413);
  });
});
