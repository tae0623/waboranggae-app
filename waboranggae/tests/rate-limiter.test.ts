import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { generationLimiter, placeSearchLimiter } from '../server/src/middleware/rateLimiter';

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.get('/search', placeSearchLimiter, (_req, res) => res.json({ ok: true }));
  app.post('/recommend', generationLimiter, (_req, res) => res.json({ ok: true }));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

it('keeps search and generation budgets independent while enforcing both limits', async () => {
  // Local fixture handlers only: these requests never call a tourism or LLM API.
  for (let i = 0; i < 30; i++) expect((await fetch(base + '/search')).status).toBe(200);
  for (let i = 0; i < 20; i++) expect((await fetch(base + '/recommend', { method: 'POST' })).status).toBe(200);
  expect((await fetch(base + '/recommend', { method: 'POST' })).status).toBe(429);
  for (let i = 0; i < 30; i++) expect((await fetch(base + '/search')).status).toBe(200);
  const limitedSearch = await fetch(base + '/search');
  expect(limitedSearch.status).toBe(429);
  expect(Number(limitedSearch.headers.get('retry-after'))).toBeGreaterThan(0);
});
