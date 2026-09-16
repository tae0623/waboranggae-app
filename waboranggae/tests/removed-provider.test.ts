import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
it('contains no retired provider endpoint or secret access in active API sources', () => {
  const files:string[]=[];
  const visit=(dir:string)=>{for(const entry of readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(file.endsWith('.ts'))files.push(file);
  }};
  visit('server');
  for(const file of files){
    const text=readFileSync(file,'utf8');
    expect(text,file).not.toMatch(/apis\.openapi\.sk\.com|process\.env\.TMAP_|tmap-transit/);
  }
});
it('does not include retired provider settings in deployment templates or generation', () => {
  for(const file of ['.env.example','.env.production.example','scripts/prepare-edge-runtime.mjs']){
    expect(readFileSync(file,'utf8'),file).not.toMatch(/TMAP_[A-Z_]+/);
  }
});
it('uses deployment-injected env and explicit Node globals in the Edge runtime', () => {
  const entry=readFileSync('supabase/functions/waboranggae-api/index.ts','utf8');
  expect(entry).not.toMatch(/process\.env\.[A-Z_]+\s*=(?!=)/);
  const builder=readFileSync('scripts/build-edge.mjs','utf8');
  for(const name of ['node:buffer','node:process','node:timers','setInterval, clearInterval'])expect(builder).toContain(name);
});
