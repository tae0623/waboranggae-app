import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import intro from '../src/domain/brandIntro.json';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n');
describe('shared animated launch artwork',()=>{
  it('preserves the ver4 six alternating steps and completes the trail before leaving',()=>{
    expect(intro.steps.map(s=>s.right)).toEqual([false,true,false,true,false,true]);
    expect(intro.steps.map(s=>s.y)).toEqual([420,392,362,332,300,270]);
    expect(Math.max(...intro.steps.map(s=>s.delayMs))+intro.stepDurationMs).toBeLessThan(intro.durationMs);
  });
  it('uses the same cropped map for native and web without static footprints underneath',()=>{
    const web=read('web/src/assets/splash-map-base.svg'),native=read('android-native/app/src/main/assets/web_splash_map.svg');
    expect(web).toBe(native);expect(web).toContain('viewBox="8 64 272 380"');expect(web).not.toContain('rotate(-22)');
    expect(web.match(/id="jeonnam-boundary" d="([^"]+)"/)?.[1]).toBe(read('web/src/assets/splash-map.svg').match(/id="jeonnam-boundary" d="([^"]+)"/)?.[1]);
    for(const city of ['목포','보성','여수','담양','순천만'])expect(web).toContain(city);
    expect(web).not.toMatch(/<script|onload=|href=/i);
  });
  it('keeps generated native geometry and timings aligned with the web',()=>{
    const native=read('android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/BrandIntroSpec.kt');
    for(const s of intro.steps)expect(native).toContain(`IntroStep(${s.x}f,${s.y}f,${s.rotation}f,${s.right},${s.delayMs})`);
    expect(native).toContain(`durationMs=${intro.durationMs}`);expect(native).toContain(`stepDurationMs=${intro.stepDurationMs}`);
  });
  it('keeps motion reduction and does not bring back a skip button',()=>{
    expect(read('web/src/brand-intro.css')).toContain('@media(prefers-reduced-motion:reduce)');
    expect(read('web/src/BrandIntro.tsx')).not.toContain('<button');
    expect(read('web/src/App.tsx')).toContain('<BrandIntro onDone=');
  });
});
