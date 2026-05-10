// NetWorthChart — Phase 10p.
//
// Reads daily snapshots from net_worth_snapshots and renders a single-line
// chart of net worth over time. Snapshots accumulate one row per day at
// app boot, so a brand-new install shows the empty-state copy until the
// user has at least 2 days of history.
//
// Uses Victory Native XL (already in deps via MiniTrendChart).

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { recentSnapshots } from '@/utils/netWorthSnapshot';
import { formatMoney } from '@/utils/format';
import { kv } from '@/utils/kv';
import { useT } from '@/hooks/useT';
import { useTransactions } from '@/hooks/useAppData';
import type { CurrencyCode } from '@/constants/currency';

interface ChartPoint {
  i: number;
  net: number;
  [k: string]: number;
}

export function NetWorthChart({ height = 140 }: { height?: number }) {
  const t = useT();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // Subscribe to bumps so snapshots taken mid-session refresh the chart.
  const _bump = useTransactions({ limit: 1 });
  void _bump;

  const data = useMemo<ChartPoint[]>(() => {
    const rows = recentSnapshots(90);
    return rows.map((r, i) => ({ i, net: r.net }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_bump.length]);

  if (data.length < 2) {
    return (
      <View style={[styles.wrap, { height }]}>
        <Text style={styles.empty}>{t('insights.netWorth.empty')}</Text>
      </View>
    );
  }

  const latest = data[data.length - 1].net;
  const earliest = data[0].net;
  const delta = latest - earliest;
  const trendUp = delta >= 0;

  return (
    <View style={styles.container}>
      <View style={styles.headRow}>
        <View>
          <Text style={styles.label}>{t('insights.netWorth.title')}</Text>
          <Text style={styles.value}>{formatMoney(latest, currency)}</Text>
        </View>
        <Text style={[styles.delta, { color: trendUp ? theme.accent : theme.expense }]}>
          {trendUp ? '↑' : '↓'} {formatMoney(Math.abs(delta), currency)}
        </Text>
      </View>
      <View style={[styles.wrap, { height }]}>
        <CartesianChart
          data={data}
          xKey="i"
          yKeys={['net']}
          padding={{ left: 4, right: 4, top: 4, bottom: 4 }}
        >
          {({ points, chartBounds }) => (
            <>
              <Area
                points={points.net}
                y0={chartBounds.bottom}
                color={trendUp ? `${theme.accent}33` : `${theme.expense}33`}
                animate={{ type: 'timing', duration: 300 }}
              />
              <Line
                points={points.net}
                color={trendUp ? theme.accent : theme.expense}
                strokeWidth={2}
                animate={{ type: 'timing', duration: 300 }}
              />
            </>
          )}
        </CartesianChart>
      </View>
      <Text style={styles.caption}>
        {t('insights.netWorth.window', { n: data.length })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.sm,
  },
  wrap: { width: '100%' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold, marginTop: 2 },
  delta: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  caption: { color: theme.text3, fontSize: sizes.xs },
  empty: {
    color: theme.text3,
    fontSize: sizes.sm,
    textAlign: 'center',
    marginVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});
