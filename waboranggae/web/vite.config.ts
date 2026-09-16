import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const teamFile = fileURLToPath(new URL('../.env.team.local', import.meta.url));
const teamKey = existsSync(teamFile) ? parse(readFileSync(teamFile)).TEAM_ACCESS_KEY : undefined;
// Only the loopback Vite proxy reads this key; it is never bundled into browser JavaScript.
const backend = { target: 'http://127.0.0.1:8788', headers: teamKey ? { 'X-Dev-Access-Key': teamKey } : {} };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/auth': backend,
      '/api': backend,
      '/health': backend,
      '/legal': backend,
      '/maps': backend,
    },
  },
});
