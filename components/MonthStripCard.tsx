// MonthStripCard — "where in the month did the money go".
//
// Replaces MonthGlanceCard's two-line in/out summary with the same two
// totals plus thirty thin bars of daily spending and a today marker.
// Tap → Activity (Categories view, current month). Hides itself when
// the month has no income and no spending.

import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { useOncePress } from '@/hooks/useOncePress';
import { useDailySpend } from '@/hooks/useAppData';
import { kv } from '@/utils/kv';
import { formatMoney, type CurrencyCode } from '@/constants/currency';

interface Props {
  monthKey: string;
  income: number;
  spending: number;
  currency: CurrencyCode;
}

const CHART_H = 44;

export function MonthStripCard({ monthKey, income, spending, currency }: Props) {
  const t = useT();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const daily = useDailySpend(monthKey);
  // Hooks above the early return (profile switch into an empty profile
  // must not change the hook count between renders).
  const onPress = useOncePress(() => {
    kv.set('activityJumpToMonth', monthKey);
    kv.set('activityJumpToView', 'categories');
    router.push('/(tabs)/activity' as never);
  });

  if (income === 0 && spending === 0) return null;

  const net = income - spending;
  const netUp = net >= 0;
  const today = new Date().getDate();
  const dim = daily.length || 30;
  const max = Math.max(1, ...daily.map((d) => d.amount));
  // Card sits inside the screen's horizontal padding and has its own.
  const chartW = Math.max(120, width - spacing.lg * 2 - spacing.md * 2);
  const gap = 2;
  const barW = (chartW - gap * (dim - 1)) / dim;

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('home.glance.title')}: ${netUp ? '+' : '−'}${formatMoney(Math.abs(net), currency)}. ${formatMoney(income, currency)} ${t('home.glance.in')}, ${formatMoney(spending, currency)} ${t('home.glance.out')}`}
    >
      <View style={styles.head}>
        <Text style={styles.label}>{t('home.glance.title')}</Text>
        <Text style={[styles.net, { color: netUp ? theme.accent : theme.expense }]} numberOfLines={1}>
          {netUp ? '+' : '−'}{formatMoney(Math.abs(net), currency)}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color={theme.text3} />
      </View>
      <Svg width={chartW} height={CHART_H} accessibilityElementsHidden importantForAccessibility="no">
        {daily.map((d, i) => {
          const h = d.amount > 0 ? Math.max(2, (d.amount / max) * (CHART_H - 4)) : 2;
          const future = d.day > today;
          return (
            <Rect
              key={d.day}
              x={i * (barW + gap)}
              y={CHART_H - h}
              width={barW}
              height={h}
              rx={1}
              fill={future ? theme.bg3 : d.day === today ? theme.text1 : theme.expense}
              opacity={future ? 0.6 : d.day === today ? 1 : 0.75}
            />
          );
        })}
        {today <= dim && (
          <Line
            x1={(today - 1) * (barW + gap) + barW / 2}
            x2={(today - 1) * (barW + gap) + barW / 2}
            y1={0}
            y2={CHART_H}
            stroke={theme.text2}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </Svg>
      <View style={styles.foot}>
        <Text style={styles.footText}>
          <Text style={{ color: theme.accent }}>+{formatMoney(income, currency)}</Text> {t('home.glance.in')}
          {'  ·  '}
          <Text style={{ color: theme.expense }}>−{formatMoney(spending, currency)}</Text> {t('home.glance.out')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    flex: 1,
    color: theme.text2,
    fontSize: sizes.xs,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  net: { fontSize: sizes.md, fontFamily: font.displayBold },
  foot: { flexDirection: 'row' },
  footText: { color: theme.text3, fontSize: sizes.xs },
});
