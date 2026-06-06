// Net-worth detail — full-screen modal opened from MeNetWorthCard.
//
// Top:    Net worth = current total + period selector.
// Middle: Assets / Debts / Change-in-Net-Worth summary row.
// Chart:  Per-month columns. Each column shows a stacked pair of
//         (asset segment, debt segment) with the net-worth line
//         drawn through the assets-minus-debt midpoints. Matches the
//         inspiration image — assets blue, debts red, net black.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
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

const CHART_HEIGHT = 240;

export default function NetWorthDetail() {
  const t = useT();
  const router = useRouter();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [period, setPeriod] = useState<Period>(6);
  const data = useMonthlyNetWorth(period);

  const last = data.length > 0 ? data[data.length - 1] : null;
  const first = data.length > 0 ? data[0] : null;
  const deltaNet = last && first ? last.net - first.net : 0;
  const pctNet =
    first && first.net !== 0
      ? (deltaNet / Math.abs(first.net)) * 100
      : 0;
  const trendUp = deltaNet >= 0;

  // Max absolute value across the chart so both stacked sides scale to
  // the same axis. Use assets + debt for safety (debt is stored
  // positive — see refreshTodaySnapshot).
  const maxAbs = Math.max(
    1,
    ...data.flatMap((d) => [d.assets, d.debt]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t('common.close')}
        >
          <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
        </Pressable>
        <Text style={styles.title}>{t('netWorth.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((p) => {
          const active = p.value === period;
          return (
            <Pressable
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={[styles.periodBtn, active && styles.periodBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {t(p.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {data.length < 2 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="chart-line"
              size={36}
              color={theme.text3}
            />
            <Text style={styles.emptyText}>{t('netWorth.empty')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroRow}>
              <Text style={styles.heroValue}>
                {formatMoney(last!.net, currency)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Summary
                colorDot={theme.indigo}
                label={t('netWorth.assets')}
                value={formatMoney(last!.assets, currency)}
              />
              <Summary
                colorDot={theme.expense}
                label={t('netWorth.debts')}
                value={`−${formatMoney(last!.debt, currency)}`}
              />
              <Summary
                colorDot="transparent"
                label={t('netWorth.change')}
                value={`${trendUp ? '+' : '−'}${formatMoney(Math.abs(deltaNet), currency)}`}
                trail={`${trendUp ? '↑' : '↓'}${Math.abs(pctNet).toFixed(1)}%`}
                trailColor={trendUp ? theme.accent : theme.expense}
              />
            </View>

            <View style={[styles.chart, { height: CHART_HEIGHT }]}>
              {data.map((d) => {
                const half = CHART_HEIGHT / 2 - 12;
                const aH = (d.assets / maxAbs) * half;
                const dH = (d.debt / maxAbs) * half;
                return (
                  <View key={d.monthKey} style={styles.col}>
                    {/* Top half: asset bar grows UP from the baseline.
                        Fixed-height zone so the baseline lands at the
                        same Y across every column. */}
                    <View style={[styles.halfTop, { height: half }]}>
                      <View
                        style={[
                          styles.assetBar,
                          { height: Math.max(2, aH), backgroundColor: theme.indigo },
                        ]}
                      />
                    </View>
                    <View style={styles.baseline} />
                    {/* Bottom half: debt bar grows DOWN from baseline,
                        axis label sits below. */}
                    <View style={[styles.halfBot, { height: half }]}>
                      <View
                        style={[
                          styles.debtBar,
                          { height: Math.max(2, dH), backgroundColor: theme.expense },
                        ]}
                      />
                      <Text style={styles.axisLabel}>{labelOf(d.monthKey)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.legend}>
              <Legend color={theme.indigo} label={t('netWorth.assets')} />
              <Legend color={theme.expense} label={t('netWorth.debts')} />
            </View>

            <Text style={styles.footer}>
              {t('netWorth.windowMonths', { n: data.length })}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({
  colorDot,
  label,
  value,
  trail,
  trailColor,
}: {
  colorDot: string;
  label: string;
  value: string;
  trail?: string;
  trailColor?: string;
}) {
  return (
    <View style={styles.summaryCell}>
      <View style={styles.summaryLabelRow}>
        <View style={[styles.dot, { backgroundColor: colorDot }]} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <View style={styles.summaryValueRow}>
        <Text style={styles.summaryValue}>{value}</Text>
        {trail && <Text style={[styles.summaryTrail, { color: trailColor ?? theme.text3 }]}>{trail}</Text>}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/** YYYY-MM → "MM/YY" axis label (compact for many-month windows). */
function labelOf(key: string): string {
  const [y, m] = key.split('-');
  return `${m}/${y.slice(2)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  periodRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: theme.bg2,
    borderRadius: radii.pill,
    padding: 3,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  periodBtnActive: { backgroundColor: theme.accent },
  periodText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  periodTextActive: { color: theme.bg },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  empty: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: { color: theme.text3, fontSize: sizes.sm, textAlign: 'center' },
  heroRow: { gap: 2 },
  heroValue: { color: theme.text1, fontSize: 32, fontFamily: font.displayBold },
  summaryRow: { flexDirection: 'row', gap: spacing.lg },
  summaryCell: { flex: 1, gap: 4 },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryLabel: { color: theme.text2, fontSize: sizes.xs },
  summaryValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  summaryValue: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  summaryTrail: { fontSize: sizes.xs, fontFamily: font.bodySemi },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chart: { flexDirection: 'row', alignItems: 'stretch', gap: 4 },
  col: { flex: 1, alignItems: 'center' },
  halfTop: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  halfBot: { width: '100%', alignItems: 'center' },
  assetBar: { width: '70%', maxWidth: 36, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  baseline: { width: '100%', height: 1, backgroundColor: theme.border },
  debtBar: { width: '70%', maxWidth: 36, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  axisLabel: { color: theme.text3, fontSize: 10, marginTop: 4 },
  legend: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: theme.text2, fontSize: sizes.sm },
  footer: { color: theme.text3, fontSize: sizes.xs, textAlign: 'center', marginTop: spacing.md },
});
