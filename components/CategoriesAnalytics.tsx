// CategoriesAnalytics — Activity tab's Categories view.
//
// Aggregates spend / income for a selected period × account by category,
// renders a horizontal-bar list sorted by amount. A single tappable
// header above the list switches between Expense and Income; arrows
// step the period; a date label opens the existing period sheet.
//
// Why bars over a pie: the spec says pick one. Bars are easier to scan
// in a long list and don't waste vertical space on legend chases.
//
// FX: each transaction is converted into the user's display currency
// using the present FX rate cache. The spec asks for "transaction-time
// FX" but we don't store historical rates per transaction — the cache
// is shared. Same-currency rows are exact; cross-currency rows are
// approximate (matches the rest of the app's behaviour). Transfers
// and the 'adjustment' system category are excluded; archived
// categories with activity in the period are included.

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { useTransactions, useCategoriesWithMeta } from '@/hooks/useAppData';
import { catInfo } from '@/constants/categories';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { convert } from '@/utils/fx';
import type { Transaction } from '@/utils/db/schema';

export type AnalyticsType = 'expense' | 'income';

export interface CategoriesAnalyticsProps {
  /** Inclusive start (epoch ms). */
  rangeStart: number;
  /** Exclusive end (epoch ms). */
  rangeEnd: number;
  /** Human label for the period bar — usually the month name. */
  periodLabel: string;
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  onPickPeriod: () => void;
  /** null = all accounts; otherwise filter to one account. */
  accountId: string | null;
  /** Display currency — the user's primary, from kv.currency. */
  currency: CurrencyCode;
  /** When the user taps a category row, the parent should switch back
   *  to List view with this category prefilled. */
  onSelectCategory: (categoryId: string) => void;
}

interface Row {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
}

export function CategoriesAnalytics({
  rangeStart,
  rangeEnd,
  periodLabel,
  onPrevPeriod,
  onNextPeriod,
  onPickPeriod,
  accountId,
  currency,
  onSelectCategory,
}: CategoriesAnalyticsProps) {
  const t = useT();
  const [type, setType] = useState<AnalyticsType>('expense');

  // Pull every tx in the window in one shot — bounded by useTransactions'
  // safety limit of 200, so we pass an explicit larger cap for analytics.
  const txns = useTransactions({
    dateGt: rangeStart - 1,        // dateGt is exclusive; -1 makes start inclusive
    dateLte: rangeEnd - 1,         // exclude rangeEnd itself
    accountId: accountId ?? undefined,
    limit: 10_000,
  });
  const categories = useCategoriesWithMeta();

  // Aggregate: for each category, sum the txns of the active type
  // (expense or income), converted into the display currency. Transfers
  // and the system 'adjustment' category are skipped per the spec.
  const { rowsForType, otherTotal } = useMemo(() => {
    const sums = new Map<string, number>();
    let other = 0;
    for (const x of txns) {
      if (x.type === 'transfer') continue;
      if (x.category === 'adjustment') continue;
      const txCcy = (x.originalCurrency as CurrencyCode | null) ?? currency;
      const txAmt = x.originalAmount ?? x.amount;
      const inDisplay = convert(txAmt, txCcy, currency);
      if (x.type === type) {
        const key = x.category ?? (type === 'expense' ? 'other' : 'other_in');
        sums.set(key, (sums.get(key) ?? 0) + inDisplay);
      } else if (x.type === (type === 'expense' ? 'income' : 'expense')) {
        other += inDisplay;
      }
    }
    const rows: Row[] = [];
    for (const [catId, total] of sums.entries()) {
      const meta = categories.find((c) => c.id === catId);
      // Fall back through catInfo() so archived/seeded categories still
      // render with icon + color rather than a stub.
      const info = catInfo(catId, type);
      rows.push({
        categoryId: catId,
        name: meta?.name ?? info.name,
        icon: meta?.icon ?? info.icon,
        color: meta?.color ?? info.color,
        total,
      });
    }
    rows.sort((a, b) => b.total - a.total);
    return { rowsForType: rows, otherTotal: other };
  }, [txns, type, categories, currency]);

  const total = rowsForType.reduce((s, r) => s + r.total, 0);
  const headlineColor = type === 'expense' ? theme.expense : theme.accent;
  // The "other side" sub line gets the opposite type's color so a
  // glance at the headline card communicates both flows. Income
  // always reads green, expense always reads red.
  const otherColor = type === 'expense' ? theme.accent : theme.expense;
  const empty = rowsForType.length === 0;

  return (
    <View style={styles.wrap}>
      {/* Period selector — arrows + tappable date label */}
      <View style={styles.periodRow}>
        <Pressable onPress={onPrevPeriod} hitSlop={8} style={styles.periodArrow}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={theme.text2} />
        </Pressable>
        <Pressable onPress={onPickPeriod} style={styles.periodLabel} accessibilityRole="button">
          <Text style={styles.periodLabelText}>{periodLabel}</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={theme.text2} />
        </Pressable>
        <Pressable onPress={onNextPeriod} hitSlop={8} style={styles.periodArrow}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.text2} />
        </Pressable>
      </View>

      {/* Type toggle — tap the headline block to flip between Expense
          and Income. The 'other' side shows muted below so the user
          knows the toggle is bidirectional. */}
      <Pressable
        onPress={() => setType((p) => (p === 'expense' ? 'income' : 'expense'))}
        style={styles.headlineCard}
        accessibilityRole="button"
        accessibilityLabel={t(type === 'expense' ? 'analytics.expense' : 'analytics.income')}
      >
        <Text style={styles.headlineLabel}>
          {t(type === 'expense' ? 'analytics.expense' : 'analytics.income').toUpperCase()}
        </Text>
        <Text style={[styles.headlineAmount, { color: headlineColor }]}>
          {formatMoney(total, currency)}
        </Text>
        <Text style={[styles.headlineSub, { color: otherColor }]}>
          {t(type === 'expense' ? 'analytics.income' : 'analytics.expense')}
          {' · '}
          {formatMoney(otherTotal, currency)}
        </Text>
      </Pressable>

      <Text style={styles.sectionLabel}>{t('analytics.breakdown')}</Text>

      {empty ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="chart-bar" size={32} color={theme.text3} />
          <Text style={styles.emptyText}>{t('analytics.empty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {rowsForType.map((r) => {
            const pct = total > 0 ? (r.total / total) * 100 : 0;
            return (
              <Pressable
                key={r.categoryId}
                onPress={() => onSelectCategory(r.categoryId)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}, ${formatMoney(r.total, currency)}, ${pct.toFixed(0)}%`}
              >
                <View style={styles.rowHead}>
                  <View style={[styles.iconBox, { backgroundColor: `${r.color}22` }]}>
                    <MaterialCommunityIcons name={r.icon as never} size={16} color={r.color} />
                  </View>
                  <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.rowAmount}>{formatMoney(r.total, currency)}</Text>
                  <Text style={styles.rowPct}>{pct.toFixed(0)}%</Text>
                </View>
                {/* Horizontal bar — width proportional to share of total */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(2, pct)}%`, backgroundColor: r.color },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  periodArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg2,
  },
  periodLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: theme.bg2,
  },
  periodLabelText: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  headlineCard: {
    alignItems: 'center',
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 4,
  },
  headlineLabel: {
    color: theme.text3,
    fontSize: sizes.xs,
    letterSpacing: 0.8,
    fontFamily: font.bodySemi,
  },
  headlineAmount: { fontSize: 36, fontFamily: font.displayBold },
  headlineSub: { color: theme.text3, fontSize: sizes.sm, marginTop: 4 },
  sectionLabel: {
    color: theme.text3,
    fontSize: sizes.xs,
    letterSpacing: 0.8,
    fontFamily: font.bodySemi,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.xl,
  },
  emptyText: { color: theme.text3, fontSize: sizes.sm },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, color: theme.text1, fontSize: sizes.md },
  rowAmount: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.bodySemi },
  rowPct: { color: theme.text3, fontSize: sizes.xs, width: 40, textAlign: 'right' },
  barTrack: {
    marginTop: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.bg2,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
});
