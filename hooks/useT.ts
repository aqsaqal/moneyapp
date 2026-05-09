// useT() — subscribe a component to locale changes so re-renders fire when
// the user picks a new language in Settings. Returns the bound t() function.
//
// Usage:
//   const t = useT();
//   return <Text>{t('home.recent')}</Text>;
//
// Behind the scenes:
//   - utils/i18n.ts holds the active locale + listener set
//   - this hook adds an entry to that set on mount, removes on unmount
//   - locale change → setLocale() fires → setV() → component re-renders
//     → t() reads from the new locale's dict.

import { useEffect, useState } from 'react';
import { onLocaleChange, t } from '@/utils/i18n';

export function useT() {
  const [, setV] = useState(0);
  useEffect(() => {
    return onLocaleChange(() => setV((x) => x + 1));
  }, []);
  return t;
}
