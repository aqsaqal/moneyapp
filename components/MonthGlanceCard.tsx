// MonthGlanceCard — compact this-month card for Home.
//
// Two lines:
//   1. SECTION LABEL: NET DIFFERENCE (color-coded)              >
//   2. +{income} in · -{expense} out
//
// Tap → opens the Insights modal where the current month is the
// rightmost column (the chart auto-scrolls to end).
// Hides itself entirely when both income and spending are zero.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { useOncePress } from '@/hooks/useOncePress';
import { kv } from '@/utils/kv';
import { formatMoney, type CurrencyCode } from '@/constants/currency';

interface Props {
  income: number;
  spending: number;
  currency: CurrencyCode;
}

export function MonthGlanceCard({ income, spending, currency }: Props) {
  const t = useT();
  const router = useRouter();
  if (income === 0 && spending === 0) return null;

  const net = income - spending;
  const netUp = net >= 0;
  const netColor = netUp ? theme.accent : theme.expense;

  // Tap → Activity → Categories view, anchored to the current month.
  // kv handoff mirrors the Insights chart's month-bar drill-down.
  // Debounced so a double-tap doesn't push the route twice while the
  // tab is finishing its focus transition.
  const onPress = useOncePress(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    kv.set('activityJumpToMonth', monthKey);
    kv.set('activityJumpToView', 'categories');
    router.push('/(tabs)/activity' as never);
  });

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('home.glance.title')}
    >
      <View style={styles.line1}>
        <Text style={styles.label}>{t('home.glance.title')}:</Text>
        <Text style={[styles.net, { color: netColor }]} numberOfLines={1}>
          {' '}{netUp ? '+' : '−'}{formatMoney(Math.abs(net), currency)}
        </Text>
        <View style={{ flex: 1 }} />
        <MaterialCommunityIcons name="chevron-right" size={16} color={theme.text3} />
      </View>
      <Text style={styles.line2} numberOfLines={1}>
        <Text style={{ color: theme.accent }}>
          +{formatMoney(income, currency)}
        </Text>
        <Text style={styles.line2Muted}> {t('home.glance.in')}  ·  </Text>
        <Text style={{ color: theme.expense }}>
          −{formatMoney(spending, currency)}
        </Text>
        <Text style={styles.line2Muted}> {t('home.glance.out')}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  line1: { flexDirection: 'row', alignItems: 'center' },
  label: {
    color: theme.text2,
    fontSize: sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  net: { fontSize: sizes.md, fontFamily: font.displayBold },
  line2: { fontSize: sizes.sm, fontFamily: font.body },
  line2Muted: { color: theme.text3 },
});
