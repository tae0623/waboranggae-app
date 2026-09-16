import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const requireWeb = createRequire(path.join(web, 'package.json'));
const { build } = await import(pathToFileURL(requireWeb.resolve('vite')).href);
// Pages builds use a same-origin gateway. No .env file or browser-exposed key is required.
await build({ root: web, envDir: false, define: {
  'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
  'import.meta.env.VITE_MAP_BASE_URL': JSON.stringify(''),
} });
await build({ root, configFile: false, envDir: false, publicDir: false, build: {
  outDir: path.join(web, 'dist'), emptyOutDir: false, target: 'es2022', sourcemap: false,
  lib: { entry: path.join(root, 'deployment/pages/entry.ts'), formats: ['es'], fileName: () => '_worker.js' },
} });
await writeFile(path.join(web, 'dist/_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
const worker = await readFile(path.join(web, 'dist/_worker.js'), 'utf8');
if (!worker.includes('X-Team-Web-Key') || !worker.includes('TEAM_WEB_PASSWORD')) throw new Error('PAGES_GATE_MISSING');
console.log('Private Pages bundle ready. Missing runtime secrets fail closed. No cloud deployment performed.');
