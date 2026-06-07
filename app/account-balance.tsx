// Full-screen balance history for a single account.
// Reached by tapping the chart card on the account detail screen.

import React, { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CartesianChart, Line, Area } from 'victory-native';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { useAccounts } from '@/hooks/useAppData';
import { useAccountBalanceHistory } from '@/hooks/useAccountBalanceHistory';

type Period = 3 | 6 | 12 | 96;
const PERIODS: { v: Period; k: string }[] = [
  { v: 3, k: '3m' },
  { v: 6, k: '6m' },
  { v: 12, k: '1y' },
  { v: 96, k: 'all' },
];

export default function AccountBalanceDetail() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const accounts = useAccounts({ includeArchived: true });
  const account = accounts.find((a) => a.id === id);
  const [period, setPeriod] = useState<Period>(6);
  const history = useAccountBalanceHistory(id, period);

  const ac = (account?.currency as CurrencyCode | null | undefined)
    ?? ((kv.get('currency') ?? 'USD') as CurrencyCode);

  const series = useMemo(
    () => history.map((p, i) => ({ i, bal: p.balance })),
    [history],
  );
  const first = history[0]?.balance ?? 0;
  const last = history[history.length - 1]?.balance ?? 0;
  const delta = last - first;
  const up = delta >= 0;
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
  const minBal = history.length > 0
    ? history.reduce((m, p) => (p.balance < m ? p.balance : m), history[0].balance)
    : 0;
  const maxBal = history.length > 0
    ? history.reduce((m, p) => (p.balance > m ? p.balance : m), history[0].balance)
    : 0;
  const periodKey: '3m' | '6m' | '1y' | 'all' =
    period === 3 ? '3m' : period === 6 ? '6m' : period === 12 ? '1y' : 'all';
  const chartHeight = Math.round(Dimensions.get('window').height * 0.55);

  if (!account) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.empty}>{t('account.notFound')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
        </Pressable>
        <Text style={styles.title}>{account.name}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.periodPills}>
        {PERIODS.map(({ v, k }) => {
          const active = v === period;
          return (
            <Pressable
              key={k}
              onPress={() => setPeriod(v)}
              style={[styles.periodPill, active && styles.periodPillActive]}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {t(`netWorth.period.${k}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>{t('account.chart.title')}</Text>
        <Text style={styles.value}>{formatMoney(last, ac)}</Text>
        {history.length >= 2 && (
          <View style={styles.deltaRow}>
            <MaterialCommunityIcons
              name={up ? 'trending-up' : 'trending-down'}
              size={14}
              color={up ? theme.accent : theme.expense}
            />
            <Text style={[styles.delta, { color: up ? theme.accent : theme.expense }]}>
              {up ? '+' : '−'}{formatMoney(Math.abs(delta), ac)}{' '}
              ({up ? '↑' : '↓'}{Math.abs(pct).toFixed(1)}%)
            </Text>
            <Text style={styles.deltaTail}>
              {' '}{t(`account.chart.subtitle.${periodKey}`)}
            </Text>
          </View>
        )}

        {series.length >= 2 ? (
          <>
            <View style={{ flexDirection: 'row', height: chartHeight }}>
              <View style={{ flex: 1 }}>
                <CartesianChart
                  data={series}
                  xKey="i"
                  yKeys={['bal']}
                  domainPadding={{ top: 12, bottom: 12 }}
                >
                  {({ points: cp, chartBounds }) => (
                    <>
                      <Area
                        points={cp.bal}
                        y0={chartBounds.bottom}
                        color={`${account.color}33`}
                        animate={{ type: 'timing', duration: 300 }}
                      />
                      <Line
                        points={cp.bal}
                        color={account.color}
                        strokeWidth={2}
                        animate={{ type: 'timing', duration: 300 }}
                      />
                    </>
                  )}
                </CartesianChart>
              </View>
              {/* Y-axis: max / mid / min labels with short ticks */}
              <View style={styles.yAxis}>
                <View style={styles.yTickRow}>
                  <View style={styles.yTick} />
                  <Text style={styles.yLabel} numberOfLines={1}>{formatMoney(maxBal, ac)}</Text>
                </View>
                <View style={styles.yTickRow}>
                  <View style={[styles.yTick, styles.yTickDashed]} />
                  <Text style={styles.yLabel} numberOfLines={1}>{formatMoney((maxBal + minBal) / 2, ac)}</Text>
                </View>
                <View style={styles.yTickRow}>
                  <View style={styles.yTick} />
                  <Text style={styles.yLabel} numberOfLines={1}>{formatMoney(minBal, ac)}</Text>
                </View>
              </View>
            </View>

            {/* Context block: min / max / change % */}
            <View style={styles.statRow}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{t('account.chart.min')}</Text>
                <Text style={styles.statValue}>{formatMoney(minBal, ac)}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{t('account.chart.max')}</Text>
                <Text style={styles.statValue}>{formatMoney(maxBal, ac)}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>{t('account.chart.change')}</Text>
                <Text style={[styles.statValue, { color: up ? theme.accent : theme.expense }]}>
                  {up ? '+' : '−'}{Math.abs(pct).toFixed(1)}%
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="chart-line" size={32} color={theme.text3} />
            <Text style={styles.empty}>{t('account.chart.empty')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
  periodPills: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: theme.bg2,
    borderRadius: radii.pill,
    padding: 3,
  },
  periodPill: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radii.pill },
  periodPillActive: { backgroundColor: theme.accent },
  periodText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  periodTextActive: { color: theme.bg },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  label: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: theme.text1, fontSize: 32, fontFamily: font.displayBold },
  deltaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  delta: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  deltaTail: { color: theme.text3, fontSize: sizes.sm },
  empty: { color: theme.text3, fontSize: sizes.sm, padding: spacing.xl, textAlign: 'center' },
  emptyBox: { padding: spacing.xl, alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  yAxis: { width: 76, paddingLeft: 6, justifyContent: 'space-between' },
  yTickRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yTick: { width: 6, height: 1, backgroundColor: theme.border },
  yTickDashed: { backgroundColor: 'transparent', borderTopWidth: 1, borderTopColor: theme.border, borderStyle: 'dashed' },
  yLabel: { color: theme.text3, fontSize: 10, flexShrink: 1 },
  statRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  statCell: { flex: 1, gap: 2 },
  statLabel: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
});
