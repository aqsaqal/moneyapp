// More — ports v4 MoreView (lines 561-781). Four sub-tabs: Recurring, Budgets,
// Analytics, Accounts. Plus settings (currency, biometric, export, locale).

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { RecurringRow } from '@/components/RecurringRow';
import { FeatureSlots } from '@/features';
import {
  useAccounts,
  useBudgets,
  useRecurring,
  usePaidItemsForMonth,
  useTransactions,
  useMonthTotalsByCategory,
  useDailySpend,
  markRecurringPaid,
  unmarkRecurringPaid,
  deleteRecurring,
  upsertBudget,
  deleteBudget,
} from '@/hooks/useAppData';
import { catInfo, EXPENSE_CATEGORIES } from '@/constants/categories';
import { monthKey, formatMoney } from '@/utils/format';
import { CURRENCIES, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { isBiometricEnabled, setBiometricEnabled, useBiometricSupported } from '@/hooks/useBiometricLock';
import { getRawDB } from '@/utils/db/client';

type SubTab = 'recurring' | 'budgets' | 'analytics' | 'accounts' | 'settings';

export default function More() {
  const [tab, setTab] = useState<SubTab>('recurring');
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>More</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {(['recurring', 'budgets', 'analytics', 'accounts', 'settings'] as SubTab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'recurring' && <RecurringTab onIslamicNavigate={(p) => router.push(p as never)} />}
        {tab === 'budgets' && <BudgetsTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'accounts' && <AccountsTab />}
        {tab === 'settings' && <SettingsTab />}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Recurring sub-tab ----

function RecurringTab({ onIslamicNavigate }: { onIslamicNavigate: (p: string) => void }) {
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
      <View style={styles.summaryRow}>
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
            onTogglePaid={() => paidIds.has(r.id) ? unmarkRecurringPaid(r.id, key) : markRecurringPaid(r)}
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
            onTogglePaid={() => paidIds.has(r.id) ? unmarkRecurringPaid(r.id, key) : markRecurringPaid(r)}
            onDelete={() => deleteRecurring(r.id)}
            currency={currency}
          />
        ))}
      </View>

      {/* Islamic flavor injects Zakat + Sadaqa entry rows here (generic: nothing). */}
      <FeatureSlots.MoreMenuItems onNavigate={onIslamicNavigate} />
    </View>
  );
}

// ---- Budgets sub-tab ----

function BudgetsTab() {
  const budgets = useBudgets();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = monthKey();
  const totals = useMonthTotalsByCategory(key, 'expense');
  const totalsMap = useMemo(() => new Map(totals.map((t) => [t.category, t.total])), [totals]);

  return (
    <View style={{ gap: spacing.md }}>
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
              <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: over ? theme.expense : cat.color }]} />
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
      <Pressable style={styles.addRow} onPress={promptAddBudget}>
        <MaterialCommunityIcons name="plus" size={18} color={theme.accent} />
        <Text style={[styles.addText, { color: theme.accent }]}>Add Budget</Text>
      </Pressable>
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
  Alert.prompt(
    'New Budget',
    'Enter category id (e.g. food)',
    (cat) => {
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
    },
  );
}

// ---- Analytics sub-tab ----

function AnalyticsTab() {
  const key = monthKey();
  const txns = useTransactions({ monthKey: key });
  const daily = useDailySpend(key);
  const totals = useMonthTotalsByCategory(key);
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const expenses = txns.filter((t) => t.type === 'expense');
  const totalSpend = expenses.reduce((s, t) => s + t.amount, 0);
  const dayCount = new Set(daily.filter((d) => d.amount > 0).map((d) => d.day)).size || 1;
  const avgDaily = totalSpend / dayCount;
  const today = new Date();
  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const projected = avgDaily * dim;

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.statGrid}>
        <StatCard label="Avg/Day" value={formatMoney(avgDaily, currency)} />
        <StatCard label="Projected" value={formatMoney(projected, currency)} />
        <StatCard label="Total" value={formatMoney(totalSpend, currency)} />
        <StatCard label="Categories" value={String(totals.length)} />
      </View>

      <SectionHeader title="By Category" />
      <View style={{ gap: 4 }}>
        {totals
          .sort((a, b) => b.total - a.total)
          .map((t) => {
            const cat = catInfo(t.category);
            const pct = totalSpend > 0 ? (t.total / totalSpend) * 100 : 0;
            return (
              <View key={t.category} style={styles.catLine}>
                <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catAmt}>{formatMoney(t.total, currency)}</Text>
                <Text style={styles.catPct}>{pct.toFixed(0)}%</Text>
              </View>
            );
          })}
      </View>
    </View>
  );
}

// ---- Accounts sub-tab ----

function AccountsTab() {
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const assets = accounts.filter((a) => a.balance >= 0).reduce((s, a) => s + a.balance, 0);
  const debt = accounts.filter((a) => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.summaryRow}>
        <SummaryCard label="Assets" value={assets} color={theme.accent} currency={currency} />
        <SummaryCard label="Debt" value={debt} color={theme.expense} currency={currency} />
      </View>
      {accounts.map((a) => (
        <View key={a.id} style={styles.acctCard}>
          <View style={[styles.iconBox, { backgroundColor: `${a.color}22` }]}>
            <MaterialCommunityIcons name="wallet-outline" size={20} color={a.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.acctName}>{a.name}</Text>
            <Text style={styles.acctType}>{a.type}</Text>
            {a.creditLimit && (
              <View style={[styles.barBg, { marginTop: 6 }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(Math.abs(a.balance) / a.creditLimit, 1) * 100}%`,
                      backgroundColor: theme.expense,
                    },
                  ]}
                />
              </View>
            )}
          </View>
          <Text style={[styles.acctBal, { color: a.balance >= 0 ? theme.accent : theme.expense }]}>
            {formatMoney(a.balance, currency)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---- Settings sub-tab ----

function SettingsTab() {
  const supported = useBiometricSupported();
  const [bio, setBio] = useState(isBiometricEnabled());
  const [currency, setCurrency] = useState<CurrencyCode>((kv.get('currency') ?? 'USD') as CurrencyCode);

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title="Currency" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
          <Pressable
            key={c}
            onPress={() => { kv.set('currency', c); setCurrency(c); }}
            style={[styles.chip, currency === c && { backgroundColor: theme.accent, borderColor: 'transparent' }]}
          >
            <Text style={[styles.chipText, currency === c && { color: theme.bg }]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader title="Security" />
      <View style={styles.settingsRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>Biometric Unlock</Text>
          <Text style={styles.settingHint}>
            {supported ? 'Face ID / fingerprint required to open the app' : 'Not available on this device'}
          </Text>
        </View>
        <Pressable
          onPress={() => { if (supported) { setBiometricEnabled(!bio); setBio(!bio); } }}
          style={[styles.toggle, bio && { backgroundColor: theme.accent }]}
        >
          <View style={[styles.toggleKnob, bio && { transform: [{ translateX: 18 }] }]} />
        </Pressable>
      </View>

      <SectionHeader title="Data" />
      <Pressable style={styles.settingsRow} onPress={() => exportData(false)}>
        <MaterialCommunityIcons name="export" size={20} color={theme.accent} />
        <Text style={[styles.settingLabel, { flex: 1 }]}>Export all data (JSON)</Text>
      </Pressable>
      <Pressable style={styles.settingsRow} onPress={() => exportData(true)}>
        <MaterialCommunityIcons name="export" size={20} color={theme.accent} />
        <Text style={[styles.settingLabel, { flex: 1 }]}>Export transactions (CSV)</Text>
      </Pressable>
    </View>
  );
}

async function exportData(csv = false) {
  const raw = getRawDB();
  let payload: string;
  let ext: string;
  let mime: string;
  if (csv) {
    const rows = raw.getAllSync<Record<string, unknown>>(`SELECT * FROM transactions ORDER BY date DESC`);
    const cols = ['id', 'type', 'amount', 'category', 'account_id', 'to_account_id', 'note', 'date', 'halal_status'];
    const header = cols.join(',');
    const lines = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','));
    payload = [header, ...lines].join('\n');
    ext = 'csv';
    mime = 'text/csv';
  } else {
    const transactions = raw.getAllSync(`SELECT * FROM transactions`);
    const accounts = raw.getAllSync(`SELECT * FROM accounts`);
    const budgets = raw.getAllSync(`SELECT * FROM budgets`);
    const recurring = raw.getAllSync(`SELECT * FROM recurring`);
    payload = JSON.stringify({ transactions, accounts, budgets, recurring }, null, 2);
    ext = 'json';
    mime = 'application/json';
  }
  const file = `${FileSystem.cacheDirectory}moneyflow-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(file, payload);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file, { mimeType: mime });
  } else {
    Alert.alert('Saved', `File written to ${file}`);
  }
}

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

// ---- Tiny shared sub-components ----

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

function SummaryCard({ label, value, color, currency }: { label: string; value: number; color: string; currency: CurrencyCode }) {
  return (
    <View style={[styles.summary, { borderColor: theme.border }]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{formatMoney(value, currency)}</Text>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: { padding: spacing.lg, gap: spacing.md },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  tabRow: { gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  tabActive: { backgroundColor: theme.accent, borderColor: 'transparent' },
  tabText: { color: theme.text2, fontSize: sizes.sm, textTransform: 'capitalize' },
  tabTextActive: { color: theme.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  section: { color: theme.text2, fontSize: sizes.sm, textTransform: 'uppercase', letterSpacing: 1 },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summary: { flex: 1, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, gap: 4, backgroundColor: theme.bg2 },
  summaryLabel: { color: theme.text2, fontSize: sizes.xs },
  summaryValue: { fontSize: sizes.xl, fontFamily: font.display, fontWeight: '700' },
  disposableCard: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disposableLabel: { color: theme.text2, fontSize: sizes.sm },
  disposableValue: { fontSize: sizes.xl, fontFamily: font.display, fontWeight: '700' },
  budgetCard: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border, gap: 8 },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetName: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  budgetAmt: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.display },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  budgetActions: { flexDirection: 'row', gap: spacing.lg },
  actionText: { color: theme.accent, fontSize: sizes.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border },
  addText: { fontSize: sizes.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexBasis: '47%', flexGrow: 1, padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  statLabel: { color: theme.text2, fontSize: sizes.xs },
  statValue: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.display, fontWeight: '700', marginTop: 4 },
  catLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { color: theme.text1, fontSize: sizes.sm, flex: 1 },
  catAmt: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.display },
  catPct: { color: theme.text3, fontSize: sizes.xs, marginStart: 6, width: 36, textAlign: 'right' },
  acctCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  iconBox: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  acctName: { color: theme.text1, fontSize: sizes.md },
  acctType: { color: theme.text3, fontSize: sizes.xs, textTransform: 'capitalize' },
  acctBal: { fontSize: sizes.lg, fontFamily: font.display, fontWeight: '700' },
  chipRow: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg2 },
  chipText: { color: theme.text2, fontSize: sizes.sm },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  settingLabel: { color: theme.text1, fontSize: sizes.md },
  settingHint: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  toggle: { width: 40, height: 22, borderRadius: 11, padding: 2, backgroundColor: theme.bg3, justifyContent: 'center' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.text1 },
});
