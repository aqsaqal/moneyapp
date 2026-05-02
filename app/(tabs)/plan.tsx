// Plan — forward-looking money. Recurring bills + Budgets + (islamic)
// Zakat/Sadaqa entry rows via FeatureSlots.PlanTabExtras.
//
// v2 IA: extracted from v1 app/(tabs)/more.tsx (RecurringTab + BudgetsTab
// sub-tabs). The temporal axis is "what do I plan to spend / what's coming"
// — Activity owns "what already happened."

import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { RecurringRow } from '@/components/RecurringRow';
import { SectionHeader, SummaryCard, AddRow, sectionStyles } from '@/components/Sections';
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
} from '@/hooks/useAppData';
import { catInfo } from '@/constants/categories';
import { monthKey, formatMoney } from '@/utils/format';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';

export default function PlanScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>Plan</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <RecurringSection />
        <BudgetsSection />
        {/* Islamic: Zakat + Sadaqa nav rows. Generic: renders nothing. */}
        <FeatureSlots.PlanTabExtras onNavigate={(p) => router.push(p as never)} />
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Recurring section ----

function RecurringSection() {
  const recurring = useRecurring();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const paid = usePaidItemsForMonth(key);
  const paidIds = useMemo(() => new Set(paid.map((p) => p.recurringId)), [paid]);

  const exp = recurring.filter((r) => r.type === 'expense');
  const inc = recurring.filter((r) => r.type === 'income');
  const totalFixedExp = exp.reduce((s, r) => s + r.amount, 0);
  const totalFixedInc = inc.reduce((s, r) => s + r.amount, 0);
  const remaining = exp.filter((r) => !paidIds.has(r.id)).reduce((s, r) => s + r.amount, 0);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={sectionStyles.summaryRow}>
        <SummaryCard label="Fixed Out" value={totalFixedExp} color={theme.expense} currency={currency} />
        <SummaryCard label="Fixed In" value={totalFixedInc} color={theme.accent} currency={currency} />
      </View>

      <View style={styles.disposableCard}>
        <Text style={styles.disposableLabel}>Remaining bills this month</Text>
        <Text style={[styles.disposableValue, { color: theme.warning }]}>
          {formatMoney(remaining, currency)}
        </Text>
      </View>

      <SectionHeader title="Expenses" />
      <View style={{ gap: spacing.sm }}>
        {exp.map((r) => (
          <RecurringRow
            key={r.id}
            rec={r}
            paid={paidIds.has(r.id)}
            onTogglePaid={() => (paidIds.has(r.id) ? unmarkRecurringPaid(r.id, key) : markRecurringPaid(r))}
            onDelete={() => deleteRecurring(r.id)}
            currency={currency}
          />
        ))}
      </View>

      <SectionHeader title="Income" />
      <View style={{ gap: spacing.sm }}>
        {inc.map((r) => (
          <RecurringRow
            key={r.id}
            rec={r}
            paid={paidIds.has(r.id)}
            onTogglePaid={() => (paidIds.has(r.id) ? unmarkRecurringPaid(r.id, key) : markRecurringPaid(r))}
            onDelete={() => deleteRecurring(r.id)}
            currency={currency}
          />
        ))}
      </View>
    </View>
  );
}

// ---- Budgets section ----

function BudgetsSection() {
  const budgets = useBudgets();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const totals = useMonthTotalsByCategory(key, 'expense');
  const totalsMap = useMemo(() => new Map(totals.map((t) => [t.category, t.total])), [totals]);

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title="Budgets" />
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
      <AddRow label="Add Budget" onPress={promptAddBudget} />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: { padding: spacing.lg, gap: spacing.md },
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
