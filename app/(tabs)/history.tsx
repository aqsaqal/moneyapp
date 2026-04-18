// History — ports v4 HistView (lines 546-558). Search + category filter chips +
// swipe-to-delete + halal filter chip (via FeatureSlots).

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { TransactionRow } from '@/components/TransactionRow';
import { SearchBar } from '@/components/SearchBar';
import { FeatureSlots } from '@/features';
import { useTransactions } from '@/hooks/useAppData';
import { EXPENSE_CATEGORIES, catInfo } from '@/constants/categories';
import { dayStr } from '@/utils/format';
import { kv } from '@/utils/kv';
import type { CurrencyCode } from '@/constants/currency';

export default function History() {
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [halalFilter, setHalalFilter] = useState<string | null>(null);

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
        <Text style={styles.title}>History</Text>
        <SearchBar value={search} onChange={setSearch} placeholder="Search notes / categories" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip
            label="All"
            active={!filterCat}
            onPress={() => setFilterCat(null)}
          />
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
        {grouped.length === 0 && (
          <Text style={styles.empty}>No transactions match your filters.</Text>
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
    </SafeAreaView>
  );
}

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
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  chipText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  group: { gap: spacing.sm },
  dayLabel: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, textTransform: 'uppercase' },
  empty: { color: theme.text3, textAlign: 'center', marginTop: spacing.xxl },
});
