// Used as FeatureSlots.HomeHeaderExtras — renders a small Hijri date badge
// under the brand title on Home.

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { theme, font, sizes } from '@/constants/theme';
import { useHijriDate } from './useHijriDate';

export function HijriDateBadge() {
  const h = useHijriDate(new Date(), 'ar');
  return (
    <Text style={styles.text}>
      {h.day} {h.monthName} {h.year}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: theme.text2,
    fontSize: sizes.sm,
    fontFamily: font.arabic,
    marginTop: 2,
    writingDirection: 'rtl',
  },
});
