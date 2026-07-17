import { parseTravelText } from '../domain/demoEngine';
import { rankCourses } from '../domain/demoEngine';
import {
  AnalyzeResponse,
  ExplainRequest,
  RecommendationReason,
  RecommendResponse,
  TravelPreferences,
} from '../types/travel';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

async function fetchJson<T>(path: string, body: unknown): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('AI server is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`AI server returned ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeTravelRequest(query: string): Promise<AnalyzeResponse> {
  try {
    return await fetchJson('/api/analyze', { query });
  } catch {
    return { preferences: parseTravelText(query), source: 'rules' };
  }
}

export async function recommendCourses(preferences: TravelPreferences): Promise<RecommendResponse> {
  try {
    return await fetchJson('/api/recommend', { preferences });
  } catch {
    return { courses: rankCourses(preferences), source: 'demo', fetchedAt: null };
  }
}

export async function generateRecommendationReason(request: ExplainRequest): Promise<RecommendationReason> {
  try {
    const response = await fetchJson<{ reason: RecommendationReason }>('/api/explain', request);
    return response.reason;
  } catch {
    return request.course.reason;
  }
}
