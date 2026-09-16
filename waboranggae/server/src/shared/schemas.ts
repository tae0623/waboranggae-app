import { z } from 'zod';
import { validTravelDate } from '../../../src/domain/travelInput';

export const interestSchema = z.enum(['nature', 'food', 'cafe', 'photo', 'market', 'history']);
export const startTypeSchema = z.enum(['station', 'terminal', 'current', 'lodging', 'custom']);
export const mealPreferenceSchema = z.enum(['auto', 'none', 'lunch', 'dinner', 'both']);
export const travelDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다.').refine(validTravelDate, '실제 달력에 있는 날짜를 입력해 주세요.');

const travelPreferencesObject = z.object({
  visitedPlaces: z.array(z.object({id:z.string().min(1).max(200),name:z.string().min(1).max(160),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional()})).max(120).optional(),
  scheduleMode: z.enum(['fixed', 'course-first']).optional(),
  requiredContentId: z.string().regex(/^\d{1,20}$/).optional(),
  requiredPlaceName: z.string().min(1).max(160).optional(),
  timeBudgetMode: z.enum(['local', 'door-to-door']).optional(),
  region: z.string().min(1),
  city: z.string().min(1),
  startLocation: z.string().min(1),
  startType: startTypeSchema.default('station'),
  startAddress: z.string().min(1).max(160).optional(),
  startLatitude: z.number().min(-90).max(90).optional(),
  startLongitude: z.number().min(-180).max(180).optional(),
  travelDate: travelDateSchema.nullable(),
  travelEndDate: travelDateSchema.nullable().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('10:00'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  durationHours: z.number().min(1).max(72).default(6),
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

export const travelPreferencesSchema = travelPreferencesObject.superRefine((p,ctx)=>{
  if(p.scheduleMode==='course-first'){
    if(p.travelEndDate && p.travelDate && p.travelEndDate!==p.travelDate)
      ctx.addIssue({code:z.ZodIssueCode.custom,path:['travelEndDate'],message:'당일 여행 날짜를 선택해 주세요.'});
    if(p.endTime && (Number(p.endTime.slice(0,2))*60+Number(p.endTime.slice(3)))-(Number(p.startTime.slice(0,2))*60+Number(p.startTime.slice(3)))<60)
      ctx.addIssue({code:z.ZodIssueCode.custom,path:['endTime'],message:'종료 제한은 시작보다 1시간 이상 늦게 선택해 주세요.'});
    return;
  }
  if (!p.travelDate || !p.endTime || !p.travelEndDate) return;
  const minutes=(Date.parse(p.travelEndDate+'T'+p.endTime+':00Z')-Date.parse(p.travelDate+'T'+p.startTime+':00Z'))/60_000;
  if (minutes<60 || minutes>4320) ctx.addIssue({code:z.ZodIssueCode.custom,path:['endTime'],message:'종료 시각은 시작 후 1~72시간 이내여야 합니다.'});
});

/** Model-only extraction contract: coordinates, addresses and calendar arithmetic are not LLM tasks. */
export const analysisPreferencesSchema = travelPreferencesObject.omit({
  scheduleMode:true,visitedPlaces:true,
  requiredContentId:true,requiredPlaceName:true,
  timeBudgetMode:true,startAddress:true,startLatitude:true,startLongitude:true,travelDate:true,travelEndDate:true,endTime:true,
  lodgingName:true,lodgingAddress:true,lodgingLatitude:true,lodgingLongitude:true,meals:true,preferredTransit:true,
});

export const reasonSchema = z.object({
  headline: z.string().min(1).max(60),
  summary: z.string().min(1).max(260),
  evidence: z.array(z.string().min(1).max(120)).min(2).max(4),
  source: z.literal('ollama'),
});

export type ParsedTravelPreferences = z.infer<typeof travelPreferencesSchema>;
export type ParsedReason = z.infer<typeof reasonSchema>;
