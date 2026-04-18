// Hijri date conversion via @umalqura/core (Umm al-Qura, KACST tables).
// Replaces the stale `hijri-converter` choice in the original plan.

import umalqura from '@umalqura/core';

export interface HijriDate {
  year: number;       // Hijri year (e.g. 1447)
  month: number;      // 1-12
  day: number;        // 1-29/30
  monthName: string;  // localized month name
  dayName: string;    // localized day name
}

const HIJRI_MONTHS_AR = [
  'مُحَرَّم', 'صَفَر', 'رَبِيع الأَوَّل', 'رَبِيع الآخِر',
  'جُمَادَى الأُولَى', 'جُمَادَى الآخِرَة', 'رَجَب', 'شَعْبَان',
  'رَمَضَان', 'شَوَّال', 'ذُو القَعْدَة', 'ذُو الحِجَّة',
];
const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani",
  'Jumada al-awwal', 'Jumada al-thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

export function toHijri(date: Date = new Date(), locale: 'ar' | 'en' = 'ar'): HijriDate {
  const u = umalqura(date);
  const months = locale === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN;
  return {
    year: u.hy,
    month: u.hm,
    day: u.hd,
    monthName: months[u.hm - 1] ?? String(u.hm),
    dayName: u.format('dddd', locale === 'ar' ? 'ar' : 'en'),
  };
}

/** Returns true if the given date falls in the ninth Hijri month (Ramadan). */
export function isRamadan(date: Date = new Date()): boolean {
  return umalqura(date).hm === 9;
}

/** True for the last 10 nights of Ramadan — Zakat al-Fitr reminder window. */
export function isLastTenOfRamadan(date: Date = new Date()): boolean {
  const u = umalqura(date);
  return u.hm === 9 && u.hd >= 20;
}
