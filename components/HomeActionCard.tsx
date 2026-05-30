// HomeActionCard — surfaces top-1 actionable insight on Home, or nothing.
//
// Phase 6 of v2: replaces v1's CategoryGrid + MiniTrendChart density on Home
// with one decisive card. The card empty-states (returns null) when nothing
// is actionable — Home shouldn't decorate itself with neutral data.
//
// Priority order (first match wins):
//   1. Over-budget category (most overshot)
//   2. Bill due in next 3 days (soonest)
//   3. Recurring not yet paid past due-day this month (oldest first)
//
// Tap → routes to /plan (recurring + budgets are owned by Plan tab in v2).
//
// Tone: factual + brief. No "great job!" or "keep going!" — those rub
// against the cultural review checklist (Westernism / gamification).

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import {
  useBudgets,
  useMonthTotalsByCategory,
  useRecurring,
  usePaidItemsForMonth,
} from '@/hooks/useAppData';
import { useInsights } from '@/hooks/useInsights';
import { useT } from '@/hooks/useT';
import { catInfo } from '@/constants/categories';
import { monthKey } from '@/utils/format';
import { kv } from '@/utils/kv';

interface Insight {
  kind: 'overbudget' | 'bill-soon' | 'bill-overdue' | 'hawl-approaching' | 'hawl-due' | 'category-spike';
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: string;
  borderColor: string;
  title: string;
  detail: string;
  /** Where tapping the card sends the user. Defaults to /plan. */
  route?: '/plan' | '/activity' | '/(islamic)/zakat';
}

export function HomeActionCard() {
  const router = useRouter();
  const t = useT();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const budgets = useBudgets();
  const totals = useMonthTotalsByCategory(key, 'expense');
  const recurring = useRecurring();
  const paid = usePaidItemsForMonth(key);
  const { spike } = useInsights();

  const insight = useMemo<Insight | null>(() => {
    const today = new Date();
    const dom = today.getDate();
    const totalsMap = new Map(totals.map((tot) => [tot.category, tot.total]));

    // 1. Over-budget — pick the category that's overshot the most (in $).
    type OverBudget = { name: string; overBy: number; limit: number; spent: number };
    let topOver: OverBudget | null = null;
    for (const b of budgets) {
      const spent = totalsMap.get(b.category) ?? 0;
      if (spent > b.limit) {
        const overBy = spent - b.limit;
        if (!topOver || overBy > topOver.overBy) {
          topOver = { name: catInfo(b.category).name, overBy, limit: b.limit, spent };
        }
      }
    }
    if (topOver) {
      return {
        kind: 'overbudget',
        icon: 'alert-circle-outline',
        iconColor: theme.expense,
        borderColor: `${theme.expense}55`,
        title: t('homeAction.overbudget.title', { name: topOver.name }),
        detail: t('homeAction.overbudget.detail', {
          spent: formatMoney(topOver.spent, currency),
          over: formatMoney(topOver.overBy, currency),
        }),
      };
    }

    // 2. Bills due in the next 3 days (and not yet paid this month).
    const paidIds = new Set(paid.map((p) => p.recurringId));
    const upcoming = recurring
      .filter((r) => r.type === 'expense' && !paidIds.has(r.id))
      .map((r) => ({ rec: r, daysUntil: r.dayOfMonth - dom }))
      .filter((x) => x.daysUntil >= 0 && x.daysUntil <= 3)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    if (upcoming.length > 0) {
      const u = upcoming[0];
      const when =
        u.daysUntil === 0
          ? t('homeAction.due.today')
          : u.daysUntil === 1
            ? t('homeAction.due.tomorrow')
            : t('homeAction.due.inDays', { n: u.daysUntil });
      return {
        kind: 'bill-soon',
        icon: 'calendar-clock',
        iconColor: theme.warning,
        borderColor: `${theme.warning}55`,
        title: t('homeAction.billSoon.title', { name: u.rec.name, when }),
        detail: t('homeAction.billSoon.detail', {
          amount: formatMoney(u.rec.amount, currency),
          dom: u.rec.dayOfMonth,
        }),
      };
    }

    // 3. Overdue — recurring expenses past their day-of-month and unpaid.
    const overdue = recurring
      .filter((r) => r.type === 'expense' && !paidIds.has(r.id) && r.dayOfMonth < dom)
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth);
    if (overdue.length > 0) {
      const r = overdue[0];
      return {
        kind: 'bill-overdue',
        icon: 'alert',
        iconColor: theme.expense,
        borderColor: `${theme.expense}55`,
        title: t('homeAction.overdue.title', { name: r.name }),
        detail: t('homeAction.overdue.detail', {
          amount: formatMoney(r.amount, currency),
          dom: r.dayOfMonth,
        }),
      };
    }

    // 4. Category spike — current month >2σ above the rolling 12-month
    //    mean for any category. Surfaces only if no budget/bill issue
    //    already won the slot above (a single-card screen).
    if (spike) {
      const ratio = spike.thisMonth / spike.rolling12Mean;
      return {
        kind: 'category-spike',
        icon: 'chart-line-variant',
        iconColor: spike.color,
        borderColor: `${spike.color}55`,
        title: t('homeAction.spike.title', { name: spike.name, pct: Math.round((ratio - 1) * 100) }),
        detail: t('homeAction.spike.detail', {
          thisMonth: formatMoney(spike.thisMonth, currency),
          typical: formatMoney(spike.rolling12Mean, currency),
        }),
        route: '/activity',
      };
    }

    // 5. Islamic only — hawl approaching (≤30 days) or due. Babel inlines
    // process.env.APP_FLAVOR; in generic builds this whole branch DCEs, and
    // the require() never executes / pulls in @umalqura/core.
    if (process.env.APP_FLAVOR === 'islamic') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { computeHawlForActiveState } = require('@/features/islamic/zakat/useZakatCalculation');
        const z = computeHawlForActiveState?.();
        if (z?.isComplete) {
          return {
            kind: 'hawl-due',
            icon: 'hand-heart',
            iconColor: theme.gold,
            borderColor: `${theme.gold}55`,
            title: z.zakatDue > 0
              ? t('homeAction.zakatDue.title')
              : t('homeAction.hawlComplete.title'),
            detail: z.zakatDue > 0
              ? t('homeAction.zakatDue.detail', {
                  due: formatMoney(z.zakatDue, currency),
                  eligible: formatMoney(z.netEligible, currency),
                })
              : t('homeAction.belowNisab.detail'),
            // Falls back to /plan (the default route below) — zakat
            // budgeting + sadaqa categories live under the Plan tab in
            // v1. A dedicated Zakat Calculator screen ships in v1.1.
          };
        }
        if (z && z.daysRemaining > 0 && z.daysRemaining <= 30) {
          return {
            kind: 'hawl-approaching',
            icon: 'calendar-clock',
            iconColor: theme.gold,
            borderColor: `${theme.gold}55`,
            title: t('homeAction.hawlApproaching.title', { n: z.daysRemaining }),
            detail: t('homeAction.hawlApproaching.detail', {
              amount: formatMoney(z.zakatDueProjected ?? 0, currency),
            }),
          };
        }
      } catch {
        /* swallow — hawl card is best-effort, never block Home rendering. */
      }
    }

    return null;
  }, [budgets, totals, recurring, paid, currency, spike, t]);

  if (!insight) return null;

  return (
    <Pressable
      onPress={() => router.push((insight.route ?? '/plan') as never)}
      style={[styles.card, { borderColor: insight.borderColor }]}
      accessibilityRole="button"
      accessibilityLabel={`${insight.title}. ${insight.detail}.`}
    >
      <MaterialCommunityIcons name={insight.icon} size={22} color={insight.iconColor} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.detail}>{insight.detail}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.text3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
  },
  title: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  detail: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
});
