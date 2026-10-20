// Plan — forward-looking money, split into four segments:
//
//   Bills    agenda of recurring expenses grouped by when they're due
//            (Overdue / This week / Later this month / Paid), expected
//            income, subscription suggestions. Hero = what's left to
//            pay and when the next income lands.
//   Budgets  category ceilings with pace (on / over pace / over budget).
//   Goals    savings targets with the monthly contribution needed and a
//            one-tap "Add contribution" transfer.
//   Debts    payoff planner over LOAN / CREDIT ACCOUNTS (single source
//            of truth for balances); APR + minimum live in the `debts`
//            table keyed by accountId.
//
// One segment is visible at a time; the choice persists per profile.
// Islamic flavour appends Zakat / Sadaqa rows via FeatureSlots.

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { RecurringRow } from '@/components/RecurringRow';
import { SectionHeader } from '@/components/Sections';
import { RecurringSheet } from '@/components/RecurringSheet';
import { FeatureSlots } from '@/features';
import {
  useRecurring,
  usePaidItemsForMonth,
  useMonthTotalsByCategory,
  unmarkRecurringPaid,
  deleteRecurring,
  upsertRecurring,
  useGoals,
  useAccounts,
  useDebts,
  useCategoriesWithMeta,
  skipRecurringForMonth,
  setCategoryMeta,
  deleteGoal,
  type CategoryWithMeta,
} from '@/hooks/useAppData';
import { ActionMenu, type ActionMenuOption } from '@/components/ActionMenu';
import { CustomCategorySheet } from '@/components/CustomCategorySheet';
import { CategoryPicker } from '@/components/CategoryPicker';
import { useSubscriptionAudit, type DetectedCandidate } from '@/hooks/useSubscriptionAudit';
import { GoalSheet } from '@/components/GoalSheet';
import { DebtSheet } from '@/components/DebtSheet';
import { AccountSheet } from '@/components/AccountSheet';
import { Icon } from '@/components/Icon';
import { encodePrefill } from '@/utils/prefill';
import { projectPayoff, type Strategy } from '@/utils/debtPayoff';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Account, Goal, Debt, Recurring } from '@/utils/db/schema';
import { catInfo } from '@/constants/categories';
import { monthKey, formatMoney } from '@/utils/format';
import { convert } from '@/utils/fx';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { useT } from '@/hooks/useT';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';

type Segment = 'bills' | 'budgets' | 'goals' | 'debts';
const SEGMENTS: Segment[] = ['bills', 'budgets', 'goals', 'debts'];
const DISMISSED_KEY = 'planDismissedSuggestions';

function buildPrefill(data: Record<string, unknown>): string {
  return encodePrefill(data);
}

function daysInThisMonth(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
}

export default function PlanScreen() {
  const router = useRouter();
  const t = useT();
  const [segment, setSegment] = useState<Segment>(() => {
    const s = kv.get('planSegment');
    return (SEGMENTS as string[]).includes(s ?? '') ? (s as Segment) : 'bills';
  });
  const pick = (s: Segment) => {
    kv.set('planSegment', s);
    setSegment(s);
  };
  // Deep link / handoff: flow://plan?segment=goals
  const params = useLocalSearchParams<{ segment?: string }>();
  React.useEffect(() => {
    const s = params.segment;
    if (s && (SEGMENTS as string[]).includes(s)) pick(s as Segment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.segment]);

  // Counts for the chips — cheap reads, all already cached by version.
  const recurring = useRecurring();
  const paid = usePaidItemsForMonth(monthKey());
  const categories = useCategoriesWithMeta();
  const goals = useGoals();
  const accounts = useAccounts();
  const counts: Record<Segment, number> = {
    bills: recurring.filter((r) => r.type === 'expense' && !paid.some((p) => p.recurringId === r.id)).length,
    budgets: categories.filter((c) => c.monthlyBudget != null && !c.archived).length,
    goals: goals.length,
    debts: accounts.filter((a) => (a.type === 'debt' || a.type === 'credit') && a.balance < 0).length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>{t('plan.title')}</Text>
        <HeaderSettingsButton />
      </View>
      <View style={styles.segRow}>
        {SEGMENTS.map((s) => {
          const active = s === segment;
          return (
            <Pressable
              key={s}
              onPress={() => pick(s)}
              style={[styles.segChip, active && styles.segChipActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${t(`plan.seg.${s}`)} ${counts[s]}`}
            >
              <Text style={[styles.segText, active && styles.segTextActive]} maxFontSizeMultiplier={1.3}>
                {t(`plan.seg.${s}`)}
              </Text>
              <Text style={[styles.segCount, active && styles.segCountActive]} maxFontSizeMultiplier={1.3}>
                {counts[s]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {segment === 'bills' && <BillsSegment />}
        {segment === 'budgets' && <BudgetsSegment />}
        {segment === 'goals' && <GoalsSegment />}
        {segment === 'debts' && <DebtsSegment />}
        {/* Islamic: Zakat + Sadaqa nav rows. Generic: renders nothing. */}
        <FeatureSlots.PlanTabExtras onNavigate={(p) => router.push(p as never)} />
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────── Bills ───────────────────────────

type RecurringSheetState =
  | { kind: 'closed' }
  | { kind: 'edit'; rec: Recurring }
  | { kind: 'create'; type: 'expense' | 'income' };

function buildRecurringMenuOptions(args: {
  onEdit: () => void;
  onSkip: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useT>;
}): ActionMenuOption[] {
  const { onEdit, onSkip, onDelete, t } = args;
  return [
    { label: t('common.edit'), icon: 'pencil-outline', onPress: onEdit },
    { label: t('plan.menu.skipMonth'), icon: 'calendar-end', onPress: onSkip },
    { label: t('common.delete'), icon: 'trash-can-outline', destructive: true, onPress: onDelete },
  ];
}

function BillsSegment() {
  const t = useT();
  const router = useRouter();
  const recurring = useRecurring();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const paid = usePaidItemsForMonth(key);
  const paidIds = useMemo(() => new Set(paid.map((p) => p.recurringId)), [paid]);
  const skippedIds = useMemo(
    () => new Set(paid.filter((p) => p.transactionId === '__skip__').map((p) => p.recurringId)),
    [paid],
  );
  const audit = useSubscriptionAudit();
  const [sheet, setSheet] = useState<RecurringSheetState>({ kind: 'closed' });
  const [menuFor, setMenuFor] = useState<Recurring | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  // Dismissed suggestion ids persist per profile so a rejected candidate
  // doesn't come back every month.
  const [dismissed, setDismissed] = useState<string[]>(
    () => kv.getJSON<string[]>(DISMISSED_KEY) ?? [],
  );
  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    kv.setJSON(DISMISSED_KEY, next);
    setDismissed(next);
  };

  const confirmDeleteRecurring = (rec: { id: string; name: string }) => {
    Alert.alert(
      t('recurring.deleteConfirm.title'),
      `${t('recurring.deleteConfirm.body', { name: rec.name })} ${t('common.cannotBeUndone')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteRecurring(rec.id) },
      ],
    );
  };
  const confirmUnmark = (rec: { id: string; name: string; type: 'expense' | 'income' }) => {
    Alert.alert(
      t(`recurring.unmarkConfirm.title.${rec.type === 'income' ? 'income' : 'expense'}`),
      `${t('recurring.unmarkConfirm.body', { name: rec.name })} ${t('common.cannotBeUndone')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => unmarkRecurringPaid(rec.id, key) },
      ],
    );
  };

  const byDay = (a: Recurring, b: Recurring) => a.dayOfMonth - b.dayOfMonth;
  const exp = recurring.filter((r) => r.type === 'expense').sort(byDay);
  const inc = recurring.filter((r) => r.type === 'income').sort(byDay);
  const toDefault = (r: Recurring) =>
    r.currency && r.currency !== currency ? convert(r.amount, r.currency, currency) : r.amount;
  const totalFixedExp = exp.reduce((s, r) => s + toDefault(r), 0);
  const totalFixedInc = inc.reduce((s, r) => s + toDefault(r), 0);
  const unpaidExp = exp.filter((r) => !paidIds.has(r.id));
  const remaining = unpaidExp.reduce((s, r) => s + toDefault(r), 0);

  // Agenda buckets by due day this month.
  const today = new Date().getDate();
  const dim = daysInThisMonth();
  const dueDay = (r: Recurring) => Math.min(r.dayOfMonth, dim);
  const overdue = unpaidExp.filter((r) => dueDay(r) < today);
  const thisWeek = unpaidExp.filter((r) => dueDay(r) >= today && dueDay(r) <= today + 6);
  const later = unpaidExp.filter((r) => dueDay(r) > today + 6);
  const paidExp = exp.filter((r) => paidIds.has(r.id));
  const lastDue = unpaidExp.reduce((m, r) => Math.max(m, dueDay(r)), 0);
  const nextIncome =
    inc.find((r) => !paidIds.has(r.id) && dueDay(r) >= today) ?? inc[0] ?? null;

  const suggestions = audit.detected.filter((c) => !dismissed.includes(c.id)).slice(0, 3);

  const openPay = (r: Recurring) =>
    router.push({
      pathname: '/add',
      params: {
        prefill: buildPrefill({
          type: r.type,
          amount: r.amount,
          accountId: r.accountId,
          category: r.category,
          note: r.name,
          recurringId: r.id,
          markMonth: key,
          originalCurrency: r.currency ?? undefined,
        }),
      },
    } as never);

  const renderRow = (r: Recurring) => {
    const stale = audit.stale.find((s) => s.recurring.id === r.id);
    const staleDays = stale && !paidIds.has(r.id) ? stale.daysSinceLastSeen : null;
    return (
      <View key={r.id}>
        <RecurringRow
          rec={r}
          paid={paidIds.has(r.id)}
          skipped={skippedIds.has(r.id)}
          onUnskip={() => unmarkRecurringPaid(r.id, key)}
          onTapCheckbox={() => openPay(r)}
          onUnmark={() => confirmUnmark(r)}
          onEdit={() => setSheet({ kind: 'edit', rec: r })}
          onLongPress={() => setMenuFor(r)}
          currency={(r.currency ?? currency) as CurrencyCode}
        />
        {staleDays != null && (
          <View style={styles.staleHint}>
            <MaterialCommunityIcons name="alert-octagon-outline" size={14} color={theme.expense} />
            <Text style={styles.staleHintText}>{t('plan.audit.stale.days', { n: staleDays })}</Text>
          </View>
        )}
      </View>
    );
  };

  const Group = ({ label, items, tone }: { label: string; items: Recurring[]; tone?: string }) =>
    items.length === 0 ? null : (
      <View style={{ gap: spacing.sm }}>
        <Text style={[styles.groupLabel, tone ? { color: tone } : null]}>{label}</Text>
        {items.map(renderRow)}
      </View>
    );

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>
          {unpaidExp.length === 0 && exp.length > 0 ? t('plan.bills.allPaid') : t('plan.bills.leftToPay')}
        </Text>
        <Text style={[styles.heroValue, { color: remaining > 0 ? theme.warning : theme.accent }]} adjustsFontSizeToFit numberOfLines={1}>
          {formatMoney(remaining, currency)}
        </Text>
        <Text style={styles.heroSub}>
          {lastDue > 0 ? t('plan.bills.byDay', { n: lastDue }) : ''}
          {lastDue > 0 && nextIncome ? ' · ' : ''}
          {nextIncome ? t('plan.bills.nextIncome', { n: dueDay(nextIncome) }) : ''}
        </Text>
        <Text style={styles.heroFoot}>
          {t('plan.fixedOut')} {formatMoney(totalFixedExp, currency)} · {t('plan.fixedIn')}{' '}
          {formatMoney(totalFixedInc, currency)}
          {audit.annualBurn > 0 ? ` · ${formatMoney(audit.annualBurn, currency)}${t('plan.audit.annual.suffix')}` : ''}
        </Text>
      </View>

      {/* Subscription suggestions — one dismissable card */}
      {suggestions.length > 0 && (
        <View style={styles.suggestCard}>
          <View style={styles.suggestHead}>
            <MaterialCommunityIcons name="lightbulb-outline" size={16} color={theme.warning} />
            <Text style={styles.suggestTitle}>{t('plan.audit.title')}</Text>
          </View>
          {suggestions.map((c) => (
            <View key={c.id} style={styles.suggestRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  {t('plan.audit.detected', { token: c.token })}
                </Text>
                <Text style={styles.suggestionSub}>
                  {formatMoney(c.amount, currency)} · {t('plan.audit.detected.subtitle', { months: c.monthsSeen })}
                </Text>
              </View>
              <Pressable
                onPress={() => promoteDetected(c, currency, t)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${t('common.add')} ${c.token}`}
              >
                <Text style={styles.suggestionCta}>{t('common.add')}</Text>
              </Pressable>
              <Pressable
                onPress={() => dismiss(c.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${t('plan.audit.dismiss')} ${c.token}`}
              >
                <MaterialCommunityIcons name="close" size={18} color={theme.text3} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Agenda */}
      <SectionHeader
        title={t('plan.bills.upcoming')}
        onAdd={() => setSheet({ kind: 'create', type: 'expense' })}
        addLabel={t('common.add')}
      />
      {exp.length === 0 && <Text style={styles.emptyHint}>{t('plan.empty.expenses')}</Text>}
      <Group label={t('plan.bills.group.overdue')} items={overdue} tone={theme.expense} />
      <Group label={t('plan.bills.group.week')} items={thisWeek} tone={theme.warning} />
      <Group label={t('plan.bills.group.later')} items={later} />
      {paidExp.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => setShowPaid((v) => !v)}
            style={styles.paidToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPaid }}
          >
            <Text style={styles.groupLabel}>{t('plan.bills.group.paid', { n: paidExp.length })}</Text>
            <MaterialCommunityIcons name={showPaid ? 'chevron-up' : 'chevron-down'} size={18} color={theme.text3} />
          </Pressable>
          {showPaid && paidExp.map(renderRow)}
        </View>
      )}

      {/* Income */}
      <SectionHeader
        title={t('plan.income')}
        onAdd={() => setSheet({ kind: 'create', type: 'income' })}
        addLabel={t('common.add')}
      />
      <View style={{ gap: spacing.sm }}>
        {inc.length === 0 && <Text style={styles.emptyHint}>{t('plan.empty.income')}</Text>}
        {inc.map(renderRow)}
      </View>

      <RecurringSheet
        visible={sheet.kind !== 'closed'}
        recurring={sheet.kind === 'edit' ? sheet.rec : undefined}
        defaultType={sheet.kind === 'create' ? sheet.type : undefined}
        onClose={() => setSheet({ kind: 'closed' })}
      />
      <ActionMenu
        visible={menuFor != null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        options={menuFor ? buildRecurringMenuOptions({
          onEdit: () => setSheet({ kind: 'edit', rec: menuFor }),
          onSkip: () => skipRecurringForMonth(menuFor.id, key),
          onDelete: () => confirmDeleteRecurring(menuFor),
          t,
        }) : []}
      />
    </View>
  );
}

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

// ─────────────────────────── Budgets ───────────────────────────

function buildBudgetMenuOptions(args: {
  onEdit: () => void;
  onRemove: () => void;
  t: ReturnType<typeof useT>;
}): ActionMenuOption[] {
  const { onEdit, onRemove, t } = args;
  return [
    { label: t('plan.menu.editBudget'), icon: 'pencil-outline', onPress: onEdit },
    { label: t('plan.menu.removeBudget'), icon: 'close-circle-outline', destructive: true, onPress: onRemove },
  ];
}

function BudgetsSegment() {
  const t = useT();
  const defaultCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const categories = useCategoriesWithMeta();
  const key = monthKey();
  const totals = useMonthTotalsByCategory(key, 'expense');
  const totalsMap = useMemo(() => new Map(totals.map((x) => [x.category, x.total])), [totals]);
  const [editing, setEditing] = useState<CategoryWithMeta | null | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<CategoryWithMeta | null>(null);

  const confirmRemoveBudget = (c: CategoryWithMeta) => {
    Alert.alert(
      t('plan.budget.removeConfirm.title'),
      t('plan.budget.removeConfirm.body', { name: c.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => setCategoryMeta(c.id, { monthlyBudget: null, budgetCurrency: null }),
        },
      ],
    );
  };

  const budgeted = categories.filter((c) => c.monthlyBudget != null && !c.archived);
  // Pace: where spend "should" be given how far into the month we are.
  const elapsedPct = new Date().getDate() / daysInThisMonth();
  const rows = budgeted
    .map((c) => {
      const budget = c.monthlyBudget ?? 0;
      const ccy = (c.budgetCurrency as CurrencyCode | null) ?? defaultCurrency;
      const spentInDefault = totalsMap.get(c.id) ?? 0;
      const spent = ccy === defaultCurrency ? spentInDefault : convert(spentInDefault, defaultCurrency, ccy);
      const pct = budget > 0 ? spent / budget : 0;
      const pace: 'on' | 'over' | 'exceeded' =
        pct >= 1 ? 'exceeded' : pct > elapsedPct + 0.05 ? 'over' : 'on';
      const urgency = pace === 'exceeded' ? 2 : pace === 'over' ? 1 : 0;
      return { c, ccy, spent, budget, pct, pace, urgency, spentInDefault, budgetInDefault: ccy === defaultCurrency ? budget : convert(budget, ccy, defaultCurrency) };
    })
    .sort((a, b) => b.urgency - a.urgency || b.pct - a.pct);
  const offPace = rows.filter((r) => r.pace !== 'on').length;
  const sumSpent = rows.reduce((s, r) => s + r.spentInDefault, 0);
  const sumBudget = rows.reduce((s, r) => s + r.budgetInDefault, 0);

  return (
    <View style={{ gap: spacing.md }}>
      {rows.length > 0 && (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('plan.budgets.count', { n: rows.length })}</Text>
          <Text style={[styles.heroValue, { color: offPace > 0 ? theme.warning : theme.accent }]} adjustsFontSizeToFit numberOfLines={1}>
            {t('plan.budgets.overPace', { n: offPace })}
          </Text>
          <Text style={styles.heroSub}>
            {t('plan.budgets.spentOf', {
              spent: formatMoney(sumSpent, defaultCurrency),
              total: formatMoney(sumBudget, defaultCurrency),
            })}
          </Text>
        </View>
      )}
      <SectionHeader title={t('plan.budgets')} onAdd={() => setPickerOpen(true)} addLabel={t('common.add')} />
      {rows.length === 0 && <Text style={styles.emptyHint}>{t('plan.empty.budgets')}</Text>}
      {rows.map(({ c, ccy, spent, budget, pct, pace }) => {
        const clamped = Math.min(pct, 1);
        const paceColor = pace === 'exceeded' ? theme.expense : pace === 'over' ? '#F97316' : theme.accent;
        const barColor = pace === 'on' ? c.color : paceColor;
        return (
          <Pressable
            key={c.id}
            onPress={() => setEditing(c)}
            onLongPress={() => setMenuFor(c)}
            delayLongPress={300}
            style={styles.budgetCard}
            accessibilityRole="button"
            accessibilityLabel={`${c.name} budget ${spent.toFixed(0)} of ${budget.toFixed(0)} ${ccy}, ${Math.round(pct * 100)} percent used, ${t(`plan.budgets.pace.${pace}`)}`}
          >
            <View style={styles.budgetHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={[styles.budgetIconWrap, { backgroundColor: `${c.color}22` }]}>
                  <MaterialCommunityIcons name={(c.icon as never) || 'tag-outline'} size={14} color={c.color} />
                </View>
                <Text style={styles.budgetName} numberOfLines={1}>{c.name}</Text>
                <Text style={[styles.paceTag, { color: paceColor, borderColor: `${paceColor}66` }]}>
                  {t(`plan.budgets.pace.${pace}`)}
                </Text>
              </View>
              <Text style={[styles.budgetAmt, pace === 'exceeded' && { color: theme.expense }]}>
                {formatMoney(spent, ccy)} / {formatMoney(budget, ccy)}
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${clamped * 100}%`, backgroundColor: barColor }]} />
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
        transactionType="expense"
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
      <ActionMenu
        visible={menuFor != null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        options={menuFor ? buildBudgetMenuOptions({
          onEdit: () => setEditing(menuFor),
          onRemove: () => confirmRemoveBudget(menuFor),
          t,
        }) : []}
      />
    </View>
  );
}

// ─────────────────────────── Goals ───────────────────────────

function buildGoalMenuOptions(args: {
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useT>;
}): ActionMenuOption[] {
  const { onEdit, onDelete, t } = args;
  return [
    { label: t('common.edit'), icon: 'pencil-outline', onPress: onEdit },
    { label: t('common.delete'), icon: 'trash-can-outline', destructive: true, onPress: onDelete },
  ];
}

function GoalsSegment() {
  const t = useT();
  const router = useRouter();
  const goals = useGoals();
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined);
  const [menuFor, setMenuFor] = useState<Goal | null>(null);

  const confirmDeleteGoal = (g: Goal) => {
    Alert.alert(
      t('plan.goals.deleteConfirm.title'),
      `${t('plan.goals.deleteConfirm.body', { name: g.name })} ${t('common.cannotBeUndone')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteGoal(g.id) },
      ],
    );
  };

  const rows = goals.map((g) => {
    const acct = accountById.get(g.accountId);
    const current = Math.max(0, acct?.balance ?? 0);
    const pct = g.targetAmount > 0 ? Math.min(current / g.targetAmount, 1) : 0;
    const remaining = Math.max(0, g.targetAmount - current);
    const daysLeft = g.targetDate ? Math.max(0, Math.ceil((g.targetDate - Date.now()) / 86_400_000)) : null;
    const monthsLeft = daysLeft != null ? Math.max(1, Math.ceil(daysLeft / 30)) : null;
    const perMonth = monthsLeft != null && remaining > 0 ? remaining / monthsLeft : null;
    const goalCcy = (g.currency ?? currency) as CurrencyCode;
    const remainingInDefault = goalCcy === currency ? remaining : convert(remaining, goalCcy, currency);
    return { g, acct, current, pct, remaining, daysLeft, perMonth, goalCcy, remainingInDefault };
  });
  const totalToGo = rows.reduce((s, r) => s + r.remainingInDefault, 0);
  const reached = rows.filter((r) => r.pct >= 1).length;

  const contribute = (g: Goal) =>
    router.push({
      pathname: '/add',
      params: { prefill: buildPrefill({ type: 'transfer', toAccountId: g.accountId, note: g.name }) },
    } as never);

  return (
    <View style={{ gap: spacing.md }}>
      {rows.length > 0 && (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('plan.goals.title')}</Text>
          <Text style={[styles.heroValue, { color: theme.text1 }]} adjustsFontSizeToFit numberOfLines={1}>
            {t('plan.goals.heroToGo', { amount: formatMoney(totalToGo, currency), n: rows.length })}
          </Text>
          {reached > 0 && <Text style={styles.heroSub}>{t('plan.goals.reachedCount', { n: reached })}</Text>}
        </View>
      )}
      <SectionHeader title={t('plan.goals.title')} onAdd={() => setEditing(null)} addLabel={t('plan.goals.add')} />
      {rows.length === 0 && <Text style={styles.emptyHint}>{t('plan.goals.empty')}</Text>}
      {rows.map(({ g, acct, current, pct, remaining, daysLeft, perMonth, goalCcy }) => (
        <Pressable
          key={g.id}
          onPress={() => setEditing(g)}
          onLongPress={() => setMenuFor(g)}
          delayLongPress={300}
          style={[styles.goalCard, { borderColor: `${g.color}55` }]}
          accessibilityRole="button"
          accessibilityLabel={`${g.name}, ${Math.round(pct * 100)}% of target, tap to edit`}
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
            <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: g.color }]} />
          </View>
          <View style={styles.goalFootRow}>
            <Text style={styles.goalFooter} numberOfLines={2}>
              {pct >= 1
                ? t('plan.goals.reached')
                : perMonth != null && g.targetDate
                  ? t('plan.goals.perMonth', {
                      amount: formatMoney(perMonth, goalCcy),
                      date: new Date(g.targetDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
                    })
                  : daysLeft != null
                    ? t('plan.goals.remainingByDate', { amount: formatMoney(remaining, goalCcy), days: daysLeft })
                    : t('plan.goals.remaining', { amount: formatMoney(remaining, goalCcy) })}
            </Text>
            {pct < 1 && (
              <Pressable
                onPress={() => contribute(g)}
                style={[styles.smallBtn, { borderColor: `${g.color}88` }]}
                accessibilityRole="button"
                accessibilityLabel={`${t('plan.goals.contribute')} ${g.name}`}
                hitSlop={6}
              >
                <MaterialCommunityIcons name="plus" size={14} color={g.color} />
                <Text style={[styles.smallBtnText, { color: g.color }]}>{t('plan.goals.contribute')}</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      ))}
      <GoalSheet visible={editing !== undefined} goal={editing ?? undefined} onClose={() => setEditing(undefined)} />
      <ActionMenu
        visible={menuFor != null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        options={menuFor ? buildGoalMenuOptions({
          onEdit: () => setEditing(menuFor),
          onDelete: () => confirmDeleteGoal(menuFor),
          t,
        }) : []}
      />
    </View>
  );
}

// ─────────────────────────── Debts ───────────────────────────
// Source of truth = loan / credit ACCOUNTS with a negative balance. The
// `debts` table only carries payoff terms (APR, minimum) keyed by
// accountId. Paying = a transfer INTO the account (balance → 0).

function DebtsSegment() {
  const t = useT();
  const router = useRouter();
  const accounts = useAccounts();
  const debts = useDebts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [editingFor, setEditingFor] = useState<Account | null>(null);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>('avalanche');

  const liabilities = accounts.filter((a) => (a.type === 'debt' || a.type === 'credit') && a.balance < 0);
  const termsByAccount = useMemo(() => {
    const m = new Map<string, Debt>();
    debts.forEach((d) => { if (d.accountId) m.set(d.accountId, d); });
    return m;
  }, [debts]);
  const accountCcy = (a: Account) => ((a.currency ?? currency) as CurrencyCode);
  const toDefault = (a: Account, v: number) =>
    accountCcy(a) === currency ? v : convert(v, accountCcy(a), currency);

  const rows = liabilities.map((a) => ({ a, terms: termsByAccount.get(a.id) ?? null, owed: Math.abs(a.balance) }));
  const totalOwed = rows.reduce((s, r) => s + toDefault(r.a, r.owed), 0);
  const withTerms = rows.filter((r) => r.terms);
  const totalMin = withTerms.reduce((s, r) => s + toDefault(r.a, r.terms!.minPayment), 0);
  const missing = rows.length - withTerms.length;
  const projection = useMemo(() => {
    if (withTerms.length === 0) return null;
    return projectPayoff(
      withTerms.map((r) => ({
        id: r.a.id,
        balance: toDefault(r.a, r.owed),
        apr: r.terms!.apr,
        minPayment: toDefault(r.a, r.terms!.minPayment),
      })),
      totalMin * 1.1,
      strategy,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, accounts, strategy, currency]);

  const pay = (a: Account, terms: Debt | null) =>
    router.push({
      pathname: '/add',
      params: {
        prefill: buildPrefill({
          type: 'transfer',
          toAccountId: a.id,
          amount: terms && terms.minPayment > 0 ? terms.minPayment : undefined,
          note: a.name,
        }),
      },
    } as never);

  return (
    <View style={{ gap: spacing.md }}>
      {rows.length > 0 && (
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('plan.debts.totalOwed')}</Text>
          <Text style={[styles.heroValue, { color: theme.expense }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(totalOwed, currency)}
          </Text>
          {withTerms.length > 0 && (
            <Text style={styles.heroSub}>
              {t('plan.debts.totalMin')} {formatMoney(totalMin, currency)}
            </Text>
          )}
          {projection && (
            <>
              <View style={styles.debtStrategyRow}>
                {(['avalanche', 'snowball'] as Strategy[]).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setStrategy(s)}
                    style={[styles.stratChip, strategy === s && styles.stratChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: strategy === s }}
                  >
                    <Text style={[styles.stratText, strategy === s && styles.stratTextActive]}>
                      {t(`plan.debts.${s}`)}
                    </Text>
                  </Pressable>
                ))}
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
          {missing > 0 && (
            <Text style={[styles.debtProjection, { color: theme.warning }]}>
              {t('plan.debts.missingTerms', { n: missing })}
            </Text>
          )}
        </View>
      )}

      <SectionHeader title={t('plan.debts.title')} onAdd={() => setNewAccountOpen(true)} addLabel={t('plan.debts.add')} />
      {rows.length === 0 && <Text style={styles.emptyHint}>{t('plan.debts.emptyLinked')}</Text>}
      {rows.map(({ a, terms, owed }) => (
        <Pressable
          key={a.id}
          onPress={() => setEditingFor(a)}
          style={[styles.debtCard, { borderColor: `${a.color}55` }]}
          accessibilityRole="button"
          accessibilityLabel={`${a.name}, ${formatMoney(owed, accountCcy(a))}${terms ? `, ${terms.apr}% APR` : ''}, tap to edit payoff terms`}
        >
          <View style={[styles.goalIcon, { backgroundColor: `${a.color}22` }]}>
            <Icon name={a.icon} size={20} color={a.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.goalName} numberOfLines={1}>{a.name}</Text>
            <Text style={styles.goalSub}>
              {formatMoney(owed, accountCcy(a))}
              {terms
                ? ` · ${t('plan.debts.terms', { apr: terms.apr.toFixed(2), min: formatMoney(terms.minPayment, accountCcy(a)) })}`
                : ''}
            </Text>
            {!terms && <Text style={[styles.goalSub, { color: theme.accent }]}>{t('plan.debts.setTerms')}</Text>}
          </View>
          <Pressable
            onPress={() => pay(a, terms)}
            style={[styles.smallBtn, { borderColor: `${a.color}88` }]}
            accessibilityRole="button"
            accessibilityLabel={`${t('plan.debts.pay')} ${a.name}`}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="cash-fast" size={14} color={a.color} />
            <Text style={[styles.smallBtnText, { color: a.color }]}>{t('plan.debts.pay')}</Text>
          </Pressable>
        </Pressable>
      ))}

      <DebtSheet
        visible={editingFor != null}
        account={editingFor ?? undefined}
        debt={editingFor ? termsByAccount.get(editingFor.id) : undefined}
        onClose={() => setEditingFor(null)}
      />
      <AccountSheet
        visible={newAccountOpen}
        initialType="debt"
        onClose={() => setNewAccountOpen(false)}
      />
    </View>
  );
}

// ─────────────────────────── Styles ───────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  segRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  segChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  segChipActive: { backgroundColor: theme.accent, borderColor: 'transparent' },
  segText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  segTextActive: { color: theme.bg },
  segCount: {
    color: theme.text3,
    fontSize: 10,
    fontFamily: font.bodySemi,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 7,
    backgroundColor: theme.bg3,
    overflow: 'hidden',
  },
  segCountActive: { color: theme.accent, backgroundColor: theme.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 4,
  },
  heroLabel: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValue: { fontSize: sizes.xxl, fontFamily: font.displayBold },
  heroSub: { color: theme.text2, fontSize: sizes.sm },
  heroFoot: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  groupLabel: {
    color: theme.text3,
    fontSize: sizes.xs,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  paidToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  emptyHint: { color: theme.text3, fontSize: sizes.sm, paddingHorizontal: 4, lineHeight: 20 },
  suggestCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${theme.warning}66`,
    backgroundColor: `${theme.warning}08`,
    gap: spacing.sm,
  },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestTitle: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  suggestionName: { color: theme.text1, fontSize: sizes.sm },
  suggestionSub: { color: theme.text3, fontSize: sizes.xs, marginTop: 1 },
  suggestionCta: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
  staleHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 4 },
  staleHintText: { color: theme.expense, fontSize: sizes.xs, flex: 1 },
  goalCard: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1 },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  goalName: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  goalSub: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  goalPct: { fontSize: sizes.md, fontFamily: font.displayBold },
  goalFootRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 8 },
  goalFooter: { flex: 1, color: theme.text2, fontSize: sizes.xs },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  smallBtnText: { fontSize: sizes.xs, fontFamily: font.bodySemi },
  debtStrategyRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  stratChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg1,
  },
  stratChipActive: { backgroundColor: theme.accent, borderColor: 'transparent' },
  stratText: { color: theme.text2, fontSize: sizes.sm },
  stratTextActive: { color: theme.bg, fontFamily: font.bodySemi },
  debtProjection: { color: theme.text2, fontSize: sizes.sm, marginTop: 4 },
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
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  budgetName: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body, flexShrink: 1 },
  budgetAmt: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.display },
  paceTag: {
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  budgetIconWrap: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
