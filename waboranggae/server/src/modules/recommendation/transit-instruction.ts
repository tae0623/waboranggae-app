import { Place, TransitMode, TransitStep } from '../../../../src/types/travel';

type StopHint = {
  stopName: string;
  sampleRouteNumbers: string[];
};

function cleanName(value?: string) {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, '')
    .trim();
}

function extractBusNumber(route: string) {
  const text = route.trim();
  if (!text || /호선|지하철|열차|기차/.test(text)) return '';
  const numbered = text.match(/(\d+(?:-\d+)?[A-Za-z]?)(?:\s*번)?/);
  if (/^\d+(?:-\d+)?[A-Za-z]?$/.test(text)) return text;
  if (/\d/.test(text) && /버스|좌석|순환|지선|간선|농어촌/.test(text) && numbered) {
    return numbered[1] || '';
  }
  return '';
}

export function vehicleFromTmap(mode?: string, route?: string): Pick<TransitStep, 'mode' | 'label' | 'route'> {
  const raw = cleanName(route);
  switch (mode) {
    case 'WALK':
      return { mode: 'walk', label: '도보' };
    case 'BUS': {
      const number = extractBusNumber(raw);
      if (number) return { mode: 'bus', label: `${number}번 버스`, route: number };
      if (raw) return { mode: 'bus', label: /버스/.test(raw) ? raw : `${raw} 버스`, route: raw };
      return { mode: 'bus', label: '버스' };
    }
    case 'SUBWAY':
      return { mode: 'subway', label: raw || '지하철', route: raw || undefined };
    case 'EXPRESSBUS':
      return { mode: 'expressbus', label: raw ? `${raw} 시외·고속버스` : '시외·고속버스', route: raw || undefined };
    case 'TRAIN':
      return { mode: 'train', label: raw || '기차', route: raw || undefined };
    case 'FERRY':
      return { mode: 'ferry', label: raw || '여객선', route: raw || undefined };
    default:
      return { mode: 'other', label: raw || '대중교통', route: raw || undefined };
  }
}

export function formatTransitInstruction(steps: TransitStep[], options?: { estimated?: boolean }) {
  const visible = steps.filter((step) => step.minutes > 0);
  if (!visible.length) return options?.estimated ? '이동 시간 확인 중' : '이동';
  const prefix = options?.estimated ? '약 ' : '';
  return visible.map((step) => {
    const ride = `${step.label} ${prefix}${step.minutes}분`.replace('  ', ' ');
    if (step.mode === 'walk' || !step.fromStop || !step.toStop) return ride;
    return `${ride} · ${step.fromStop} → ${step.toStop}`;
  }).join(' → ');
}

export function stepsFromEstimate(input: {
  walkMinutes: number;
  transitMinutes: number;
  fromName?: string;
  toName?: string;
}): { instruction: string; steps: TransitStep[]; modeLabel: string } {
  if (input.transitMinutes <= 0) {
    const steps: TransitStep[] = [{ mode: 'walk', label: '도보', minutes: Math.max(1, input.walkMinutes) }];
    return { instruction: formatTransitInstruction(steps, { estimated: true }), steps, modeLabel: '도보' };
  }
  const steps: TransitStep[] = [];
  if (input.walkMinutes > 0) {
    steps.push({ mode: 'walk', label: '도보', minutes: input.walkMinutes });
  }
  steps.push({
    mode: 'bus',
    label: '버스',
    minutes: input.transitMinutes,
    fromStop: cleanName(input.fromName) || undefined,
    toStop: cleanName(input.toName) || undefined,
  });
  return {
    instruction: formatTransitInstruction(steps, { estimated: true }),
    steps,
    modeLabel: '대중교통',
  };
}

export function hintTransitFromStops(
  fromStop: StopHint | null | undefined,
  toStop: StopHint | null | undefined,
  walkMinutes: number,
  transitMinutes: number,
): { instruction: string; steps: TransitStep[] } | null {
  if (transitMinutes <= 0) return null;
  const fromRoutes = fromStop?.sampleRouteNumbers ?? [];
  const toRoutes = toStop?.sampleRouteNumbers ?? [];
  const common = fromRoutes.filter((route) => toRoutes.includes(route)).slice(0, 2);
  const routes = common.length ? common : (fromRoutes.length ? fromRoutes.slice(0, 2) : toRoutes.slice(0, 2));
  const fromName = cleanName(fromStop?.stopName);
  const toName = cleanName(toStop?.stopName);
  const steps: TransitStep[] = [];
  if (walkMinutes > 0) steps.push({ mode: 'walk', label: '도보', minutes: walkMinutes });

  if (routes.length) {
    const label = routes.length > 1
      ? `${routes.map((route) => `${route}번`).join('·')} 버스`
      : `${routes[0]}번 버스`;
    steps.push({
      mode: 'bus',
      route: routes[0],
      label,
      minutes: transitMinutes,
      fromStop: fromName || undefined,
      toStop: toName || undefined,
    });
    return { instruction: formatTransitInstruction(steps, { estimated: true }), steps };
  }

  if (fromName || toName) {
    steps.push({
      mode: 'bus',
      label: fromName && toName
        ? `버스`
        : fromName
          ? `${fromName}에서 버스`
          : `${toName} 하차 버스`,
      minutes: transitMinutes,
      fromStop: fromName || undefined,
      toStop: toName || undefined,
    });
    return { instruction: formatTransitInstruction(steps, { estimated: true }), steps };
  }

  return null;
}

export function applyStopBasedTransitHints(
  places: Place[],
  evidenceByPlaceId: Map<string, StopHint>,
  originHint?: StopHint | null,
): Place[] {
  return places.map((place, index) => {
    if (place.routeSource === 'tmap-transit' && place.transitSteps?.length) return place;
    if ((place.transitMinutesFromPrevious ?? 0) <= 0) return place;
    const fromHint = index === 0 ? originHint : evidenceByPlaceId.get(places[index - 1]!.id);
    const toHint = evidenceByPlaceId.get(place.id);
    const hinted = hintTransitFromStops(
      fromHint,
      toHint,
      place.walkMinutesFromPrevious ?? 0,
      place.transitMinutesFromPrevious ?? 0,
    );
    if (!hinted) return place;
    return {
      ...place,
      moveLabel: hinted.instruction,
      transitSteps: hinted.steps,
    };
  });
}

export function transitModeFromSteps(steps?: TransitStep[]): TransitMode {
  const ride = steps?.find((step) => step.mode !== 'walk');
  return ride?.mode ?? (steps?.some((step) => step.mode === 'walk') ? 'walk' : 'other');
}
