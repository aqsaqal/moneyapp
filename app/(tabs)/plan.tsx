// Plan — forward-looking money. Recurring bills + Budgets + (islamic)
// Zakat/Sadaqa entry rows via FeatureSlots.PlanTabExtras.
//
// v2 IA: extracted from v1 app/(tabs)/more.tsx (RecurringTab + BudgetsTab
// sub-tabs). The temporal axis is "what do I plan to spend / what's coming"
// — Activity owns "what already happened."

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { RecurringRow } from '@/components/RecurringRow';
import { SectionHeader, SummaryCard, AddRow, sectionStyles } from '@/components/Sections';
import { RecurringSheet } from '@/components/RecurringSheet';
import { FeatureSlots } from '@/features';
import {
  useRecurring,
  usePaidItemsForMonth,
  useMonthTotalsByCategory,
  markRecurringPaid,
  unmarkRecurringPaid,
  deleteRecurring,
  upsertRecurring,
  useGoals,
  useAccounts,
  useDebts,
  useCategoriesWithMeta,
  type CategoryWithMeta,
} from '@/hooks/useAppData';
import { CustomCategorySheet } from '@/components/CustomCategorySheet';
import { CategoryPicker } from '@/components/CategoryPicker';
import { useSubscriptionAudit, type DetectedCandidate, type StaleSubscription } from '@/hooks/useSubscriptionAudit';
import { GoalSheet } from '@/components/GoalSheet';
import { DebtSheet } from '@/components/DebtSheet';
import { encodePrefill } from '@/utils/prefill';
import { projectPayoff, debtTotals, type Strategy } from '@/utils/debtPayoff';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Goal, Debt } from '@/utils/db/schema';
import { catInfo } from '@/constants/categories';
import { monthKey, formatMoney } from '@/utils/format';
import { convert } from '@/utils/fx';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { useT } from '@/hooks/useT';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import type { Recurring } from '@/utils/db/schema';

export default function PlanScreen() {
  const router = useRouter();
  const t = useT();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>{t('plan.title')}</Text>
        <HeaderSettingsButton />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <RecurringSection />
        <GoalsSection />
        <DebtsSection />
        <BudgetsSection />
        {/* Islamic: Zakat + Sadaqa nav rows. Generic: renders nothing. */}
        <FeatureSlots.PlanTabExtras onNavigate={(p) => router.push(p as never)} />
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Recurring section ----

type RecurringSheetState =
  | { kind: 'closed' }
  | { kind: 'edit'; rec: Recurring }
  | { kind: 'create'; type: 'expense' | 'income' };

/** Build a base64-encoded JSON prefill blob for /add. Used by every
 *  Plan-tab row that should open Smart Add with the right defaults.
 *  Delegates to the shared UTF-8-safe encoder so non-Latin-1 notes
 *  (Cyrillic, Arabic, Chinese, …) survive the round-trip. */
function buildPrefill(data: Record<string, unknown>): string {
  return encodePrefill(data);
}

function RecurringSection() {
  const t = useT();
  const router = useRouter();
  const recurring = useRecurring();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const paid = usePaidItemsForMonth(key);
  const paidIds = useMemo(() => new Set(paid.map((p) => p.recurringId)), [paid]);
  // Phase 10g+: audit signals now live INSIDE this section (annual burn,
  // detected, stale) — see useSubscriptionAudit.
  const audit = useSubscriptionAudit();

  const [sheet, setSheet] = useState<RecurringSheetState>({ kind: 'closed' });

  // Sort by day-of-month so the soonest-due is at the top — answers
  // "what's coming up?" at a glance.
  const byDay = (a: Recurring, b: Recurring) => a.dayOfMonth - b.dayOfMonth;
  const exp = recurring.filter((r) => r.type === 'expense').sort(byDay);
  const inc = recurring.filter((r) => r.type === 'income').sort(byDay);
  // Plan summaries are shown in the user's default currency, so each
  // per-item amount (which may be in its own currency) needs an FX
  // conversion. When `r.currency` is null we treat it as already in
  // the default currency (no conversion).
  const toDefault = (r: Recurring) =>
    r.currency && r.currency !== currency ? convert(r.amount, r.currency, currency) : r.amount;
  const totalFixedExp = exp.reduce((s, r) => s + toDefault(r), 0);
  const totalFixedInc = inc.reduce((s, r) => s + toDefault(r), 0);
  const remaining = exp.filter((r) => !paidIds.has(r.id)).reduce((s, r) => s + toDefault(r), 0);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={sectionStyles.summaryRow}>
        <SummaryCard label={t('plan.fixedOut')} value={totalFixedExp} color={theme.expense} currency={currency} />
        <SummaryCard label={t('plan.fixedIn')} value={totalFixedInc} color={theme.accent} currency={currency} />
      </View>

      <View style={styles.disposableCard}>
        <View>
          <Text style={styles.disposableLabel}>{t('plan.remainingBills')}</Text>
          {audit.annualBurn > 0 && (
            <Text style={styles.annualHint}>
              {formatMoney(audit.annualBurn, currency)} {t('plan.audit.annual.suffix')}
            </Text>
          )}
        </View>
        <Text style={[styles.disposableValue, { color: theme.warning }]}>
          {formatMoney(remaining, currency)}
        </Text>
      </View>

      <SectionHeader
        title={t('plan.expenses')}
        onAdd={() => setSheet({ kind: 'create', type: 'expense' })}
        addLabel={t('common.add')}
      />
      <View style={{ gap: spacing.sm }}>
        {exp.length === 0 && audit.detected.length === 0 && (
          <Text style={styles.emptyHint}>{t('plan.empty.expenses')}</Text>
        )}
        {exp.map((r) => {
          const stale = audit.stale.find((s) => s.recurring.id === r.id);
          // Tone-by-urgency: a never-paid bill that's due tomorrow shouldn't
          // shout "overdue" in red. Compare today's day-of-month to the
          // recurring's dayOfMonth and pick yellow / orange / red.
          const isPaid = paidIds.has(r.id);
          let hint: { tone: 'upcoming' | 'today' | 'overdue' | 'stopped'; text: string } | null = null;
          if (stale && !isPaid) {
            if (stale.daysSinceLastSeen == null) {
              const todayDom = new Date().getDate();
              if (r.dayOfMonth > todayDom) {
                hint = {
                  tone: 'upcoming',
                  text: t('plan.audit.dueIn', { n: r.dayOfMonth - todayDom }),
                };
              } else if (r.dayOfMonth === todayDom) {
                hint = { tone: 'today', text: t('plan.audit.dueToday') };
              } else {
                hint = {
                  tone: 'overdue',
                  text: t('plan.audit.overdue', { n: todayDom - r.dayOfMonth }),
                };
              }
            } else {
              hint = {
                tone: 'stopped',
                text: t('plan.audit.stale.days', { n: stale.daysSinceLastSeen }),
              };
            }
          }
          const toneColor =
            hint?.tone === 'upcoming'
              ? '#EAB308'
              : hint?.tone === 'today'
                ? theme.warning
                : theme.expense; // overdue + stopped
          const toneIcon =
            hint?.tone === 'upcoming'
              ? 'clock-outline'
              : hint?.tone === 'today'
                ? 'bell-ring-outline'
                : 'alert-octagon-outline';
          return (
            <View key={r.id}>
              <RecurringRow
                rec={r}
                paid={isPaid}
                onTapCheckbox={() => router.push({
                  pathname: '/add',
                  params: {
                    prefill: buildPrefill({
                      type: 'expense',
                      amount: r.amount,
                      accountId: r.accountId,
                      category: r.category,
                      note: r.name,
                      recurringId: r.id,
                      originalCurrency: r.currency ?? undefined,
                    }),
                  },
                } as never)}
                onUnmark={() => unmarkRecurringPaid(r.id, key)}
                onEdit={() => setSheet({ kind: 'edit', rec: r })}
                onDelete={() => deleteRecurring(r.id)}
                currency={(r.currency ?? currency) as CurrencyCode}
              />
              {hint && (
                <View style={styles.staleHint}>
                  <MaterialCommunityIcons name={toneIcon as never} size={14} color={toneColor} />
                  <Text style={[styles.staleHintText, { color: toneColor }]}>{hint.text}</Text>
                </View>
              )}
            </View>
          );
        })}
        {/* Detected candidates appear inline at the tail of the expenses
            list as suggestion rows. Tap → confirm → promote into a formal
            recurring entry. */}
        {audit.detected.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => promoteDetected(c, currency, t)}
            style={styles.suggestionRow}
            accessibilityRole="button"
            accessibilityLabel={`${c.token} suggested as recurring, ${formatMoney(c.amount, currency)}, tap to add`}
          >
            <MaterialCommunityIcons name="lightbulb-outline" size={16} color={theme.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionName}>
                {t('plan.audit.detected', { token: c.token })}
              </Text>
              <Text style={styles.suggestionSub}>
                {formatMoney(c.amount, currency)} · {t('plan.audit.detected.subtitle', { months: c.monthsSeen })}
              </Text>
            </View>
            <Text style={styles.suggestionCta}>{t('common.add')}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader
        title={t('plan.income')}
        onAdd={() => setSheet({ kind: 'create', type: 'income' })}
        addLabel={t('common.add')}
      />
      <View style={{ gap: spacing.sm }}>
        {inc.length === 0 && (
          <Text style={styles.emptyHint}>{t('plan.empty.income')}</Text>
        )}
        {inc.map((r) => (
          <RecurringRow
            key={r.id}
            rec={r}
            paid={paidIds.has(r.id)}
            onTapCheckbox={() => router.push({
              pathname: '/add',
              params: {
                prefill: buildPrefill({
                  type: 'income',
                  amount: r.amount,
                  accountId: r.accountId,
                  category: r.category,
                  note: r.name,
                  recurringId: r.id,
                  originalCurrency: r.currency ?? undefined,
                }),
              },
            } as never)}
            onUnmark={() => unmarkRecurringPaid(r.id, key)}
            onEdit={() => setSheet({ kind: 'edit', rec: r })}
            onDelete={() => deleteRecurring(r.id)}
            currency={(r.currency ?? currency) as CurrencyCode}
          />
        ))}
      </View>

      <RecurringSheet
        visible={sheet.kind !== 'closed'}
        recurring={sheet.kind === 'edit' ? sheet.rec : undefined}
        defaultType={sheet.kind === 'create' ? sheet.type : undefined}
        onClose={() => setSheet({ kind: 'closed' })}
      />
    </View>
  );
}

// ---- Budgets section (Phase 10w: category-driven dashboard) ----

function BudgetsSection() {
  const t = useT();
  const defaultCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const categories = useCategoriesWithMeta();
  const key = monthKey();
  const totals = useMonthTotalsByCategory(key, 'expense');
  const totalsMap = useMemo(() => new Map(totals.map((t) => [t.category, t.total])), [totals]);
  const [editing, setEditing] = useState<CategoryWithMeta | null | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Active budgets only: archived-out categories with paused budgets don't
  // belong in the dashboard.
  const budgeted = categories.filter((c) => c.monthlyBudget != null && !c.archived);

  // Sort by urgency: over-budget first, then close-to-cap (>80%), then
  // healthy. Spend is expense-only and currency-converted into the budget's
  // currency at today's rate (since useMonthTotalsByCategory returns native
  // sums per the user's display currency — we treat that as already in
  // default; in mixed-currency cases this is best-effort and surfaces
  // exactly when the budget currency differs from default).
  const rows = budgeted
    .map((c) => {
      const budget = c.monthlyBudget ?? 0;
      const ccy = (c.budgetCurrency as CurrencyCode | null) ?? defaultCurrency;
      // Approximation: month totals are in default currency. If the
      // budget is in another currency, convert the spend total over.
      const spentInDefault = totalsMap.get(c.id) ?? 0;
      const spent =
        ccy === defaultCurrency ? spentInDefault : convert(spentInDefault, defaultCurrency, ccy);
      const pct = budget > 0 ? spent / budget : 0;
      const urgency = pct >= 1 ? 2 : pct >= 0.8 ? 1 : 0;
      return { c, ccy, spent, budget, pct, urgency };
    })
    .sort((a, b) => b.urgency - a.urgency || b.pct - a.pct);

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader
        title={t('plan.budgets')}
        onAdd={() => setPickerOpen(true)}
        addLabel={t('common.add')}
      />
      {rows.length === 0 && (
        <Text style={styles.emptyHint}>{t('plan.empty.budgets')}</Text>
      )}
      {rows.map(({ c, ccy, spent, budget, pct }) => {
        const clamped = Math.min(pct, 1);
        const over = pct >= 1;
        const warn = !over && pct >= 0.8;
        const barColor = over ? theme.expense : warn ? '#F97316' : c.color;
        return (
          <Pressable
            key={c.id}
            onPress={() => setEditing(c)}
            style={styles.budgetCard}
            accessibilityRole="button"
            accessibilityLabel={`${c.name} budget ${spent.toFixed(0)} of ${budget.toFixed(0)} ${ccy}, ${Math.round(pct * 100)} percent used`}
          >
            <View style={styles.budgetHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={[styles.budgetIconWrap, { backgroundColor: `${c.color}22` }]}>
                  <MaterialCommunityIcons name={(c.icon as never) || 'tag-outline'} size={14} color={c.color} />
                </View>
                <Text style={styles.budgetName}>{c.name}</Text>
              </View>
              <Text style={[styles.budgetAmt, over && { color: theme.expense }]}>
                {formatMoney(spent, ccy)} / {formatMoney(budget, ccy)}
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[styles.barFill, { width: `${clamped * 100}%`, backgroundColor: barColor }]}
              />
            </View>
          </Pressable>
        );
      })}

      <CustomCategorySheet
        visible={editing !== undefined}
        category={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />

      <CategoryPicker
        visible={pickerOpen}
        mode="select"
        excludeWithBudget
        showAddNew
        headerText={t('picker.pickCategoryToBudget')}
        onSelect={(id) => {
          const cat = categories.find((c) => c.id === id);
          if (cat) setEditing(cat);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

// ---- Goals (Phase 10l) ----

function GoalsSection() {
  const t = useT();
  const router = useRouter();
  const goals = useGoals();
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // null = creating; Goal = editing; undefined = closed.
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined);

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader
        title={t('plan.goals.title')}
        onAdd={() => setEditing(null)}
        addLabel={t('plan.goals.add')}
      />
      {goals.length === 0 && (
        <Text style={styles.emptyHint}>{t('plan.goals.empty')}</Text>
      )}
      {goals.map((g) => {
        const acct = accountById.get(g.accountId);
        const current = Math.max(0, acct?.balance ?? 0);
        const pct = g.targetAmount > 0 ? Math.min(current / g.targetAmount, 1) : 0;
        const remaining = Math.max(0, g.targetAmount - current);
        const daysLeft = g.targetDate
          ? Math.max(0, Math.ceil((g.targetDate - Date.now()) / 86_400_000))
          : null;
        const goalCcy = (g.currency ?? currency) as CurrencyCode;
        return (
          <Pressable
            key={g.id}
            onPress={() => router.push({
              pathname: '/add',
              params: {
                prefill: buildPrefill({
                  type: 'transfer',
                  toAccountId: g.accountId,
                  amount: remaining > 0 ? remaining : undefined,
                  note: g.name,
                  originalCurrency: g.currency ?? undefined,
                }),
              },
            } as never)}
            onLongPress={() => setEditing(g)}
            style={[styles.goalCard, { borderColor: `${g.color}55` }]}
            accessibilityRole="button"
            accessibilityLabel={`${g.name}, ${Math.round(pct * 100)}% of target, tap to contribute, long-press to edit`}
          >
            <View style={styles.goalHead}>
              <View style={[styles.goalIcon, { backgroundColor: `${g.color}22` }]}>
                <MaterialCommunityIcons name={g.icon as never} size={20} color={g.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalName}>{g.name}</Text>
                <Text style={styles.goalSub}>
                  {formatMoney(current, goalCcy)} / {formatMoney(g.targetAmount, goalCcy)} · {acct?.name ?? '—'}
                </Text>
              </View>
              <Text style={[styles.goalPct, { color: g.color }]}>{Math.round(pct * 100)}%</Text>
            </View>
            <View style={[styles.barBg, { marginTop: 8 }]}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct * 100}%`, backgroundColor: g.color },
                ]}
              />
            </View>
            <Text style={styles.goalFooter}>
              {pct >= 1
                ? t('plan.goals.reached')
                : daysLeft != null
                  ? t('plan.goals.remainingByDate', {
                      amount: formatMoney(remaining, goalCcy),
                      days: daysLeft,
                    })
                  : t('plan.goals.remaining', { amount: formatMoney(remaining, goalCcy) })}
            </Text>
          </Pressable>
        );
      })}
      <GoalSheet
        visible={editing !== undefined}
        goal={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </View>
  );
}

// ---- Debts (Phase 10o) ----

function DebtsSection() {
  const t = useT();
  const router = useRouter();
  const debts = useDebts();
  const accounts = useAccounts();
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [editing, setEditing] = useState<Debt | null | undefined>(undefined);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');

  // When a debt has accountId set, derive balance from the linked account
  // so that transfers paying it down propagate through addTransaction's
  // existing account-balance reconciliation. Otherwise use the static
  // value the user typed in DebtSheet.
  const liveDebts = useMemo(
    () =>
      debts.map((d) => ({
        ...d,
        balance: d.accountId
          ? Math.abs(accountById.get(d.accountId)?.balance ?? d.balance)
          : d.balance,
      })),
    [debts, accountById],
  );

  const totals = useMemo(() => debtTotals(liveDebts), [liveDebts]);
  // Default monthly budget = sum of mins + 10% headroom; lets the projection
  // show "if you stick to minimums" by default.
  const budget = totals.minPayment * 1.1;
  const projection = useMemo(() => {
    if (liveDebts.length === 0) return null;
    return projectPayoff(
      liveDebts.map((d) => ({ id: d.id, balance: d.balance, apr: d.apr, minPayment: d.minPayment })),
      budget,
      strategy,
    );
  }, [liveDebts, budget, strategy]);

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader
        title={t('plan.debts.title')}
        onAdd={() => setEditing(null)}
        addLabel={t('plan.debts.add')}
      />

      {debts.length === 0 && (
        <Text style={styles.emptyHint}>{t('plan.debts.empty')}</Text>
      )}

      {debts.length > 0 && (
        <View style={styles.debtSummary}>
          <View style={styles.debtSummaryRow}>
            <Text style={styles.debtSummaryLabel}>{t('plan.debts.totalBalance')}</Text>
            <Text style={[styles.debtSummaryValue, { color: theme.expense }]}>
              {formatMoney(totals.balance, currency)}
            </Text>
          </View>
          <View style={styles.debtSummaryRow}>
            <Text style={styles.debtSummaryLabel}>{t('plan.debts.totalMin')}</Text>
            <Text style={styles.debtSummaryValue}>
              {formatMoney(totals.minPayment, currency)}
            </Text>
          </View>
          {projection && (
            <>
              <View style={styles.debtStrategyRow}>
                <Pressable
                  onPress={() => setStrategy('avalanche')}
                  style={[styles.stratChip, strategy === 'avalanche' && styles.stratChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: strategy === 'avalanche' }}
                >
                  <Text style={[styles.stratText, strategy === 'avalanche' && styles.stratTextActive]}>
                    {t('plan.debts.avalanche')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setStrategy('snowball')}
                  style={[styles.stratChip, strategy === 'snowball' && styles.stratChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: strategy === 'snowball' }}
                >
                  <Text style={[styles.stratText, strategy === 'snowball' && styles.stratTextActive]}>
                    {t('plan.debts.snowball')}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.debtProjection}>
                {projection.months == null
                  ? t('plan.debts.tooSlow')
                  : t('plan.debts.payoffIn', {
                      months: projection.months,
                      interest: formatMoney(projection.totalInterest, currency),
                    })}
              </Text>
            </>
          )}
        </View>
      )}

      {liveDebts.map((d) => {
        const linked = d.accountId ? accountById.get(d.accountId) : null;
        const debtCcy = (d.currency ?? currency) as CurrencyCode;
        return (
          <Pressable
            key={d.id}
            onPress={() => router.push({
              pathname: '/add',
              params: {
                prefill: buildPrefill(
                  // When linked to an account, log a transfer that pays it
                  // down. Otherwise log a generic expense the user can
                  // categorize themselves.
                  d.accountId
                    ? {
                        type: 'transfer',
                        toAccountId: d.accountId,
                        amount: d.minPayment > 0 ? d.minPayment : undefined,
                        note: d.name,
                        originalCurrency: d.currency ?? undefined,
                      }
                    : {
                        type: 'expense',
                        amount: d.minPayment > 0 ? d.minPayment : undefined,
                        note: d.name,
                        originalCurrency: d.currency ?? undefined,
                      },
                ),
              },
            } as never)}
            onLongPress={() => setEditing(debts.find((x) => x.id === d.id))}
            style={[styles.debtCard, { borderColor: `${d.color}55` }]}
            accessibilityRole="button"
            accessibilityLabel={`${d.name}, ${formatMoney(d.balance, debtCcy)} at ${d.apr}% APR, tap to log payment, long-press to edit`}
          >
            <View style={[styles.goalIcon, { backgroundColor: `${d.color}22` }]}>
              <MaterialCommunityIcons name={d.icon as never} size={20} color={d.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalName}>{d.name}</Text>
              <Text style={styles.goalSub}>
                {formatMoney(d.balance, debtCcy)} · {d.apr.toFixed(2)}% APR · min {formatMoney(d.minPayment, debtCcy)}
              </Text>
              {linked && (
                <Text style={[styles.goalSub, { color: linked.color }]}>
                  ↔ {linked.name} (live)
                </Text>
              )}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.text3} />
          </Pressable>
        );
      })}

      <DebtSheet
        visible={editing !== undefined}
        debt={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </View>
  );
}

// Promote a detected subscription candidate into a formal recurring entry.
// Confirm-alert keeps the original behaviour for v1; a future iteration can
// swap this for the RecurringSheet pre-filled so the user can edit before
// saving.
function promoteDetected(
  c: DetectedCandidate,
  currency: CurrencyCode,
  t: (k: string, v?: Record<string, string | number>) => string,
) {
  Alert.alert(
    t('plan.audit.promote.title'),
    t('plan.audit.promote.body', { token: c.token, amount: formatMoney(c.amount, currency) }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.add'),
        style: 'default',
        onPress: () => {
          const cat = catInfo(c.category);
          upsertRecurring({
            id: `r${Date.now()}`,
            type: 'expense',
            name: c.token.charAt(0).toUpperCase() + c.token.slice(1),
            amount: c.amount,
            category: c.category,
            accountId: c.accountId,
            dayOfMonth: c.dayOfMonth,
            icon: cat.icon,
            color: cat.color,
          });
        },
      },
    ],
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  disposableCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disposableLabel: { color: theme.text2, fontSize: sizes.sm },
  disposableValue: { fontSize: sizes.xl, fontFamily: font.display, fontWeight: '700' },
  emptyHint: { color: theme.text3, fontSize: sizes.sm, paddingHorizontal: 4, lineHeight: 20 },
  annualHint: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    backgroundColor: `${theme.warning}08`,
  },
  suggestionName: { color: theme.text1, fontSize: sizes.sm },
  suggestionSub: { color: theme.text3, fontSize: sizes.xs, marginTop: 1 },
  suggestionCta: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
  staleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  staleHintText: { color: theme.expense, fontSize: sizes.xs, flex: 1 },
  goalCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
  },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalName: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  goalSub: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  goalPct: { fontSize: sizes.md, fontFamily: font.displayBold },
  goalFooter: { color: theme.text2, fontSize: sizes.xs, marginTop: 6 },
  debtSummary: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  debtSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  debtSummaryLabel: { color: theme.text2, fontSize: sizes.sm },
  debtSummaryValue: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  debtStrategyRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  stratChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg1,
  },
  stratChipActive: {
    backgroundColor: theme.accent,
    borderColor: 'transparent',
  },
  stratText: { color: theme.text2, fontSize: sizes.sm },
  stratTextActive: { color: theme.bg, fontFamily: font.bodySemi },
  debtProjection: { color: theme.text2, fontSize: sizes.sm, marginTop: 6 },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
  },
  budgetCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetName: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  budgetAmt: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.display },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  budgetActions: { flexDirection: 'row', gap: spacing.lg },
  actionText: { color: theme.accent, fontSize: sizes.sm },
  budgetIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
