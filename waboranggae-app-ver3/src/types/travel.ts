export type Pace = 'easy' | 'balanced' | 'full';

export type AnalysisSource = 'ollama' | 'rules';
export type CourseDataSource = 'tour-api' | 'demo';

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
export type RoutingSource = 'tmap-transit' | 'mixed' | 'estimated';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteOrigin extends RouteCoordinate {
  name: string;
  address: string;
  source: 'nominatim' | 'configured' | 'demo';
}

export interface RouteSegment {
  fromName: string;
  toName: string;
  distanceKm: number;
  totalMinutes: number;
  walkMinutes: number;
  transitMinutes: number;
  modeLabel: string;
  source: Exclude<RoutingSource, 'mixed'>;
  geometry: RouteCoordinate[];
}

export interface TravelPreferences {
  region: string;
  city: string;
  startLocation: string;
  startType: StartLocationType;
  travelDate: string | null;
  startTime: string;
  durationHours: number;
  mealPreference: MealPreference;
  pace: Pace;
  preferLocal: boolean;
  interests: Interest[];
  companions: string;
  lowMobility: boolean;
  publicTransportOnly: boolean;
  summary: string;
  confidence: number;
}

export interface WalkabilityMetrics {
  transitAccess: number;
  walkingEase: number;
  nearbyLinks: number;
}

export interface Place {
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

export interface Course {
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
  metrics: WalkabilityMetrics;
  places: Place[];
  conveniences?: ConvenienceSpot[];
  transitAccessEvidence?: TransitAccessEvidence[];
  planningSource?: CoursePlanningSource;
  validationNotes?: string[];
  origin?: RouteOrigin;
  routeSource?: RoutingSource;
  routeSegments?: RouteSegment[];
}

export interface RecommendationReason {
  headline: string;
  summary: string;
  evidence: string[];
  source: AnalysisSource;
}

export interface RankedCourse extends Course {
  fitScore: number;
  scoreBreakdown: WalkabilityMetrics;
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
