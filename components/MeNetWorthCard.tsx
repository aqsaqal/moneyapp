// Net-worth card for the Me tab.
//
// Layout (top → bottom):
//   - "Net worth" label + period selector (3m / 6m / 1y / All)
//   - Subtitle: "+$X over last 6 months (↑Y%)"
//   - Single-line chart of monthly endpoints (victory-native).
//   - Tap anywhere on the card → opens /net-worth full-screen detail.
//
// Excludes archived + include_in_total=false accounts already via the
// snapshot writer (refreshTodaySnapshot).

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { useMonthlyNetWorth } from '@/hooks/useMonthlyNetWorth';

type Period = 3 | 6 | 12 | 96;

const PERIOD_OPTIONS: { value: Period; labelKey: string }[] = [
  { value: 3, labelKey: 'netWorth.period.3m' },
  { value: 6, labelKey: 'netWorth.period.6m' },
  { value: 12, labelKey: 'netWorth.period.1y' },
  { value: 96, labelKey: 'netWorth.period.all' },
];

export function MeNetWorthCard() {
  const t = useT();
  const router = useRouter();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [period, setPeriod] = useState<Period>(6);
  const data = useMonthlyNetWorth(period);

  if (data.length < 2) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push('/net-worth' as never)}
        accessibilityRole="button"
        accessibilityLabel={t('netWorth.title')}
      >
        <Text style={styles.label}>{t('netWorth.title')}</Text>
        <Text style={styles.empty}>{t('netWorth.empty')}</Text>
      </Pressable>
    );
  }

  const first = data[0].net;
  const last = data[data.length - 1].net;
  // Latest snapshot exposes the asset / debt split for the same date
  // — surfaced inline so the user doesn't need a second card for it.
  const lastAssets = data[data.length - 1].assets;
  const lastDebt = data[data.length - 1].debt;
  const delta = last - first;
  const trendUp = delta >= 0;
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;

  const points = data.map((d, i) => ({ i, net: d.net }));

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push('/net-worth' as never)}
      accessibilityRole="button"
      accessibilityLabel={t('netWorth.title')}
    >
      <View style={styles.headRow}>
        <View>
          <Text style={styles.label}>{t('netWorth.title')}</Text>
          <Text style={styles.value}>{formatMoney(last, currency)}</Text>
        </View>
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((p) => {
            const active = p.value === period;
            return (
              <Pressable
                key={p.value}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setPeriod(p.value);
                }}
                style={[styles.periodBtn, active && styles.periodBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                hitSlop={4}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>
                  {t(p.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.subRow}>
        <MaterialCommunityIcons
          name={trendUp ? 'trending-up' : 'trending-down'}
          size={14}
          color={trendUp ? theme.accent : theme.expense}
        />
        <Text style={[styles.delta, { color: trendUp ? theme.accent : theme.expense }]}>
          {trendUp ? '+' : '−'}
          {formatMoney(Math.abs(delta), currency)}{' '}
          ({trendUp ? '↑' : '↓'}{Math.abs(pct).toFixed(1)}%)
        </Text>
        <Text style={styles.subTail}>
          {' '}{t('netWorth.subtitle.actual', { n: data.length })}
        </Text>
      </View>

      <View style={styles.splitRow}>
        <Text style={styles.splitLabel}>
          {t('netWorth.assets')}{' '}
          <Text style={[styles.splitValue, { color: theme.accent }]}>
            {formatMoney(lastAssets, currency)}
          </Text>
        </Text>
        <Text style={styles.splitDot}> · </Text>
        <Text style={styles.splitLabel}>
          {t('netWorth.debts')}{' '}
          <Text
            style={[
              styles.splitValue,
              { color: lastDebt > 0 ? theme.expense : theme.text2 },
            ]}
          >
            {formatMoney(lastDebt, currency)}
          </Text>
        </Text>
      </View>

      <View style={styles.chartWrap}>
        <CartesianChart
          data={points}
          xKey="i"
          yKeys={['net']}
          domainPadding={{ top: 12, bottom: 12 }}
        >
          {({ points: cp, chartBounds }) => (
            <>
              <Area
                points={cp.net}
                y0={chartBounds.bottom}
                color={trendUp ? `${theme.accent}33` : `${theme.expense}33`}
                animate={{ type: 'timing', duration: 300 }}
              />
              <Line
                points={cp.net}
                color={trendUp ? theme.accent : theme.expense}
                strokeWidth={2}
                animate={{ type: 'timing', duration: 300 }}
              />
            </>
          )}
        </CartesianChart>
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
    gap: spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold, marginTop: 2 },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: theme.bg3,
    borderRadius: radii.pill,
    padding: 2,
    gap: 2,
  },
  periodBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  periodBtnActive: { backgroundColor: theme.accent },
  periodText: { color: theme.text2, fontSize: 11, fontFamily: font.bodySemi },
  periodTextActive: { color: theme.bg },
  subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  splitRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  splitLabel: { color: theme.text3, fontSize: sizes.sm },
  splitValue: { color: theme.text1, fontFamily: font.bodySemi },
  splitDot: { color: theme.text3, fontSize: sizes.sm },
  delta: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  subTail: { color: theme.text3, fontSize: sizes.sm },
  chartWrap: { height: 120 },
  empty: { color: theme.text3, fontSize: sizes.sm, marginTop: 4 },
});
