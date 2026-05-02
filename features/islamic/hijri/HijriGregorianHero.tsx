// HijriGregorianHero — single line under the brand title on Home.
// Hijri large (Arabic) leading; Gregorian small/grey trailing.
//
// Phase 6 of v2: replaces v1's HijriDateBadge for the Home brand row.
// HijriDateBadge stays exported for any other islamic surface that wants
// the compact form (e.g. Plan tab header).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme, font, sizes } from '@/constants/theme';
import { useHijriDate } from './useHijriDate';

export function HijriGregorianHero() {
  const h = useHijriDate(new Date(), 'ar');
  const today = new Date();
  const greg = today.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <View style={styles.row}>
      <Text style={styles.hijri} numberOfLines={1}>
        {h.day} {h.monthName} {h.year} هـ
      </Text>
      <Text style={styles.greg}>·</Text>
      <Text style={styles.greg} numberOfLines={1}>
        {greg}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  hijri: {
    color: theme.text2,
    fontSize: sizes.md,
    fontFamily: font.arabic,
    writingDirection: 'rtl',
  },
  greg: {
    color: theme.text3,
    fontSize: sizes.xs,
    fontFamily: font.body,
  },
});
