export type EventStatus = 'upcoming' | 'ongoing' | 'ended' | 'unknown';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function cleanTourText(value?: string | null) {
  if (!value) return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function parseYmd(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function formatDay(date: Date, withYear = false) {
  const weekday = WEEKDAYS[date.getDay()];
  const body = `${date.getMonth() + 1}월 ${date.getDate()}일(${weekday})`;
  return withYear ? `${date.getFullYear()}년 ${body}` : body;
}

export function formatEventPeriod(start?: string | null, end?: string | null) {
  const from = parseYmd(start);
  const to = parseYmd(end);
  if (!from) return '';
  if (!to || from.getTime() === to.getTime()) return formatDay(from, true);
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${formatDay(from, true)} ~ ${to.getDate()}일(${WEEKDAYS[to.getDay()]})`;
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${formatDay(from, true)} ~ ${formatDay(to)}`;
  }
  return `${formatDay(from, true)} ~ ${formatDay(to, true)}`;
}

export function formatEventPeriodShort(start?: string | null, end?: string | null) {
  const from = parseYmd(start);
  const to = parseYmd(end);
  if (!from) return '';
  const stamp = (date: Date) => `${date.getMonth() + 1}.${date.getDate()}`;
  if (!to || from.getTime() === to.getTime()) return stamp(from);
  return `${stamp(from)}–${stamp(to)}`;
}

export function eventStatus(start?: string | null, end?: string | null, now = new Date()): EventStatus {
  const from = parseYmd(start);
  const to = parseYmd(end) || from;
  if (!from || !to) return 'unknown';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < from) return 'upcoming';
  if (today > to) return 'ended';
  return 'ongoing';
}

export function eventStatusLabel(status: EventStatus) {
  if (status === 'ongoing') return '지금 진행 중';
  if (status === 'upcoming') return '곧 열려요';
  if (status === 'ended') return '종료된 행사';
  return '';
}

export function shortenTourText(value: string, max = 220) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const sliced = text.slice(0, max);
  const cut = Math.max(sliced.lastIndexOf('다.'), sliced.lastIndexOf('.'), sliced.lastIndexOf('요.'));
  if (cut >= max * 0.45) return sliced.slice(0, cut + 1).trim();
  return `${sliced.trim()}…`;
}

export function withCopula(name: string) {
  const last = name.charCodeAt(name.length - 1);
  const hasBatchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return hasBatchim ? `${name}이에요` : `${name}예요`;
}

export function normalizeJeonnamAddress(value?: string | null) {
  return cleanTourText(value)
    .replace(/전남광주통합특별시/g, '전라남도')
    .replace(/전라남도\s+전라남도/g, '전라남도')
    .trim();
}

export function formatAdmissionFee(value?: string | null) {
  const text = cleanTourText(value);
  if (!text) return '';
  if (/^[-–—]$/.test(text)) return '';
  if (/무료|입장료\s*없음|관람료\s*없음/.test(text) && !/\d/.test(text) && text.length < 12) return '무료';
  return text;
}

export function pickAdmissionFee(fee?: string | null, hours?: string | null) {
  const direct = formatAdmissionFee(fee);
  if (direct) return { fee: direct, hours: cleanTourText(hours) };
  const hoursText = cleanTourText(hours);
  if (/무료|입장료|관람료|요금|\d+\s*원/.test(hoursText)) {
    return { fee: formatAdmissionFee(hoursText), hours: '' };
  }
  return { fee: '', hours: hoursText };
}

export function composeFestivalCopy(input: {
  city: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  overview?: string | null;
  eventPlace?: string | null;
  now?: Date;
}) {
  const period = formatEventPeriod(input.startDate, input.endDate);
  const status = eventStatus(input.startDate, input.endDate, input.now);
  const place = cleanTourText(input.eventPlace);
  const overview = shortenTourText(cleanTourText(input.overview), 320);

  const lead = status === 'ongoing' && period
    ? `${input.city}에서 지금 열리는 축제예요. ${period}까지 방문할 수 있어요.`
    : status === 'upcoming' && period
      ? `${input.city}에서 ${period} 열리는 축제예요.`
      : status === 'ended' && period
        ? `${input.city}에서 ${period} 열렸던 축제예요.`
        : `${input.city}에서 열리는 ${input.name}예요.`;

  const extras = [
    place && place !== input.city ? `${place}에서 진행됩니다.` : '',
    overview,
  ].filter(Boolean);

  return {
    teaser: lead,
    story: [lead, ...extras].join(' '),
    periodLabel: period,
    periodShort: formatEventPeriodShort(input.startDate, input.endDate),
    status,
    statusLabel: eventStatusLabel(status),
  };
}

export function composeAttractionCopy(input: {
  city: string;
  name: string;
  address?: string | null;
  overview?: string | null;
  demandLabel?: string | null;
}) {
  const overview = shortenTourText(cleanTourText(input.overview), 320);
  const address = normalizeJeonnamAddress(input.address);
  const title = input.name.startsWith(input.city) ? input.name : `${input.city} ${input.name}`;
  const lead = address
    ? `${withCopula(title)}. ${address}에 있어요.`
    : `${withCopula(`${input.city}에서 많이 찾는 ${input.name}`)}.`;
  return {
    teaser: overview ? shortenTourText(overview, 90) : lead,
    story: [overview || lead, input.demandLabel].filter(Boolean).join(' '),
  };
}
