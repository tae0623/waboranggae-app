import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';
import {z} from 'zod';
import {analysisRouter} from '../server/src/modules/analysis/routes';
import {parseTravelText} from '../src/domain/parseTravelText';
import type {Server} from 'node:http';
const {analyze}=vi.hoisted(()=>({analyze:vi.fn()}));
vi.mock('../server/src/modules/analysis/ollama',()=>({analyzeWithOllama:analyze}));
let server:Server,base:string;
beforeAll(async()=>{const app=express();app.use(express.json());app.use(analysisRouter);app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(err instanceof z.ZodError?400:500).json({error:'invalid input'});});await new Promise<void>(resolve=>{server=app.listen(0,'127.0.0.1',()=>{base=`http://127.0.0.1:${(server.address() as any).port}`;resolve();});});});
afterAll(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
const post=(query:string)=>fetch(base+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
describe('analysis HTTP boundary',()=>{
  it('확인 필요한 입력에서는 모델을 호출하지 않는다',async()=>{analyze.mockClear();for(const query of ['서울역 3시간 여행','순천 0시간','순천 25:00 출발','2026년 2월 30일 순천']){const r=await post(query);expect(r.status).toBe(400);expect((await r.json()).code).toBe('TRAVEL_INPUT_NEEDS_CONFIRMATION');}expect(analyze).not.toHaveBeenCalled();});
  it('잘못된 모델 좌표·도시·식사·기간을 HTTP 응답에 넘기지 않는다',async()=>{analyze.mockResolvedValue({...parseTravelText('순천역 6시간 자연'),startLatitude:0,startLongitude:0,startAddress:'없는 주소',meals:['dinner'],travelDate:'null'});const r=await post('보성 터미널 1시간 카페만, 밥은 빼줘');const {preferences:p,source}=await r.json();expect(r.status).toBe(200);expect(source).toBe('ollama');expect(p.city).toBe('보성');expect(p.durationHours).toBe(1);expect(p.interests).toEqual(['cafe']);expect(p.meals).toEqual([]);expect(p.travelDate).toBeNull();expect(p).not.toHaveProperty('startLatitude');});
  it('모델 실패 후에도 동일한 명시 조건으로 응답한다',async()=>{analyze.mockResolvedValue(null);const r=await post('담양 터미널 1.5시간 카페, 식사는 안 해');const data=await r.json();expect(r.status).toBe(200);expect(data.source).toBe('rules');expect(data.preferences.durationHours).toBe(1.5);expect(data.preferences.mealPreference).toBe('none');});
});
