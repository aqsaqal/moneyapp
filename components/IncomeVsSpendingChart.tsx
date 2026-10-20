// Income vs Spending — grouped vertical bars, one column per month.
// Green = income, red = spending. Plain Views (no chart library) so we
// can style + animate freely without fighting victory's coord system.
//
// Two layers:
//   - Header: large total / period subtitle
//   - Chart strip: side-by-side bar pairs, axis labels below
//   - Narrative line below the chart

import React, { useEffect, useRef } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { formatMoneyShort, type CurrencyCode } from '@/constants/currency';
import type { MonthlyFlow } from '@/hooks/useMonthlyIncomeSpending';

interface Props {
  data: MonthlyFlow[];
  currency: CurrencyCode;
  /** Available width for the whole chart card. Defaults to the Insights
   *  screen layout; the Accounts overview card passes its narrower box. */
  width?: number;
  /** Tap handler invoked with the month key — caller can drill into
   *  the Activity tab filtered to that month. Optional. */
  onPressMonth?: (monthKey: string) => void;
}

const BAR_GAP = 2;
const COL_GAP = 6;
const CHART_HEIGHT = 160;
const MIN_COL_WIDTH = 28;
const Y_AXIS_W = 64;
// Reserved height inside each col for the month-axis labels (Jul / Aug…).
// Pulled out as a constant so the y-axis labels can pad-bottom by the
// same amount, keeping the $0 tick aligned to the bar baseline.
const AXIS_LABEL_ROW = 18;

// Insights modal body padding = spacing.lg horizontal × 2; card padding
// inside that = spacing.md × 2. Estimate the inner chart width once so
// columns can flex out (when few) or scroll (when many). Subtract the
// y-axis column too.
const SCREEN_W = Dimensions.get('window').width;
const CHART_INNER_W =
  SCREEN_W - 2 * spacing.lg - 2 * spacing.md - Y_AXIS_W;

export function IncomeVsSpendingChart({ data, currency, onPressMonth, width }: Props) {
  const t = useT();
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.spending]));

  // Default-scroll the chart to its right edge (most recent month) on
  // mount and whenever the period changes. Without this each new
  // period would land showing the OLDEST month first — the opposite of
  // what the user wants — and switching from a longer period back to a
  // shorter one (where content < viewport) would leave the ScrollView
  // stranded with empty space on the right.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    // Wait a tick so the inner content has laid out, then jump to end.
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [data.length]);

  // Column width: fill the inner chart area when data is short; clamp
  // to MIN_COL_WIDTH when long so columns stay readable and the chart
  // overflows into a horizontal scroll.
  const totalGaps = Math.max(0, data.length - 1) * COL_GAP;
  const innerW = width != null ? width - 2 * spacing.md - Y_AXIS_W : CHART_INNER_W;
  const idealCol = (innerW - totalGaps) / Math.max(1, data.length);
  const colW = Math.max(MIN_COL_WIDTH, idealCol);

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalSpending = data.reduce((s, d) => s + d.spending, 0);
  // Average over MONTHS WITH ACTIVITY, not the whole window. With "All"
  // selected the window can be much longer than the user's actual
  // history; dividing by the full length understates the per-month
  // signal.
  const monthsWithData = data.filter(
    (d) => d.income > 0 || d.spending > 0,
  ).length;
  const avgSaved =
    monthsWithData > 0
      ? (totalIncome - totalSpending) / monthsWithData
      : 0;
  const narrative =
    avgSaved >= 0
      ? t('insights.spending.savePerMonth', {
          amount: formatMoneyShort(avgSaved, currency),
        })
      : t('insights.spending.overspending');

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: theme.accent }]} />
        <Text style={styles.legendText}>{t('insights.spending.income')}</Text>
        <View style={{ width: spacing.md }} />
        <View style={[styles.dot, { backgroundColor: theme.expense }]} />
        <Text style={styles.legendText}>{t('insights.spending.spending')}</Text>
      </View>

      <View style={styles.chartWithAxis}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ height: CHART_HEIGHT }}
        style={{ flex: 1 }}
      >
        <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {data.map((d, i) => {
          const incomeH = (d.income / max) * (CHART_HEIGHT - 28);
          const spendH = (d.spending / max) * (CHART_HEIGHT - 28);
          // For long periods (>12 months) only label every 3rd column
          // so single-letter glyphs don't get stacked vertically.
          const showLabel = data.length <= 12 || i % 3 === 0;
          const label = showLabel ? monthLabel(d.monthKey) : '';
          return (
            <Pressable
              key={d.monthKey}
              style={[styles.col, { width: colW }]}
              onPress={onPressMonth ? () => onPressMonth(d.monthKey) : undefined}
              accessibilityRole="button"
              accessibilityLabel={`${monthLabel(d.monthKey)}: ${t('insights.spending.income')} ${formatMoneyShort(d.income, currency)}, ${t('insights.spending.spending')} ${formatMoneyShort(d.spending, currency)}`}
            >
              {/* Bars zone: flex:1 so it always fills the column down
                  to just above the axis label. Bars themselves anchor
                  to flex-end so they grow upward from the same y. */}
              <View style={styles.barsZone}>
                <View style={styles.bars}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(2, incomeH),
                        backgroundColor: theme.accent,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(2, spendH),
                        backgroundColor: theme.expense,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.axisLabel} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
        </View>
      </ScrollView>
        {/* Y-axis: three reference labels at 0 / max/2 / max. The
            paddingBottom matches the month-label row so the $0 tick
            lands on the same baseline as the bars. */}
        <View style={styles.yAxis}>
          <View style={styles.yTickRow}>
            <View style={styles.yTick} />
            <Text style={styles.yLabel} numberOfLines={1}>{formatMoneyShort(max, currency)}</Text>
          </View>
          <View style={styles.yTickRow}>
            <View style={[styles.yTick, styles.yTickDashed]} />
            <Text style={styles.yLabel}>{formatMoneyShort(max / 2, currency)}</Text>
          </View>
          <View style={styles.yTickRow}>
            <View style={styles.yTick} />
            <Text style={styles.yLabel}>{formatMoneyShort(0, currency)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.narrative}>{narrative}</Text>
    </View>
  );
}

/** "YYYY-MM" → short month label respecting the in-app locale (not
 *  the device system locale — those can differ). */
function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const locale = require('@/utils/i18n').getLocale?.();
  try {
    return d.toLocaleString(locale, { month: 'short' });
  } catch {
    return d.toLocaleString(undefined, { month: 'short' });
  }
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: theme.text2, fontSize: sizes.sm },
  chartWithAxis: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: CHART_HEIGHT,
  },
  yAxis: {
    width: Y_AXIS_W,
    height: CHART_HEIGHT,
    paddingBottom: AXIS_LABEL_ROW,
    justifyContent: 'space-between',
    paddingLeft: 4,
  },
  yTickRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yTick: { width: 8, height: 1, backgroundColor: theme.border },
  yTickDashed: { backgroundColor: 'transparent', borderTopWidth: 1, borderTopColor: theme.border, borderStyle: 'dashed' },
  yLabel: { color: theme.text3, fontSize: 10, flexShrink: 1 },
  // Chart row uses `alignItems: 'stretch'` so every col has the SAME
  // height regardless of bar size. Inside each col we split bars and
  // axis label into separate flex zones so the labels always land at
  // the same y across all months.
  chart: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: COL_GAP,
  },
  col: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barsZone: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    justifyContent: 'center',
  },
  bar: { width: 5, borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  axisLabel: { color: theme.text3, fontSize: 10, marginTop: 4, height: 14 },
  narrative: {
    color: theme.text1,
    fontSize: sizes.md,
    fontFamily: font.bodySemi,
    lineHeight: 22,
  },
});
