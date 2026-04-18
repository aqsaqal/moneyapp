// Home screen — ports v4 HomeView (lines 326-465).
// Balance card + category grid + mini spending trend + recent transactions.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { theme, spacing, font, sizes } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import { FeatureSlots } from '@/features';
import { BalanceCard } from '@/components/BalanceCard';
import { CategoryGrid } from '@/components/CategoryGrid';
import { MiniTrendChart } from '@/components/MiniTrendChart';
import { TransactionRow } from '@/components/TransactionRow';
import { StreakBadge } from '@/components/StreakBadge';
import {
  useTransactions,
  useMonthTotalsByCategory,
  useDailySpend,
  useNetBalance,
  useRecurring as useRecurringList,
} from '@/hooks/useAppData';
import { useStreak } from '@/hooks/useStreak';
import { monthKey } from '@/utils/format';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';

export default function Home() {
  if (!kv.getBool('onboardingCompleted', false)) {
    return <Redirect href="/onboarding" />;
  }
  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const thisMoTxns = useTransactions({ monthKey: thisMonth });
  const recentTxns = useTransactions({ limit: 4 });
  const expByCat = useMonthTotalsByCategory(thisMonth, 'expense');
  const lastMoExpByCat = useMonthTotalsByCategory(lastMonth, 'expense');
  const daily = useDailySpend(thisMonth);
  const net = useNetBalance();
  const streak = useStreak();
  const recurring = useRecurringList();

  const income = useMemo(
    () => thisMoTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [thisMoTxns],
  );
  const expense = useMemo(
    () => thisMoTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [thisMoTxns],
  );
  const fixedExp = useMemo(
    () => recurring.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
    [recurring],
  );
  const disposable = income - fixedExp - expense;
  const monthLabel = now.toLocaleString('en', { month: 'long' });

  // CategoryGrid data with month-over-month delta
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const grid = useMemo(() => {
    const lastMap = new Map(lastMoExpByCat.map((r) => [r.category, r.total]));
    return expByCat
      .map((r) => {
        const prev = lastMap.get(r.category) ?? 0;
        const change = prev > 0 ? ((r.total - prev) / prev) * 100 : null;
        return { category: r.category, amount: r.total, change };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [expByCat, lastMoExpByCat]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>{APP_NAME}</Text>
            <FeatureSlots.HomeHeaderExtras />
          </View>
          <StreakBadge count={streak} />
        </View>

        <BalanceCard
          net={net}
          income={income}
          expense={expense}
          disposable={disposable}
          monthLabel={monthLabel}
          currency={currency}
        />

        <FeatureSlots.HomeExtras />

        {daily.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Spend</Text>
            <MiniTrendChart data={daily.map((d) => ({ day: d.day, amount: d.amount }))} />
          </View>
        )}

        {grid.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <CategoryGrid
              data={grid}
              selectedId={selectedCatId}
              onSelect={(id) => setSelectedCatId(selectedCatId === id ? null : id)}
              currency={currency}
            />
          </View>
        )}

        {recentTxns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={{ gap: 4 }}>
              {recentTxns.slice(0, 4).map((t) => (
                <TransactionRow key={t.id} t={t} currency={currency} />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  section: { gap: spacing.sm },
  sectionTitle: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, textTransform: 'uppercase', letterSpacing: 1 },
});
