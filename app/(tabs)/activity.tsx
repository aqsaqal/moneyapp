// Activity — backward-looking money. Search + category/halal filters +
// day-grouped list with swipe-to-delete + analytics-on-scroll header.
//
// v2 IA: this is v1's history.tsx + v1's more.tsx → Analytics sub-tab folded
// in as a collapsible header. Plan owns "what's coming"; Activity owns
// "what already happened."

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { TransactionRow } from '@/components/TransactionRow';
import { SearchBar } from '@/components/SearchBar';
import { StatCard, sectionStyles } from '@/components/Sections';
import { MonthlyRecap } from '@/components/MonthlyRecap';
import { FeatureSlots } from '@/features';
import {
  useTransactions,
  useDailySpend,
  useMonthTotalsByCategory,
} from '@/hooks/useAppData';
import { EXPENSE_CATEGORIES, catInfo } from '@/constants/categories';
import { dayStr, monthKey, formatMoney } from '@/utils/format';
import { kv } from '@/utils/kv';
import type { CurrencyCode } from '@/constants/currency';

export default function Activity() {
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [halalFilter, setHalalFilter] = useState<string | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);

  const txns = useTransactions({
    category: filterCat,
    search: search || undefined,
    halalStatus: halalFilter,
  });

  const grouped = useMemo(() => {
    const g = new Map<string, typeof txns>();
    txns.forEach((t) => {
      const k = dayStr(t.date);
      const arr = g.get(k) ?? [];
      arr.push(t);
      g.set(k, arr);
    });
    return Array.from(g.entries());
  }, [txns]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>Activity</Text>
        <SearchBar value={search} onChange={setSearch} placeholder="Search notes / categories" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="All" active={!filterCat} onPress={() => setFilterCat(null)} />
          {EXPENSE_CATEGORIES.slice(0, 10).map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={filterCat === c.id}
              onPress={() => setFilterCat(filterCat === c.id ? null : c.id)}
              color={c.color}
            />
          ))}
          <FeatureSlots.HistoryFilterExtras value={halalFilter} onChange={setHalalFilter} />
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AnalyticsHeader
          currency={currency}
          open={analyticsOpen}
          onToggle={() => setAnalyticsOpen((x) => !x)}
          onShareRecap={() => setRecapOpen(true)}
        />
        <FeatureSlots.ActivityHeaderExtras />
        {grouped.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {search || filterCat || halalFilter
                ? 'Nothing here yet'
                : 'Your first transaction is one tap away'}
            </Text>
            <Text style={styles.emptyHint}>
              {search || filterCat || halalFilter
                ? 'Try clearing the search or chip filter to see everything.'
                : 'Tap the + below — type "12 coffee" or hold the mic.'}
            </Text>
          </View>
        )}
        {grouped.map(([day, ts]) => (
          <View key={day} style={styles.group}>
            <Text style={styles.dayLabel}>{day}</Text>
            <View style={{ gap: 2 }}>
              {ts.map((t) => (
                <TransactionRow key={t.id} t={t} currency={currency} />
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
      <MonthlyRecap visible={recapOpen} onClose={() => setRecapOpen(false)} />
    </SafeAreaView>
  );
}

// ---- Collapsible analytics header (formerly More → Analytics sub-tab) ----

function AnalyticsHeader({
  currency,
  open,
  onToggle,
  onShareRecap,
}: {
  currency: CurrencyCode;
  open: boolean;
  onToggle: () => void;
  onShareRecap: () => void;
}) {
  const key = monthKey();
  const monthTxns = useTransactions({ monthKey: key });
  const daily = useDailySpend(key);
  const totals = useMonthTotalsByCategory(key);

  const expenses = monthTxns.filter((t) => t.type === 'expense');
  const totalSpend = expenses.reduce((s, t) => s + t.amount, 0);
  const dayCount = new Set(daily.filter((d) => d.amount > 0).map((d) => d.day)).size || 1;
  const avgDaily = totalSpend / dayCount;
  const today = new Date();
  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const projected = avgDaily * dim;

  return (
    <View style={styles.analytics}>
      <Pressable
        onPress={onToggle}
        style={styles.analyticsHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.analyticsTitle}>This month at a glance</Text>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.text2}
        />
      </Pressable>
      {open && (
        <>
          <View style={sectionStyles.statGrid}>
            <StatCard label="Avg/Day" value={formatMoney(avgDaily, currency)} />
            <StatCard label="Projected" value={formatMoney(projected, currency)} />
            <StatCard label="Total" value={formatMoney(totalSpend, currency)} />
            <StatCard label="Categories" value={String(totals.length)} />
          </View>
          <View style={{ gap: 4, marginTop: spacing.sm }}>
            {totals
              .sort((a, b) => b.total - a.total)
              .map((t) => {
                const cat = catInfo(t.category);
                const pct = totalSpend > 0 ? (t.total / totalSpend) * 100 : 0;
                return (
                  <View key={t.category} style={styles.catLine}>
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catName}>{cat.name}</Text>
                    <Text style={styles.catAmt}>{formatMoney(t.total, currency)}</Text>
                    <Text style={styles.catPct}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })}
          </View>
          <Pressable
            onPress={onShareRecap}
            style={({ pressed }) => [styles.recapBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Open monthly recap"
          >
            <MaterialCommunityIcons name="share-variant" size={16} color={theme.accent} />
            <Text style={styles.recapText}>Share this month</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ---- Filter chip ----

function FilterChip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: color ?? theme.accent, borderColor: 'transparent' },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && { color: theme.bg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: { padding: spacing.lg, gap: spacing.md },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10, // a11y: ≥44pt with the line-height; bumped from v1's 6
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  chipText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  analytics: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.md,
  },
  analyticsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  analyticsTitle: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  catLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { color: theme.text1, fontSize: sizes.sm, flex: 1 },
  catAmt: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.display },
  catPct: { color: theme.text3, fontSize: sizes.xs, marginStart: 6, width: 36, textAlign: 'right' },
  group: { gap: spacing.sm },
  dayLabel: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, textTransform: 'uppercase' },
  empty: { color: theme.text3, textAlign: 'center', marginTop: spacing.xxl },
  emptyWrap: {
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi, textAlign: 'center' },
  emptyHint: { color: theme.text3, fontSize: sizes.sm, textAlign: 'center' },
  recapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: `${theme.accent}11`,
  },
  recapText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
