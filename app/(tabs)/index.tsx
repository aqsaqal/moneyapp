// Home — v2: stripped to one decisive view.
//
// Sections (top to bottom):
//   1. Brand row (APP_NAME + StreakBadge if streak > 0)
//   2. HomeHeroExtras (islamic only — Hijri date hero)
//   3. DisposableHeroCard (THE one number)
//   4. HomeExtras (islamic only — ZakatHomeCard + RamadanHomeCard)
//   5. HomeActionCard (max-1 actionable insight; renders nothing if none)
//   6. Recent — 3 rows + "View all →" link to Activity
//
// What v1 had on Home that's no longer here:
//   - Net Balance (moved to Me/Accounts header)
//   - MiniTrendChart "Daily Spend" (now on Activity, in collapsible analytics)
//   - 18-tile CategoryGrid with MoM deltas (now on Activity analytics header)
//   - 4 recent rows (now 3 + "View all" to Activity)

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import { FeatureSlots } from '@/features';
import { DisposableHeroCard } from '@/components/BalanceCard';
import { HomeActionCard } from '@/components/HomeActionCard';
import { TransactionRow } from '@/components/TransactionRow';
import { StreakBadge } from '@/components/StreakBadge';
import {
  useTransactions,
  useRecurring as useRecurringList,
} from '@/hooks/useAppData';
import { useStreak } from '@/hooks/useStreak';
import { useT } from '@/hooks/useT';
import { monthKey } from '@/utils/format';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';

export default function Home() {
  if (!kv.getBool('onboardingCompleted', false)) {
    return <Redirect href="/onboarding" />;
  }
  const router = useRouter();
  const t = useT();
  const now = new Date();
  const thisMonth = monthKey(now);
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const thisMoTxns = useTransactions({ monthKey: thisMonth });
  const recentTxns = useTransactions({ limit: 3 });
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
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(0, dim - now.getDate());

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Brand + streak */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>{APP_NAME}</Text>
            {/* Hijri-first hero (islamic only). Generic: nothing. */}
            <FeatureSlots.HomeHeroExtras />
          </View>
          {streak > 0 && <StreakBadge count={streak} />}
        </View>

        {/* THE one number */}
        <DisposableHeroCard
          disposable={disposable}
          income={income}
          expense={expense}
          daysLeft={daysLeft}
          monthLabel={monthLabel}
          currency={currency}
        />

        {/* Islamic flavor: ZakatHomeCard + RamadanHomeCard. Generic: nothing. */}
        <FeatureSlots.HomeExtras />

        {/* Top-1 actionable insight; empty when nothing's wrong. */}
        <HomeActionCard />

        {/* Recent — 3 rows + "View all" tail link to /activity */}
        {recentTxns.length > 0 && (
          <View style={styles.section}>
            <View style={styles.recentHead}>
              <Text style={styles.sectionTitle}>{t('home.recent')}</Text>
              <Pressable
                onPress={() => router.push('/activity')}
                hitSlop={10}
                accessibilityRole="link"
                accessibilityLabel={t('home.viewAll')}
              >
                <View style={styles.viewAll}>
                  <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={theme.accent} />
                </View>
              </Pressable>
            </View>
            <View style={{ gap: 4 }}>
              {recentTxns.map((t) => (
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
  sectionTitle: {
    color: theme.text2,
    fontSize: sizes.sm,
    fontFamily: font.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.body },
});
