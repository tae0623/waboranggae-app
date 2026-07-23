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

export type StartLocationType = 'station' | 'terminal' | 'current' | 'lodging';

export interface TravelPreferences {
  region: string;
  city: string;
  startLocation: string;
  startType: StartLocationType;
  travelDate: string | null;
  durationHours: number;
  pace: Pace;
  preferLocal: boolean;
  interests: Interest[];
  companions: string;
  lowMobility: boolean;
  wantsLuggageStorage: boolean;
  publicTransportOnly: boolean;
  summary: string;
  confidence: number;
}

export interface WalkabilityMetrics {
  transitAccess: number;
  walkingEase: number;
  nearbyLinks: number;
  convenience: number;
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
}

export interface ConvenienceSpot {
  id: string;
  name: string;
  type: 'locker' | 'bike' | 'restroom';
  distanceLabel: string;
  availabilityLabel: string;
  mapPoint: { x: number; y: number };
  latitude?: number;
  longitude?: number;
  source?: 'live' | 'demo';
  remaining?: number | null;
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
  conveniences: ConvenienceSpot[];
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
  fetchedAt: string | null;
}

export interface ExplainRequest {
  preferences: TravelPreferences;
  course: RankedCourse;
}

export interface RegionCity {
  name: string;
  code: string;
}
