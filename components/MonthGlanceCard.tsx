// MonthGlanceCard — read-only "this month at a glance" block for Home.
//
// Two horizontal bars side-by-side (income green / spending red) with
// values, then a single net-difference line. No period selector, no
// chart, no tap target — this is a status surface, not navigation.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { useT } from '@/hooks/useT';
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
  // Hide when there's literally nothing to show — the card is meant
  // to confirm at-a-glance state, not announce zeros.
  if (income === 0 && spending === 0) return null;

  const max = Math.max(income, spending, 1);
  const incomeRatio = income / max;
  const spendRatio = spending / max;
  const net = income - spending;

  // Tap → Activity → Categories view, anchored to the current month.
  // kv handoff matches the pattern used by the Insights chart for
  // its month-bar drill-down.
  const onPress = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    kv.set('activityJumpToMonth', monthKey);
    kv.set('activityJumpToView', 'categories');
    router.push('/(tabs)/activity' as never);
  };

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('home.glance.title')}
    >
      <View style={styles.titleRow}>
        <Text style={styles.label}>{t('home.glance.title')}</Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color={theme.text3} />
      </View>

      <View style={styles.row}>
        <Text style={styles.legend}>{t('home.glance.income')}</Text>
        <Text style={styles.value}>{formatMoney(income, currency)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.bar, { width: `${incomeRatio * 100}%`, backgroundColor: theme.accent }]}
        />
      </View>

      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <Text style={styles.legend}>{t('home.glance.spending')}</Text>
        <Text style={styles.value}>{formatMoney(spending, currency)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.bar, { width: `${spendRatio * 100}%`, backgroundColor: theme.expense }]}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.legend}>{t('home.glance.diff')}</Text>
        <Text
          style={[
            styles.value,
            { color: net >= 0 ? theme.accent : theme.expense },
          ]}
        >
          {net >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(net), currency)}
        </Text>
      </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  label: {
    color: theme.text2,
    fontSize: sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legend: { color: theme.text3, fontSize: sizes.sm },
  value: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.bg3,
    overflow: 'hidden',
  },
  bar: { height: 6, borderRadius: 3 },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: spacing.sm,
  },
});
