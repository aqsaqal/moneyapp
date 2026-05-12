// InsightsStrip — Phase 10j.
//
// Single-line horizontal scroller of the most-changed categories this
// month vs last. Each chip shows a colored dot, the category name, and
// either ↑ +N% / ↓ −N% (when there's a baseline) or a compact "new"
// label when this is the user's first month spending in that category.
//
// Empty-states (renders null) when there are no deltas — Activity should
// stay clean for fresh users and quiet months.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { useInsights } from '@/hooks/useInsights';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import { formatMoney, type CurrencyCode } from '@/constants/currency';

const MAX_CHIPS = 6;
// Percentage swings beyond this are read as meaningless ("+20,000%") so we
// switch to an absolute label instead.
const PCT_NOISE_THRESHOLD = 5; // 500%

export function InsightsStrip() {
  const t = useT();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const { deltas } = useInsights();
  if (deltas.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={t('insights.strip.label')}
    >
      {deltas.slice(0, MAX_CHIPS).map((d) => {
        const arrow =
          d.deltaPct == null ? '•'
            : d.deltaAbs >= 0 ? '↑'
            : '↓';
        // Three labeling regimes:
        //   1. No baseline last month → "new"
        //   2. Baseline is tiny vs current ⇒ percentage is noise.
        //      Show the absolute change in money instead.
        //   3. Normal case ⇒ percentage with a +sign for growth.
        const pctIsNoisy =
          d.deltaPct != null && Math.abs(d.deltaPct) > PCT_NOISE_THRESHOLD;
        const pctLabel =
          d.deltaPct == null
            ? t('insights.strip.new')
            : pctIsNoisy
              ? `${d.deltaAbs >= 0 ? '+' : '−'}${formatMoney(Math.abs(d.deltaAbs), currency)}`
              : `${d.deltaPct >= 0 ? '+' : ''}${Math.round(d.deltaPct * 100)}%`;
        const trendColor = d.deltaPct == null
          ? theme.text2
          : d.deltaAbs >= 0 ? theme.expense : theme.accent;
        return (
          <View key={d.category} style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: d.color }]} />
            <Text style={styles.name} numberOfLines={1}>{d.name}</Text>
            <Text style={[styles.pct, { color: trendColor }]} numberOfLines={1}>
              {arrow} {pctLabel}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: theme.text1, fontSize: sizes.sm },
  pct: { fontSize: sizes.sm, fontFamily: font.bodySemi },
});
