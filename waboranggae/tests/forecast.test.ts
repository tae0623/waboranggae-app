import {afterEach,describe,expect,it,vi} from 'vitest';
import {forecastBaseTime,forecastDateAvailability,parseForecast,travelForecast} from '../server/src/modules/weather/forecast';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const rows=(date:string,time:string,temp:number,pty=0)=>Object.entries({TMP:temp,SKY:1,PTY:pty,POP:pty?80:0}).map(([category,fcstValue])=>({category,fcstValue:String(fcstValue),fcstDate:date,fcstTime:time,baseDate:'20260915',baseTime:'1400'}));
const payload=(item:unknown[])=>({response:{header:{resultCode:'00'},body:{items:{item}}}});
describe('여행일 단기예보',()=>{
  it('KST 자정에는 전날 23시 발표를 사용한다',()=>expect(forecastBaseTime(new Date('2026-09-14T15:10:00Z'))).toEqual({date:'20260914',time:'2300'}));
  it('발표 지연 20분 전에는 이전 발표를 사용한다',()=>{
    expect(forecastBaseTime(new Date('2026-09-15T05:10:00Z'))).toEqual({date:'20260915',time:'1100'});
    expect(forecastBaseTime(new Date('2026-09-15T05:25:00Z'))).toEqual({date:'20260915',time:'1400'});
  });
  it('여행 날짜와 시간대만 집계하며 오늘·다른 시간의 기온을 섞지 않는다',()=>{
    const result=parseForecast(payload([...rows('20260915','1000',38),...rows('20260916','0900',5),...rows('20260916','1000',20),...rows('20260916','1100',22,1)]),'2026-09-16','10:00','12:00');
    expect(result).toMatchObject({available:true,requestedDate:'2026-09-16',minTemperature:20,maxTemperature:22,maxRainProbability:80});
    if(result.available)expect(result.hours).toHaveLength(2);
  });
  it('예보 없는 날을 현재 날씨로 대신하지 않는다',()=>expect(parseForecast(payload(rows('20260915','1000',30)),'2026-09-16')).toMatchObject({available:false,code:'NO_FORECAST'}));
  it('관측값을 예보로 파싱하지 않는다',()=>expect(parseForecast(payload([{category:'T1H',obsrValue:25,baseDate:'20260915',baseTime:'1000'}]),'2026-09-15').available).toBe(false));
  it('기상청 오류·필수값 누락·잘못된 날짜를 정상 날씨로 표시하지 않는다',()=>{
    expect(parseForecast({response:{header:{resultCode:'30'}}},'2026-09-16').available).toBe(false);
    expect(parseForecast(payload(rows('20260916','1000',99)),'2026-09-16').available).toBe(false);
    expect(forecastDateAvailability('2026-02-30')).toMatchObject({code:'INVALID_DATE'});
  });
  it('과거와 글피 이후에는 외부 요청 없이 미제공 처리한다',()=>{
    const now=new Date('2026-09-15T00:00:00Z');
    expect(forecastDateAvailability('2026-09-14',now)).toMatchObject({code:'PAST_DATE'});
    expect(forecastDateAvailability('2026-09-19',now)).toMatchObject({code:'NOT_PUBLISHED'});
    expect(forecastDateAvailability('2026-09-18',now)).toBeNull();
  });
  it('먼 날짜와 키 미설정에서 API를 호출하지 않는다',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);vi.stubEnv('DATA_GO_KR_KEY','');
    const tomorrow=new Date(Date.now()+9*3600_000+86400_000).toISOString().slice(0,10);
    expect((await travelForecast(34.95,127.49,tomorrow)).available).toBe(false);
    expect((await travelForecast(34.95,127.49,'2099-01-01')).available).toBe(false);expect(fetcher).not.toHaveBeenCalled();
  });
});
