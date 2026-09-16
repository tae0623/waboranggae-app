import { z } from 'zod';
import type { RankedCourse } from '../../../src/types/travel';
import { interestSchema } from './schemas';

const text = z.string().max(3000);
const score = z.number().min(0).max(100);
const metrics = z.object({ transitAccess: score, walkingEase: score, nearbyLinks: score });
const point = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
const step = z.object({ mode: z.enum(['walk','bus','subway','train','expressbus','ferry','other']), label: text, minutes: z.number().nonnegative(), route: text.optional(), fromStop: text.optional(), toStop: text.optional(),
  geometry: z.array(point).max(3000).optional(), stops: z.array(text).max(300).optional(), routes: z.array(text).max(30).optional() });

// Saved snapshots are user data, not trusted proof that a route was validated.
// Validate fields used by the UI; preserve additional recommendation metadata.
export const courseSnapshotSchema = z.object({
  id: z.string().min(1).max(200), city: text, title: text, subtitle: text,
  durationHours: z.number().positive().max(100), distanceKm: z.number().nonnegative(),
  walkMinutes: z.number().nonnegative(), transitMinutes: z.number().nonnegative(),
  fitScore: score, walkingScore: score, preferenceScore: score, timeFitScore: score, courseQualityScore: score,
  metrics, scoreBreakdown: metrics,
  matchedInterests: z.array(interestSchema).max(6),
  reason: z.object({ headline: text, summary: text, evidence: z.array(text).max(20), source: z.enum(['ollama','rules']) }),
  places: z.array(z.object({
    id: text, name: text, address: text, description: text, category: z.enum(['station','nature','food','cafe','market','history','culture']),
    stayMinutes: z.number().nonnegative(), arrival: text, moveLabel: text, tags: z.array(interestSchema).max(6),
    latitude: point.shape.latitude.optional(), longitude: point.shape.longitude.optional(),
    imageUrl: z.string().max(4000).optional(), transitSteps: z.array(step).max(30).optional(),
  }).passthrough()).min(1).max(40),
  origin: point.extend({ name: text, address: text, source: text }).optional(),
  routeSegments: z.array(z.object({
    fromName: text, toName: text, distanceKm: z.number().nonnegative(), totalMinutes: z.number().nonnegative(),
    walkMinutes: z.number().nonnegative(), transitMinutes: z.number().nonnegative(), modeLabel: text, instruction: text,
    source: z.enum(['kakao','estimated']), steps: z.array(step).max(30), geometry: z.array(point).max(3000),
  })).max(40).optional(),
}).passthrough().refine(value => JSON.stringify(value).length <= 95000, '저장할 코스가 너무 큽니다.')
  .transform(value => value as unknown as RankedCourse);
