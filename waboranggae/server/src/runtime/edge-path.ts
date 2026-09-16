import type { RequestHandler } from 'express';
export const EDGE_FUNCTION_NAME = 'waboranggae-api';
export const EDGE_PUBLIC_PATH = '/functions/v1/' + EDGE_FUNCTION_NAME;
export function stripEdgePath(url: string) {
  for (const prefix of [EDGE_PUBLIC_PATH, '/' + EDGE_FUNCTION_NAME]) {
    if (url === prefix || url.startsWith(prefix + '?')) return '/' + url.slice(prefix.length);
    if (url.startsWith(prefix + '/')) return url.slice(prefix.length);
  }
  return null;
}
export const edgePathPrefix: RequestHandler = (req, res, next) => {
  if (process.env.API_RUNTIME !== 'supabase-edge') { next(); return; }
  const path = stripEdgePath(req.url);
  if (path === null) { res.status(404).json({error:'Not found'}); return; }
  req.url = path;
  next();
};
