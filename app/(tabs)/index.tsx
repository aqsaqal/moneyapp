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
import { useOncePress } from '@/hooks/useOncePress';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import { FeatureSlots } from '@/features';
import { DisposableHeroCard, ForecastCard } from '@/components/BalanceCard';
import { HomeActionCard } from '@/components/HomeActionCard';
import { MonthGlanceCard } from '@/components/MonthGlanceCard';
import { TransactionRow } from '@/components/TransactionRow';
import { StreakBadge } from '@/components/StreakBadge';
import {
  useTransactions,
  useRecurring as useRecurringList,
  useAccounts,
  usePaidItemsForMonth,
  useMonthFlow,
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
  // Recent → "View all" — drop the user into Activity's LIST view
  // anchored to the current month (mirrors MonthGlance's handoff but
  // with view='list' since that section is the chronological feed).
  const goActivity = useOncePress(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    kv.set('activityJumpToMonth', monthKey);
    kv.set('activityJumpToView', 'list');
    router.push('/activity');
  });
  const t = useT();
  const activeProfile = useActiveProfile();
  const profiles = useProfiles();
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const now = new Date();
  const thisMonth = monthKey(now);
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  // Future-dated transactions are real-but-pending (the user scheduled
  // a future bill). They shouldn't shrink today's Disposable until
  // they actually fire — clamp the rollup to right-now.
  const thisMoTxns = useTransactions({ monthKey: thisMonth, dateLte: Date.now() });
  const recentTxns = useTransactions({ limit: 3, dateLte: Date.now() });
  const streak = useStreak();
  const recurring = useRecurringList();
  const accounts = useAccounts();
  // Include archived in the lookup map so historical recent rows still
  // display their account name after the wallet was retired.
  const allAccountsForLookup = useAccounts({ includeArchived: true });
  const accountName = useMemo(() => {
    const m = new Map<string, string>();
    allAccountsForLookup.forEach((a) => m.set(a.id, a.name));
    return m;
  }, [allAccountsForLookup]);
  const accountMeta = useMemo(() => {
    const m = new Map<string, { icon: string; color: string }>();
    allAccountsForLookup.forEach((a) => m.set(a.id, { icon: a.icon, color: a.color }));
    return m;
  }, [allAccountsForLookup]);
  const accountCcyMap = useMemo(() => {
    const m = new Map<string, CurrencyCode>();
    allAccountsForLookup.forEach((a) =>
      m.set(a.id, ((a.currency ?? currency) as CurrencyCode)),
    );
    return m;
  }, [allAccountsForLookup, currency]);
  const labelForTx = (tx: typeof recentTxns[number]): string | undefined => {
    if (tx.type === 'transfer') {
      const from = accountName.get(tx.accountId ?? '');
      const to = accountName.get(tx.toAccountId ?? '');
      return from && to ? `${from} → ${to}` : (from ?? to);
    }
    return accountName.get(tx.accountId ?? '');
  };

  // Income / expense for this month — SQL-aggregated so a busy month
  // (≥ DEFAULT_TX_LIMIT entries) doesn't silently drop older rows
  // like a day-1 salary. 'adjustment' category + scheduled-but-not-
  // applied txns are excluded inside the hook itself.
  const { income, expense } = useMonthFlow(thisMonth);
  // `fixedExp` is the projection of recurring bills still on the books
  // this month. When a recurring item is marked paid, the resulting
  // transaction already shows up in `expense` — so including the
  // recurring amount in `fixedExp` too would double-count it. Filter
  // by paid_items so only UNPAID recurring contributes.
  const paidThisMonth = usePaidItemsForMonth(thisMonth);
  const paidRecurringIds = useMemo(
    () => new Set(paidThisMonth.map((p) => p.recurringId)),
    [paidThisMonth],
  );
  const fixedExp = useMemo(
    () =>
      recurring
        .filter((r) => r.type === 'expense' && !paidRecurringIds.has(r.id))
        .reduce((s, r) => s + r.amount, 0),
    [recurring, paidRecurringIds],
  );
  const disposable = income - fixedExp - expense;

  const monthLabel = now.toLocaleString('en', { month: 'long' });
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysLeft = Math.max(0, dim - daysElapsed);

  // Variable expense = this-month expenses that AREN'T linked to a
  // recurring item. Used as the basis for avg-daily-variable so a
  // rent / subscription that posted on day 1 doesn't inflate the
  // per-day rate. Recurring-linked expenses are accounted for via
  // `fixedExp` and `remainingBills` separately.
  const variableExpense = useMemo(
    () => thisMoTxns
      .filter((t) => t.type === 'expense' && !t.recurringId)
      .reduce((s, t) => s + t.amount, 0),
    [thisMoTxns],
  );

  // Phase 10u — cashflow forecast. Project end-of-month disposable based
  // on:
  //   - what's already been spent + earned this month (committed)
  //   - average daily *variable* (non-recurring) spend × days left
  //   - remaining recurring expenses not yet paid (forecast bills)
  // Returns null when there's not enough data (first day of the month).
  // On the last day `daysLeft === 0` is allowed through — the card reads
  // as a final-state confirmation (projectedVar drops to 0, so
  // forecast = disposable − remainingBills).
  const forecastBundle = useMemo(() => {
    if (daysElapsed < 1) return null;
    const avgDailyVar = variableExpense / daysElapsed;
    const projectedVar = avgDailyVar * daysLeft;
    // Upcoming UNPAID bills — surfaced in the breakdown UI for the
    // user, but NOT subtracted from the forecast number here: the
    // disposable above already includes every unpaid recurring (the
    // post-fix definition of fixedExp), so subtracting them again
    // would double-count. Only future variable spend remains.
    // Any unpaid recurring expense — future-dated OR past-due. The
    // previous filter only counted bills whose dayOfMonth was strictly
    // after today, which silently dropped any bill the user hadn't
    // ticked off from earlier in the month. Hero-card's disposable
    // includes them, so this subtotal needs to match.
    const remainingBills = recurring
      .filter(
        (r) =>
          r.type === 'expense' &&
          !paidRecurringIds.has(r.id),
      )
      .reduce((s, r) => s + r.amount, 0);
    return {
      forecast: disposable - projectedVar,
      avgDailyVariable: avgDailyVar,
      remainingBills,
      daysOfData: daysElapsed,
    };
  }, [variableExpense, daysElapsed, daysLeft, disposable, recurring, paidRecurringIds]);
  const forecast = forecastBundle?.forecast ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Fixed header — sits outside the ScrollView so brand + profile
          chip + settings button stay anchored when the user scrolls
          (matches the Plan / Activity / Me pattern). */}
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
        {/* StreakBadge hidden for now — we still compute the streak
            under the hood so the recap surfaces still get it, just
            not advertised in the home header. */}
        {false && streak > 0 && <StreakBadge count={streak} />}
        <HeaderSettingsButton />
      </View>
      <ProfileSheet
        visible={profileSheetOpen}
        mode={profileSheetOpen ? { kind: 'switch', profiles, activeId: activeProfile.id } : null}
        onClose={() => setProfileSheetOpen(false)}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* THE one number — two-line hero with trajectory color. The
            empty-state CTA depends on what the user is missing: no
            accounts first (prerequisite for everything else), then no
            income. Sample data is no longer seeded on first install,
            so this path is the actual new-user landing experience. */}
        <DisposableHeroCard
          disposable={disposable}
          income={income}
          expense={expense}
          daysLeft={daysLeft}
          monthLabel={monthLabel}
          currency={currency}
          forecast={forecast ?? undefined}
          emptyKind={accounts.length === 0 ? 'no-accounts' : income <= 0 ? 'no-income' : null}
          onSetUp={() => {
            if (accounts.length === 0) router.push('/(tabs)/me' as never);
            else router.push('/(tabs)/plan' as never);
          }}
          // fixedExp at this point already filters out paid recurring,
          // so passing it through gives the user a clear "X already
          // reserved for upcoming bills" footnote.
          unpaidBills={fixedExp}
        />

        {/* Second-step card: only shown while accounts are still missing.
            Greyed/disabled so the user sees the progression without
            being able to skip the prerequisite. Disappears once an
            account exists — at that point the hero ITSELF rolls forward
            to the income empty state. */}
        {accounts.length === 0 && (
          <View style={styles.disabledNextCard} accessible accessibilityLabel={`${t('common.next')}: ${t('hero.thenSetIncome')}`}>
            <View style={styles.disabledNextHead}>
              <MaterialCommunityIcons name="lock-outline" size={14} color={theme.text3} />
              <Text style={styles.disabledNextLabel}>{t('common.next')}</Text>
            </View>
            <Text style={styles.disabledNextTitle}>{t('hero.thenSetIncome')}</Text>
            <Text style={styles.disabledNextHint}>
              {t('hero.thenSetIncome.hint')}
            </Text>
          </View>
        )}

        {/* Phase 10x: forecast moved out of the hero into its own
            tappable card. Collapsed by default; tap to reveal projected
            end-of-month + the two contributing numbers. Hidden when
            income is zero OR there are fewer than 3 days of variable-
            spend data — projecting from 1 day's spend is noise, not
            signal. ForecastCard.shouldRender encapsulates the gate. */}
        {income > 0 &&
          forecastBundle != null &&
          ForecastCard.shouldRender(forecastBundle.daysOfData) && (
            <ForecastCard
              forecast={forecastBundle.forecast}
              disposable={disposable}
              daysLeft={daysLeft}
              daysOfData={forecastBundle.daysOfData}
              avgDailyVariable={forecastBundle.avgDailyVariable}
              remainingBills={forecastBundle.remainingBills}
              currency={currency}
              onSeeBreakdown={() => router.push('/(tabs)/plan' as never)}
            />
          )}

        {/* Islamic flavor: ZakatHomeCard + RamadanHomeCard. Generic: nothing. */}
        <FeatureSlots.HomeExtras />

        {/* Top-1 actionable insight; empty when nothing's wrong. */}
        <HomeActionCard />

        {/* This-month glance: income/spending bars + net diff. Read-only,
            no period selector, no tap target. */}
        <MonthGlanceCard income={income} spending={expense} currency={currency} />

        {/* Recent — 3 rows + "View all" tail link to /activity */}
        {recentTxns.length > 0 && (
          <View style={styles.section}>
            <View style={styles.recentHead}>
              <Text style={styles.sectionTitle}>{t('home.recent')}</Text>
              <Pressable
                onPress={goActivity}
                hitSlop={10}
                accessibilityRole="link"
                accessibilityLabel={t('home.viewAll')}
                style={styles.viewAll}
              >
                <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={14} color={theme.text2} />
              </Pressable>
            </View>
            <View style={{ gap: 4 }}>
              {recentTxns.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  t={tx}
                  currency={currency}
                  accountLabel={labelForTx(tx)}
                  fromCurrency={accountCcyMap.get(tx.accountId ?? '')}
                  toCurrency={tx.toAccountId ? accountCcyMap.get(tx.toAccountId) : undefined}
                  accountIcon={accountMeta.get(tx.accountId ?? '')?.icon}
                  accountColor={accountMeta.get(tx.accountId ?? '')?.color}
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  brand: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  disabledNextCard: {
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    opacity: 0.55,
  },
  disabledNextHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  disabledNextLabel: {
    color: theme.text3,
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disabledNextTitle: { color: theme.text2, fontSize: sizes.md, marginTop: 2, fontFamily: font.bodySemi },
  disabledNextHint: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
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
  // Match the Recent header's neutral styling so the row reads as a
  // single section line — caps + letter-spacing + theme.text2 grey.
  viewAllText: {
    color: theme.text2,
    fontSize: sizes.sm,
    fontFamily: font.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
    lineHeight: sizes.sm * 1.2,
  },
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

