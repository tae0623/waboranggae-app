import { z } from 'zod';

export const interestSchema = z.enum(['nature', 'food', 'cafe', 'photo', 'market', 'history']);
export const startTypeSchema = z.enum(['station', 'terminal', 'current', 'lodging']);

export const travelPreferencesSchema = z.object({
  region: z.string().min(1),
  city: z.string().min(1),
  startLocation: z.string().min(1),
  startType: startTypeSchema.default('station'),
  travelDate: z.string().nullable(),
  durationHours: z.number().min(2).max(12),
  pace: z.enum(['easy', 'balanced', 'full']),
  preferLocal: z.boolean().default(false),
  interests: z.array(interestSchema).min(1).max(6),
  companions: z.string().min(1),
  lowMobility: z.boolean(),
  wantsLuggageStorage: z.boolean(),
  publicTransportOnly: z.boolean(),
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
