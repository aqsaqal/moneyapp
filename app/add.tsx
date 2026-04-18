// Add transaction modal — ports v4 AddView (lines 468-543).
// Mode toggle (expense/income/transfer) + amount display + category grid +
// account picker + numpad + quick-add pills + halal slot (islamic only).

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { Numpad } from '@/components/Numpad';
import { CategoryTile } from '@/components/CategoryTile';
import { SuccessOverlay } from '@/components/SuccessOverlay';
import { Icon } from '@/components/Icon';
import { FeatureSlots } from '@/features';
import {
  useAccounts,
  addTransaction,
} from '@/hooks/useAppData';
import { useFrequentTxns } from '@/hooks/useFrequentTxns';
import { allExpenseCategories, allIncomeCategories, catInfo } from '@/constants/categories';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { useHaptics } from '@/hooks/useHaptics';
import type { Transaction } from '@/utils/db/schema';

type Mode = 'expense' | 'income' | 'transfer';

export default function AddScreen() {
  const router = useRouter();
  const haptics = useHaptics();
  const accounts = useAccounts();
  const frequents = useFrequentTxns(4);
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const [mode, setMode] = useState<Mode>('expense');
  const [amount, setAmount] = useState('0');
  const [category, setCategory] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? 'cash');
  const [toAccountId, setToAccountId] = useState<string>(accounts[1]?.id ?? 'savings');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<Partial<Transaction>>({});
  const [success, setSuccess] = useState(false);

  const onKey = (k: string) => {
    if (k === 'C') return setAmount('0');
    if (k === 'del') return setAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    if (k === '.') return setAmount((a) => (a.includes('.') ? a : a + '.'));
    setAmount((a) => (a === '0' ? k : a + k));
  };

  const submit = () => {
    const v = parseFloat(amount);
    if (!v) return;
    if (mode === 'transfer') {
      if (accountId === toAccountId) return;
      addTransaction({
        type: 'transfer',
        amount: v,
        accountId,
        toAccountId,
        note: note || null,
      });
    } else {
      if (!category) return;
      addTransaction({
        type: mode,
        amount: v,
        category,
        accountId,
        note: note || null,
        halalStatus: (draft.halalStatus as Transaction['halalStatus']) ?? null,
      });
    }
    haptics.success();
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      router.back();
    }, 700);
  };

  const cats = mode === 'income' ? allIncomeCategories() : allExpenseCategories();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
        <View style={styles.modeRow}>
          {(['expense', 'income', 'transfer'] as Mode[]).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeTab, mode === m && styles.modeActive]}>
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={submit} hitSlop={10} accessibilityLabel="Submit">
          <MaterialCommunityIcons name="check" size={24} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.amount}>{currencyPrefix(currency)}{amount}</Text>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={theme.text3}
          style={styles.note}
        />

        {mode === 'expense' && frequents.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {frequents.map((q, i) => {
              const c = catInfo(q.category);
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    addTransaction({
                      type: 'expense',
                      amount: q.amount,
                      category: q.category,
                      accountId: q.accountId,
                      note: q.note,
                    });
                    haptics.success();
                    setSuccess(true);
                    setTimeout(() => { setSuccess(false); router.back(); }, 700);
                  }}
                  style={[styles.quickPill, { borderColor: c.color }]}
                >
                  <Icon name={c.icon} size={14} color={c.color} />
                  <Text style={styles.quickText}>{q.note || c.name} {formatMoney(q.amount, currency)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Account picker (or From/To for transfer) */}
        {mode === 'transfer' ? (
          <View style={styles.transferRow}>
            <AcctPicker label="From" accounts={accounts} value={accountId} onChange={setAccountId} />
            <MaterialCommunityIcons name="arrow-right" size={20} color={theme.text3} />
            <AcctPicker label="To" accounts={accounts} value={toAccountId} onChange={setToAccountId} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.acctRow}>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAccountId(a.id)}
                style={[styles.acctPill, accountId === a.id && { backgroundColor: a.color, borderColor: 'transparent' }]}
              >
                <Text style={[styles.acctText, accountId === a.id && { color: theme.bg }]}>{a.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Category grid (not in transfer mode) */}
        {mode !== 'transfer' && (
          <View style={styles.catGrid}>
            {cats.map((c) => (
              <CategoryTile
                key={c.id}
                cat={c}
                selected={category === c.id}
                onPress={() => setCategory(c.id)}
              />
            ))}
          </View>
        )}

        {/* Islamic AddTxExtras: halal selector. Generic: nothing renders. */}
        <FeatureSlots.AddTxExtras txDraft={draft} onChange={(p) => setDraft({ ...draft, ...p })} />

        <Numpad onPress={onKey} />

        <Pressable
          onPress={submit}
          style={({ pressed }) => [
            styles.submit,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.submitText}>
            {mode === 'expense' ? 'Add Expense' : mode === 'income' ? 'Add Income' : 'Transfer'}
          </Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>

      <SuccessOverlay visible={success} />
    </SafeAreaView>
  );
}

function AcctPicker({ label, accounts, value, onChange }: { label: string; accounts: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.transferLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => onChange(a.id)}
            style={[styles.acctPill, value === a.id && { backgroundColor: theme.transfer, borderColor: 'transparent' }]}
          >
            <Text style={[styles.acctText, value === a.id && { color: theme.bg }]}>{a.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function currencyPrefix(c: CurrencyCode): string {
  // Compact prefix for the big amount display.
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  return c + ' ';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  modeRow: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: radii.pill, backgroundColor: theme.bg2 },
  modeTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  modeActive: { backgroundColor: theme.accent },
  modeText: { color: theme.text2, fontSize: sizes.sm, textTransform: 'capitalize' },
  modeTextActive: { color: theme.bg, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  amount: { color: theme.text1, fontSize: 56, fontFamily: font.displayBold, textAlign: 'center' },
  note: { backgroundColor: theme.bg2, color: theme.text1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: theme.border, fontFamily: font.body },
  quickRow: { gap: 8 },
  quickPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, backgroundColor: theme.bg2 },
  quickText: { color: theme.text1, fontSize: sizes.xs },
  acctRow: { gap: 8 },
  acctPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg2 },
  acctText: { color: theme.text2, fontSize: sizes.sm },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  transferLabel: { color: theme.text2, fontSize: sizes.xs, marginBottom: 6 },
  submit: { backgroundColor: theme.accent, padding: spacing.md, borderRadius: radii.lg, alignItems: 'center' },
  submitText: { color: theme.bg, fontSize: sizes.lg, fontWeight: '700', fontFamily: font.display },
});
