// Offline-first prayer time calculation via adhan.
// No third-party API calls by default. User can add coordinates in settings;
// fajr/maghrib computed locally from lat/lon.
//
// adhan-js exports CalculationMethod, Coordinates, PrayerTimes; computes all
// 5 prayers + sunrise. We expose just fajr (suhoor) and maghrib (iftar).

import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import { kv } from '@/utils/kv';

export type CalcMethodId =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Tehran'
  | 'Turkey';

export interface DailyPrayerTimes {
  fajr: Date;       // suhoor end
  maghrib: Date;    // iftar
  isha: Date;
}

export function getCoords(): { lat: number; lon: number } | null {
  const j = kv.getJSON<{ lat: number; lon: number }>('islamicCoords');
  return j ?? null;
}

export function setCoords(coords: { lat: number; lon: number }): void {
  kv.setJSON('islamicCoords', coords);
}

export function getMethod(): CalcMethodId {
  return (kv.get('islamicPrayerMethod') as CalcMethodId) ?? 'UmmAlQura';
}

export function setMethod(m: CalcMethodId): void {
  kv.set('islamicPrayerMethod', m);
}

export function computePrayerTimes(date: Date = new Date()): DailyPrayerTimes | null {
  const c = getCoords();
  if (!c) return null;
  const method = (CalculationMethod as Record<CalcMethodId, () => unknown>)[getMethod()] ?? CalculationMethod.UmmAlQura;
  const params = method();
  const coords = new Coordinates(c.lat, c.lon);
  const t = new PrayerTimes(coords, date, params as never);
  return { fajr: t.fajr, maghrib: t.maghrib, isha: t.isha };
}
