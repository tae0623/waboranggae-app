import { z } from 'zod';

export const interestSchema = z.enum(['nature', 'food', 'cafe', 'photo', 'market', 'history']);
export const startTypeSchema = z.enum(['station', 'terminal', 'current', 'lodging', 'custom']);
export const mealPreferenceSchema = z.enum(['auto', 'none', 'lunch', 'dinner', 'both']);

export const travelPreferencesSchema = z.object({
  region: z.string().min(1),
  city: z.string().min(1),
  startLocation: z.string().min(1),
  startType: startTypeSchema.default('station'),
  startAddress: z.string().min(1).max(160).optional(),
  startLatitude: z.number().min(-90).max(90).optional(),
  startLongitude: z.number().min(-180).max(180).optional(),
  travelDate: z.string().nullable(),
  travelEndDate: z.string().nullable().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('10:00'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  durationHours: z.number().min(1).max(72),
  mealPreference: mealPreferenceSchema.default('auto'),
  meals: z.array(z.enum(['breakfast', 'lunch', 'dinner'])).max(3).optional(),
  pace: z.enum(['easy', 'balanced', 'full']),
  preferLocal: z.boolean().default(false),
  interests: z.array(interestSchema).min(1).max(6),
  companions: z.string().min(1),
  lowMobility: z.boolean(),
  publicTransportOnly: z.boolean(),
  preferredTransit: z.array(z.string()).max(6).optional(),
  lodgingName: z.string().max(80).optional(),
  lodgingAddress: z.string().max(160).optional(),
  lodgingLatitude: z.number().min(-90).max(90).optional(),
  lodgingLongitude: z.number().min(-180).max(180).optional(),
  summary: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
});

export const reasonSchema = z.object({
  headline: z.string().min(1).max(60),
  summary: z.string().min(1).max(260),
  evidence: z.array(z.string().min(1).max(120)).min(2).max(4),
  source: z.literal('ollama'),
});

export type ParsedTravelPreferences = z.infer<typeof travelPreferencesSchema>;
export type ParsedReason = z.infer<typeof reasonSchema>;
