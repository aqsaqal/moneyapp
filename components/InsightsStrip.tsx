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

const MAX_CHIPS = 6;

export function InsightsStrip() {
  const t = useT();
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
            : d.deltaPct >= 0 ? '↑'
            : '↓';
        const pctLabel = d.deltaPct == null
          ? t('insights.strip.new')
          : `${d.deltaPct >= 0 ? '+' : ''}${Math.round(d.deltaPct * 100)}%`;
        const trendColor = d.deltaPct == null
          ? theme.text2
          : d.deltaPct >= 0 ? theme.expense : theme.accent;
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
