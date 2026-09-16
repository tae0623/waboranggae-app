export type Pace = 'easy' | 'balanced' | 'full';

export type AnalysisSource = 'ollama' | 'rules';
export type CourseDataSource = 'tour-api' | 'kakao' | 'mixed' | 'demo';

export type Interest =
  | 'nature'
  | 'food'
  | 'cafe'
  | 'photo'
  | 'market'
  | 'history';

export type PlaceCategory =
  | 'station'
  | 'nature'
  | 'food'
  | 'cafe'
  | 'market'
  | 'history'
  | 'culture';

export type StartLocationType = 'station' | 'terminal' | 'current' | 'lodging' | 'custom';
export type MealPreference = 'auto' | 'none' | 'lunch' | 'dinner' | 'both';
export type CoursePlanningSource = 'ollama' | 'rules';
export type RoutingSource = 'kakao' | 'mixed' | 'estimated';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteOrigin extends RouteCoordinate {
  name: string;
  address: string;
  source: 'nominatim' | 'kakao' | 'configured' | 'demo' | 'places';
}

export type TransitMode = 'walk' | 'bus' | 'subway' | 'train' | 'expressbus' | 'ferry' | 'other';

/** 한 구간을 타는 방법. 버스면 노선 번호와 탑승 분을 같이 둡니다. */
export interface TransitStep {
  mode: TransitMode;
  route?: string;
  label: string;
  minutes: number;
  fromStop?: string;
  toStop?: string;
  geometry?: RouteCoordinate[];
  stops?: string[];
  routes?: string[];
}

export interface RouteSegment {
  fromName: string;
  toName: string;
  distanceKm: number;
  totalMinutes: number;
  walkMinutes: number;
  transitMinutes: number;
  /** Included in transitMinutes for old clients; not confirmed onboard or walking time. */
  unclassifiedMinutes?: number;
  modeLabel: string;
  /** 이용자에게 보여줄 구체 안내. 예: 도보 5분 → 67번 버스 16분 */
  instruction: string;
  steps: TransitStep[];
  source: Exclude<RoutingSource, 'mixed'>;
  geometry: RouteCoordinate[];
}

export interface RoutingPoint extends RouteCoordinate { name: string; }
export type TravelMode = 'walk' | 'transit';
export interface SegmentResponse { segment: RouteSegment | null; externalUrl: string; notice: string; }

export interface TravelPreferences {
  scheduleMode?: 'fixed' | 'course-first';
  /** Explicit home-card selection, not a location inferred from the device. */
  requiredContentId?: string;
  requiredPlaceName?: string;
  timeBudgetMode?: 'local' | 'door-to-door';
  region: string;
  city: string;
  startLocation: string;
  startType: StartLocationType;
  startAddress?: string;
  startLatitude?: number;
  startLongitude?: number;
  travelDate: string | null;
  travelEndDate?: string | null;
  startTime: string;
  endTime?: string;
  durationHours: number;
  mealPreference: MealPreference;
  meals?: Array<'breakfast' | 'lunch' | 'dinner'>;
  pace: Pace;
  preferLocal: boolean;
  interests: Interest[];
  companions: string;
  lowMobility: boolean;
  publicTransportOnly: boolean;
  preferredTransit?: string[];
  lodgingName?: string;
  lodgingAddress?: string;
  lodgingLatitude?: number;
  lodgingLongitude?: number;
  summary: string;
  confidence: number;
}

export interface WalkabilityMetrics {
  transitAccess: number;
  walkingEase: number;
  nearbyLinks: number;
}

/** 뚜벅이 적합도 구성 점수 (0–100). 개인화 점수와 분리합니다. */
export interface WalkingScoreBreakdown {
  walk: number;
  transit: number;
  time: number;
  transfer: number;
  distance: number;
  efficiency: number;
}

/** 최종 추천 점수 구성 (0–100). */
export interface RecommendationScoreBreakdown {
  preference: number;
  walking: number;
  timeFit: number;
  courseQuality: number;
}

/** 점수 근거로 그대로 보여줄 실측/추정 수치. */
export interface CourseScoreFacts {
  walkMinutes: number;
  transitMinutes: number;
  unclassifiedMinutes?: number;
  moveMinutes: number;
  stayMinutes: number;
  tripMinutes: number;
  transferCount: number;
  distanceKm: number;
  averageMoveMinutes: number;
  stayRatio: number;
  averageStopDistanceMeters: number | null;
}

export interface Place {
  dataSource?: 'tour-api' | 'kakao';
  placeUrl?: string;
  id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  stayMinutes: number;
  arrival: string;
  moveLabel: string;
  description: string;
  tags: Interest[];
  mapPoint: { x: number; y: number };
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  moveMinutes?: number;
  walkMinutesFromPrevious?: number;
  transitMinutesFromPrevious?: number;
  routeSource?: Exclude<RoutingSource, 'mixed'>;
  transitSteps?: TransitStep[];
}

export interface ConvenienceSpot {
  id: string;
  name: string;
  type: 'locker';
  distanceLabel: string;
  availabilityLabel: string;
  mapPoint: { x: number; y: number };
  latitude: number;
  longitude: number;
  source: 'live';
}

export interface TransitAccessEvidence {
  placeId: string;
  placeName: string;
  stopName: string;
  distanceMeters: number;
  routeCount: number | null;
  sampleRouteNumbers: string[];
  typicalIntervalMinutes: number | null;
  source: 'bus-stop' | 'bus-stop-and-route';
}

export interface CourseTimeBreakdown {
  originToFirstMinutes: number;
  betweenPlacesMinutes: number;
  stayMinutes: number;
  waitAndRestMinutes: number;
  totalMinutes: number;
  requestedMinutes?: number;
  overBudgetMinutes: number;
}

export interface Course {
  timeBudgetMode?: 'local' | 'door-to-door';
  accessTrip?: { origin: RouteOrigin; arrival: RouteOrigin; segment: RouteSegment | null; externalUrl?: string; excludedFromBudget: true };
  id: string;
  city: string;
  title: string;
  subtitle: string;
  accent: string;
  softAccent: string;
  durationHours: number;
  distanceKm: number;
  walkMinutes: number;
  transitMinutes: number;
  /** Portion of transitMinutes whose walking/waiting breakdown the provider omitted. */
  unclassifiedMinutes?: number;
  metrics: WalkabilityMetrics;
  places: Place[];
  conveniences?: ConvenienceSpot[];
  transitAccessEvidence?: TransitAccessEvidence[];
  planningSource?: CoursePlanningSource;
  validationNotes?: string[];
  origin?: RouteOrigin;
  routeSource?: RoutingSource;
  routingCheckedAt?: string;
  routeSegments?: RouteSegment[];
  timeBreakdown?: CourseTimeBreakdown;
}

export interface RecommendationReason {
  headline: string;
  summary: string;
  evidence: string[];
  source: AnalysisSource;
}

export interface RankedCourse extends Course {
  /** 최종 추천 점수. 취향 40 + 뚜벅이 35 + 시간 15 + 완성도 10 */
  fitScore: number;
  walkingScore: number;
  preferenceScore: number;
  timeFitScore: number;
  courseQualityScore: number;
  /** 하위 호환: 뚜벅이 구성 점수를 기존 3지표에 투영 */
  scoreBreakdown: WalkabilityMetrics;
  walkingBreakdown: WalkingScoreBreakdown;
  recommendationBreakdown: RecommendationScoreBreakdown;
  scoreFacts: CourseScoreFacts;
  constraintPassed: boolean;
  constraintViolations: string[];
  matchedInterests: Interest[];
  reason: RecommendationReason;
}

export interface AnalyzeResponse {
  preferences: TravelPreferences;
  source: AnalysisSource;
}

export interface RecommendResponse {
  courses: RankedCourse[];
  source: CourseDataSource;
  planningSource?: CoursePlanningSource;
  fetchedAt: string | null;
  fallbackReason?: string | null;
  tourApiConfigured?: boolean;
}

export interface ExplainRequest {
  preferences: TravelPreferences;
  course: RankedCourse;
}

export interface RegionCity {
  name: string;
  code: string;
}
