import { describe,expect,it } from 'vitest';
// The benchmark helper is JS so it also runs without a TypeScript build.
import {analysisCases,exploratoryCases,evaluateConditions,explanationFlags,auditUnrequestedData} from '../scripts/llm-comparison-cases.mjs';
describe('LLM 비교 채점의 과대평가 방지',()=>{
  it('기본·생성·탐색 유형을 분리한다',()=>{expect(analysisCases).toHaveLength(30);expect(exploratoryCases).toHaveLength(8);expect(analysisCases.filter((c:any)=>c.kind==='generated')).toHaveLength(6);});
  it('거부한 관심사가 되살아난 경우 실패한다',()=>{const checks=evaluateConditions({interests:['cafe','nature']},{interests:['cafe'],absentInterests:['nature']});expect(checks.every((c:any)=>c.pass)).toBe(false);});
  it('모델 무응답은 분석 성공으로 계산하지 않는다',()=>{expect(evaluateConditions(null,{city:'순천'}).every((c:any)=>c.pass)).toBe(false);});
  it('임의 좌표·날짜와 문자열 null을 정답률에서 별도로 드러낸다',()=>{expect(auditUnrequestedData({startLatitude:0,travelDate:'2023-10-07',travelEndDate:'null'},'이번 주말 여행')).toEqual(['unverified-startLatitude','unanchored-travelDate','invalid-travelEndDate']);expect(auditUnrequestedData({travelDate:'2026-10-03'},'2026년 10월 3일')).toEqual([]);});
  it('설명에 없는 수치·운영 보장을 점검 대상으로 표시한다',()=>{const input=JSON.stringify({course:{places:[{name:'공개 관광지'}],walkMinutes:37}});expect(explanationFlags({headline:'코스',summary:'도보 99분이며 24시간 운영합니다.',evidence:['공개 관광지 방문','도보 37분']},input)).toEqual(expect.arrayContaining(['unmatched-numbers:99,24','unsupported-guarantee']));});
});
