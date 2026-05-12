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

import React, { useMemo, useState } from 'react';
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
import { useActiveProfile, useProfiles } from '@/hooks/useProfile';
import { ProfileSheet } from '@/components/ProfileSheet';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { monthKey } from '@/utils/format';
import { buildEditPrefill } from '@/utils/prefill';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';

export default function Home() {
  if (!kv.getBool('onboardingCompleted', false)) {
    return <Redirect href="/onboarding" />;
  }
  const router = useRouter();
  const t = useT();
  const activeProfile = useActiveProfile();
  const profiles = useProfiles();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
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
  const daysElapsed = now.getDate();
  const daysLeft = Math.max(0, dim - daysElapsed);

  // Phase 10u — cashflow forecast. Project end-of-month disposable based
  // on:
  //   - what's already been spent + earned this month (committed)
  //   - average daily *variable* spend so far × days left (forecast var)
  //   - remaining recurring expenses not yet paid (forecast bills)
  // Returns null when there's not enough data (first day of the month).
  const forecast = useMemo(() => {
    if (daysElapsed < 1 || daysLeft === 0) return null;
    const avgDailyVar = expense / daysElapsed;
    const projectedVar = avgDailyVar * daysLeft;
    // Remaining recurring expenses for this month: bills with
    // dayOfMonth >= today that aren't already counted in `expense` because
    // recurring → transactions are created when marked paid.
    const remainingBills = recurring
      .filter((r) => r.type === 'expense' && r.dayOfMonth > daysElapsed)
      .reduce((s, r) => s + r.amount, 0);
    return disposable - projectedVar - remainingBills;
  }, [expense, daysElapsed, daysLeft, disposable, recurring]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Brand + profile chip + streak */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>{APP_NAME}</Text>
            {/* Hijri-first hero (islamic only). Generic: nothing. */}
            <FeatureSlots.HomeHeroExtras />
          </View>
          {profiles.length > 1 && (
            <Pressable
              onPress={() => setProfileSheetOpen(true)}
              style={[styles.profileChip, { borderColor: activeProfile.color }]}
              accessibilityRole="button"
              accessibilityLabel={`Profile: ${activeProfile.name}, tap to switch`}
            >
              <MaterialCommunityIcons name={activeProfile.icon as never} size={14} color={activeProfile.color} />
              <Text style={[styles.profileChipText, { color: activeProfile.color }]} numberOfLines={1}>
                {activeProfile.name}
              </Text>
            </Pressable>
          )}
          {streak > 0 && <StreakBadge count={streak} />}
          <HeaderSettingsButton />
        </View>
        <ProfileSheet
          visible={profileSheetOpen}
          mode={profileSheetOpen ? { kind: 'switch', profiles, activeId: activeProfile.id } : null}
          onClose={() => setProfileSheetOpen(false)}
        />

        {/* THE one number */}
        <DisposableHeroCard
          disposable={disposable}
          income={income}
          expense={expense}
          daysLeft={daysLeft}
          monthLabel={monthLabel}
          currency={currency}
          forecast={forecast ?? undefined}
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
              {recentTxns.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  t={tx}
                  currency={currency}
                  onPressMore={() =>
                    router.push({
                      pathname: '/add',
                      params: { prefill: buildEditPrefill(tx) },
                    } as never)
                  }
                />
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
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 140,
  },
  profileChipText: {
    fontSize: sizes.xs,
    fontFamily: font.bodySemi,
  },
});

