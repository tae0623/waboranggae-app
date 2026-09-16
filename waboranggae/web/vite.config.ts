import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

export default defineConfig(({ command }) => {
  const teamFile = fileURLToPath(new URL('../.env.team.local', import.meta.url));
  // Builds do not read local development credentials.
  const teamKey = command === 'serve' && existsSync(teamFile) ? parse(readFileSync(teamFile)).TEAM_ACCESS_KEY : undefined;
  const backend = { target: 'http://127.0.0.1:8788', headers: teamKey ? { 'X-Dev-Access-Key': teamKey } : {} };
  return {
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
  };
});
