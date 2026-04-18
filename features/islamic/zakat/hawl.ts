// Hawl tracking — has a full lunar year passed since wealth crossed nisab?
// Per plan §4.3: detect reset if assets drop below nisab mid-year. User can
// override (scholars differ).

import umalqura from '@umalqura/core';

export interface HawlStatus {
  isComplete: boolean;
  startDate: Date;
  daysElapsed: number;
  daysRemaining: number;
  nextDueDate: Date;
}

const LUNAR_YEAR_DAYS = 354.367;

export function computeHawl(startDate: Date, today: Date = new Date()): HawlStatus {
  const start = umalqura(startDate);
  const now = umalqura(today);

  // Lunar-year-anniversary date: same Hijri month + day, year+1.
  // umalqura.UmAlQura supports addYears via static method.
  const anniversary = umalqura.$.addYears(startDate, 1);

  const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / 86_400_000);
  const daysRemaining = Math.max(0, Math.floor((anniversary.getTime() - today.getTime()) / 86_400_000));
  const isComplete = today.getTime() >= anniversary.getTime();

  return {
    isComplete,
    startDate,
    daysElapsed,
    daysRemaining,
    nextDueDate: anniversary,
  };
}

/**
 * Returns the date at which hawl reset because net wealth dropped below nisab.
 * If no such drop occurred, returns null (hawl is intact since startDate).
 */
export function detectHawlReset(
  netWealthHistory: Array<{ date: number; net: number }>,
  nisab: number,
  hawlStartDate: Date,
): Date | null {
  for (const point of netWealthHistory) {
    if (point.date <= hawlStartDate.getTime()) continue;
    if (point.net < nisab) return new Date(point.date);
  }
  return null;
}

export { LUNAR_YEAR_DAYS };
