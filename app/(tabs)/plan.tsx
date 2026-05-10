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
  useBudgets,
  useRecurring,
  usePaidItemsForMonth,
  useMonthTotalsByCategory,
  markRecurringPaid,
  unmarkRecurringPaid,
  deleteRecurring,
  upsertBudget,
  deleteBudget,
  upsertRecurring,
} from '@/hooks/useAppData';
import { useSubscriptionAudit, type DetectedCandidate, type StaleSubscription } from '@/hooks/useSubscriptionAudit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { catInfo } from '@/constants/categories';
import { monthKey, formatMoney } from '@/utils/format';
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
        <SubscriptionAuditSection />
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

function RecurringSection() {
  const t = useT();
  const recurring = useRecurring();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const paid = usePaidItemsForMonth(key);
  const paidIds = useMemo(() => new Set(paid.map((p) => p.recurringId)), [paid]);

  const [sheet, setSheet] = useState<RecurringSheetState>({ kind: 'closed' });

  const exp = recurring.filter((r) => r.type === 'expense');
  const inc = recurring.filter((r) => r.type === 'income');
  const totalFixedExp = exp.reduce((s, r) => s + r.amount, 0);
  const totalFixedInc = inc.reduce((s, r) => s + r.amount, 0);
  const remaining = exp.filter((r) => !paidIds.has(r.id)).reduce((s, r) => s + r.amount, 0);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={sectionStyles.summaryRow}>
        <SummaryCard label={t('plan.fixedOut')} value={totalFixedExp} color={theme.expense} currency={currency} />
        <SummaryCard label={t('plan.fixedIn')} value={totalFixedInc} color={theme.accent} currency={currency} />
      </View>

      <View style={styles.disposableCard}>
        <Text style={styles.disposableLabel}>{t('plan.remainingBills')}</Text>
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
        {exp.length === 0 && (
          <Text style={styles.emptyHint}>{t('plan.empty.expenses')}</Text>
        )}
        {exp.map((r) => (
          <RecurringRow
            key={r.id}
            rec={r}
            paid={paidIds.has(r.id)}
            onTogglePaid={() => (paidIds.has(r.id) ? unmarkRecurringPaid(r.id, key) : markRecurringPaid(r))}
            onEdit={() => setSheet({ kind: 'edit', rec: r })}
            onDelete={() => deleteRecurring(r.id)}
            currency={currency}
          />
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
            onTogglePaid={() => (paidIds.has(r.id) ? unmarkRecurringPaid(r.id, key) : markRecurringPaid(r))}
            onEdit={() => setSheet({ kind: 'edit', rec: r })}
            onDelete={() => deleteRecurring(r.id)}
            currency={currency}
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

// ---- Budgets section ----

function BudgetsSection() {
  const t = useT();
  const budgets = useBudgets();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const totals = useMonthTotalsByCategory(key, 'expense');
  const totalsMap = useMemo(() => new Map(totals.map((t) => [t.category, t.total])), [totals]);

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader
        title={t('plan.budgets')}
        onAdd={promptAddBudget}
        addLabel={t('common.add')}
      />
      {budgets.length === 0 && (
        <Text style={styles.emptyHint}>{t('plan.empty.budgets')}</Text>
      )}
      {budgets.map((b) => {
        const spent = totalsMap.get(b.category) ?? 0;
        const pct = b.limit > 0 ? Math.min(spent / b.limit, 1) : 0;
        const over = spent > b.limit;
        const cat = catInfo(b.category);
        return (
          <View key={b.id} style={styles.budgetCard}>
            <View style={styles.budgetHead}>
              <Text style={styles.budgetName}>{cat.name}</Text>
              <Text style={[styles.budgetAmt, over && { color: theme.expense }]}>
                {formatMoney(spent, currency)} / {formatMoney(b.limit, currency)}
              </Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct * 100}%`, backgroundColor: over ? theme.expense : cat.color },
                ]}
              />
            </View>
            <View style={styles.budgetActions}>
              <Pressable onPress={() => promptEditBudget(b.id, b.category, b.limit)}>
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => deleteBudget(b.id)}>
                <Text style={[styles.actionText, { color: theme.expense }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function promptEditBudget(id: string, category: string, currentLimit: number) {
  Alert.prompt(
    'Edit Budget',
    `Limit for ${category}`,
    (text) => {
      const v = parseFloat(text);
      if (Number.isFinite(v) && v > 0) upsertBudget({ id, category, limit: v });
    },
    'plain-text',
    String(currentLimit),
    'numeric',
  );
}

function promptAddBudget() {
  Alert.prompt('New Budget', 'Enter category id (e.g. food)', (cat) => {
    if (!cat) return;
    Alert.prompt(
      'New Budget',
      `Limit for ${cat}`,
      (text) => {
        const v = parseFloat(text);
        if (Number.isFinite(v) && v > 0) upsertBudget({ id: `b${Date.now()}`, category: cat, limit: v });
      },
      'plain-text',
      '',
      'numeric',
    );
  });
}

// ---- Subscription audit (Phase 10i) ----

function SubscriptionAuditSection() {
  const t = useT();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const audit = useSubscriptionAudit();
  const hasContent =
    audit.detected.length > 0 ||
    audit.stale.length > 0 ||
    audit.annualBurn > 0;
  if (!hasContent) return null;

  const promote = (c: DetectedCandidate) => {
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
  };

  const dismissStale = (s: StaleSubscription) => {
    Alert.alert(
      t('plan.audit.stale.title', { name: s.recurring.name }),
      t('plan.audit.stale.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteRecurring(s.recurring.id),
        },
      ],
    );
  };

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader title={t('plan.audit.title')} />

      {audit.annualBurn > 0 && (
        <View style={styles.burnCard}>
          <Text style={styles.burnLabel}>{t('plan.audit.annual')}</Text>
          <Text style={styles.burnValue}>{formatMoney(audit.annualBurn, currency)}</Text>
        </View>
      )}

      {audit.detected.map((c) => {
        const cat = catInfo(c.category);
        return (
          <Pressable
            key={c.id}
            style={[styles.auditCard, { borderColor: `${theme.warning}55` }]}
            onPress={() => promote(c)}
            accessibilityRole="button"
            accessibilityLabel={`${c.token} suggested as recurring, ${formatMoney(c.amount, currency)}, tap to add`}
          >
            <View style={[styles.auditIcon, { backgroundColor: `${cat.color}22` }]}>
              <MaterialCommunityIcons name="lightbulb-outline" size={18} color={theme.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.auditTitle}>{t('plan.audit.detected', { token: c.token })}</Text>
              <Text style={styles.auditDetail}>
                {formatMoney(c.amount, currency)} · {t('plan.audit.detected.subtitle', { months: c.monthsSeen })}
              </Text>
            </View>
            <Text style={styles.auditCta}>{t('common.add')}</Text>
          </Pressable>
        );
      })}

      {audit.stale.map((s) => {
        const days = s.daysSinceLastSeen;
        const detail = days == null
          ? t('plan.audit.stale.never')
          : t('plan.audit.stale.days', { n: days });
        return (
          <Pressable
            key={s.recurring.id}
            style={[styles.auditCard, { borderColor: `${theme.expense}55` }]}
            onPress={() => dismissStale(s)}
            accessibilityRole="button"
            accessibilityLabel={`${s.recurring.name} not seen in ${days ?? 'a while'}, tap to review`}
          >
            <View style={[styles.auditIcon, { backgroundColor: `${theme.expense}22` }]}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={18} color={theme.expense} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.auditTitle}>
                {t('plan.audit.stale.headline', { name: s.recurring.name })}
              </Text>
              <Text style={styles.auditDetail}>{detail}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.text3} />
          </Pressable>
        );
      })}
    </View>
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
  burnCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  burnLabel: { color: theme.text2, fontSize: sizes.sm },
  burnValue: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  auditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
  },
  auditIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditTitle: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.bodySemi },
  auditDetail: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  auditCta: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
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
});
