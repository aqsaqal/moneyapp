import { useMemo } from 'react';
import { toHijri, type HijriDate } from './conversion';

export function useHijriDate(date: Date = new Date(), locale: 'ar' | 'en' = 'ar'): HijriDate {
  return useMemo(() => toHijri(date, locale), [date.getTime(), locale]);
}
