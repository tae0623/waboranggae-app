/** Date/time interpretation is deterministic and uses Korea's calendar, never model guesses. */
export function koreanToday(now = new Date()) { return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10); }
export function validTravelDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function addDays(value: string, days: number) { return new Date(Date.parse(value + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10); }
export function explicitTravelDates(text: string, now = new Date()): {travelDate:string|null;travelEndDate:string|null} {
  const dates = [...text.matchAll(/(\d{4})\s*(?:년\s*|[-/])(\d{1,2})\s*(?:월\s*|[-/])(\d{1,2})\s*일?/g)]
    .map(m => `${m[1]}-${m[2]!.padStart(2,'0')}-${m[3]!.padStart(2,'0')}`);
  if (dates.length) return { travelDate: dates[0]!, travelEndDate: dates[1] ?? null };
  const today = koreanToday(now);
  if (/모레/.test(text)) return { travelDate: addDays(today,2), travelEndDate: null };
  if (/내일/.test(text)) return { travelDate: addDays(today,1), travelEndDate: null };
  if (/오늘/.test(text)) return { travelDate: today, travelEndDate: null };
  const week = text.match(/(이번|다음)\s*주(?:말)?\s*([월화수목금토일])(?:요일)?/);
  if (week) {
    const weekday = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
    const target = '월화수목금토일'.indexOf(week[2]!);
    return { travelDate: addDays(today, target - weekday + (week[1] === '다음' ? 7 : 0)), travelEndDate: null };
  }
  return { travelDate: null, travelEndDate: null };
}
export function explicitClocks(text: string) {
  return [...text.matchAll(/(?:(오전|오후)\s*)?(\d{1,2})\s*(?::\s*(\d{1,2})|시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반))?)/g)].map(m => {
    let hour = Number(m[2]); const minute = m[5] ? 30 : Number(m[3] || m[4] || 0);
    const valid = (m[1] ? hour >= 1 && hour <= 12 : hour <= 23) && minute <= 59;
    if (m[1] === '오후' && hour < 12) hour += 12;
    if (m[1] === '오전' && hour === 12) hour = 0;
    return { value: `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`, valid };
  });
}

export function explicitTripTiming(text: string, now = new Date()) {
  const dates = explicitTravelDates(text,now), clocks = explicitClocks(text).filter(c=>c.valid);
  const duration = text.match(/(\d+(?:\.\d+)?)\s*시간(?:\s*(\d{1,2})\s*분)?/);
  const startTime = clocks[0]?.value ?? '10:00', endTime = clocks[1]?.value;
  const minute = (v:string) => Number(v.slice(0,2))*60+Number(v.slice(3));
  let hours: number | undefined;
  if (endTime) {
    let days = dates.travelDate && dates.travelEndDate && validTravelDate(dates.travelDate) && validTravelDate(dates.travelEndDate)
      ? (Date.parse(dates.travelEndDate)-Date.parse(dates.travelDate))/86_400_000 : 0;
    if (!dates.travelEndDate && (/다음\s*날/.test(text) || minute(endTime)<minute(startTime))) days=1;
    hours=(days*1440+minute(endTime)-minute(startTime))/60;
    if (dates.travelDate && !dates.travelEndDate && validTravelDate(dates.travelDate)) dates.travelEndDate=addDays(dates.travelDate,days);
  }
  return {...dates,startTime,...(endTime?{endTime}:{}),durationHours:duration?Number(duration[1])+Number(duration[2]||0)/60:hours??6};
}

/** A negative applies to its noun/list, not to unrelated later clauses. */
const nouns = '자연|정원|바다|숲|풍경|산책|맛집|음식|먹거리|미식|밥|식사|점심|저녁|석식|카페|커피|디저트|사진|포토|인생샷|시장|로컬|전통시장|역사|문화유산|박물관|근대';
const negativeTail = new RegExp(`^(?:\\s*(?:와|과|랑|하고|및)\\s*(?:${nouns}))*(?:은|는|을|를|이|가|도|만)?\\s*(?:제외|빼|없이|없|싫|말고|아니|필요\\s*없|안\\s*(?:가|갈|먹|해|하|할)|(?:가|먹|하)지\\s*않|패스)`);
export function wordSignals(text: string, words: readonly string[]) {
  let positive = false, negative = false, only = false;
  for (const word of words) for (const match of text.matchAll(new RegExp(word,'g'))) {
    const tail = text.slice(match.index! + word.length).trimStart();
    if (negativeTail.test(tail)) negative = true;
    else { positive = true; if (/^(?:만|만을|만으로)/.test(tail)) only = true; }
  }
  return { positive, negative, only };
}

export function travelInputIssues(text: string, now = new Date()) {
  const issues: string[] = [];
  const durations = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*시간/g)].map(m=>Number(m[1]));
  if (durations.some(n => n < 1 || n > 72)) issues.push('여행 시간은 1~72시간으로 입력해 주세요.');
  if (new Set(durations).size > 1) issues.push('서로 다른 여행 시간이 있어요. 원하는 총 시간을 하나로 정해 주세요.');
  if (explicitClocks(text).some(c=>!c.valid)) issues.push('출발·종료 시각을 00:00~23:59 사이로 입력해 주세요.');
  const dates = explicitTravelDates(text,now);
  if ([dates.travelDate,dates.travelEndDate].some(d=>d && !validTravelDate(d))) issues.push('실제 달력에 있는 날짜를 입력해 주세요.');
  if (dates.travelDate && dates.travelEndDate && dates.travelEndDate < dates.travelDate) issues.push('종료 날짜는 시작 날짜보다 빠를 수 없어요.');
  if (!dates.travelDate && /(?:이번|다음)\s*(?:달|주)|\d{1,2}\s*월\s*\d{1,2}\s*일/.test(text)) issues.push('여행 날짜를 연도·월·일로 구체적으로 입력해 주세요.');
  const timing=explicitTripTiming(text,now);
  if(timing.durationHours<1 || timing.durationHours>72) issues.push('출발·종료 사이의 여행 시간은 1~72시간이어야 해요.');
  if(explicitClocks(text).length>2) issues.push('시각이 여러 개 있어요. 여행 출발·종료 시각을 조건 선택 화면에서 확인해 주세요.');
  if(durations.length && explicitClocks(text).length===2) {
    const clockOnly=explicitTripTiming(text.replace(/-?\d+(?:\.\d+)?\s*시간(?:\s*\d{1,2}\s*분)?/g,''),now);
    if(Math.abs(clockOnly.durationHours-timing.durationHours)>.01)issues.push('출발·종료 시각과 총 여행 시간이 서로 달라요. 시간을 확인해 주세요.');
  }
  if (/서울|부산|제주|대구|인천|대전|울산|세종|강릉|속초|전주|경주|강원|경기도|충청|충북|충남|전북|전라북도|경상|경북|경남/.test(text)) issues.push('현재 추천 지원 지역은 전라남도예요. 여행할 전남 시·군을 선택해 주세요.');
  if (/첫(?:째)?\s*날|둘째\s*날|[12]일차/.test(text)) issues.push('일자별 조건은 아직 자연어로 정확히 나눌 수 없어요. 날짜·식사를 조건 선택 화면에서 확인해 주세요.');
  return issues;
}
