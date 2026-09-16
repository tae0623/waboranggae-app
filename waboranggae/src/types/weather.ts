export type WeatherResult =
  | { available: false; reason: string; source: 'kma' }
  | { available: true; source: 'kma'; observedAt: string; temperature: number; precipitation: number | null; wind: number | null; condition: string; advice: string };
