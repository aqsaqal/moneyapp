// Add transaction modal — v2 Smart Add.
//
// Median expense in 3 interactions:
//   1. Tap FAB
//   2. Type "12 coffee" (or speak it via mic)
//   3. Tap "Add Expense"
// Category + account are predicted via 4-layer chain in useSmartPredict.
//
// Layout:
//   header: [×] [mode pills] [✓]
//   amount: $ ▎ <big-number>
//   note  : input + mic
//   row   : SmartSuggestionRow (recent merchants + exact replays)
//   strip : PredictedStrip (cat · account, tap to override)
//     ↓ if expanded ↓
//   override: classic cat grid + account picker
//   numpad
//   CTA
//
// Override path remains for power users who want explicit control.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { Numpad } from '@/components/Numpad';
import { CategoryTile } from '@/components/CategoryTile';
import { SuccessOverlay } from '@/components/SuccessOverlay';
import { SmartSuggestionRow } from '@/components/SmartSuggestionRow';
import { PredictedStrip } from '@/components/PredictedStrip';
import { VoiceMicButton } from '@/components/VoiceMicButton';
import { ReceiptScanButton } from '@/components/ReceiptScanButton';
import { PickerSheet } from '@/components/PickerSheet';
import { FeatureSlots } from '@/features';
import { useAccounts, addTransaction } from '@/hooks/useAppData';
import { useSmartPredict, setDefaultAccount } from '@/hooks/useSmartPredict';
import { useT } from '@/hooks/useT';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { convert } from '@/utils/fx';
import { CURRENCIES } from '@/constants/currency';
import { allExpenseCategories, allIncomeCategories } from '@/constants/categories';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { useHaptics } from '@/hooks/useHaptics';
import type { Transaction } from '@/utils/db/schema';

type Mode = 'expense' | 'income' | 'transfer';

export default function AddScreen() {
  const router = useRouter();
  const t = useT();
  const haptics = useHaptics();
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const locale = kv.get('locale') ?? 'en-US';

  const [mode, setMode] = useState<Mode>('expense');
  const [amount, setAmount] = useState('0');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<Partial<Transaction>>({});
  const [success, setSuccess] = useState(false);
  const [successCaption, setSuccessCaption] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  // Smart prediction (only meaningful for expenses).
  const predicted = useSmartPredict({
    note,
    amount: parseFloat(amount) || 0,
  });

  // Allow user override of predicted cat / account.
  const [catOverride, setCatOverride] = useState<string | null>(null);
  const [accountOverride, setAccountOverride] = useState<string | null>(null);
  // Multi-currency entry: when the user is spending in a currency different
  // from their account's currency, they enter the original currency's
  // amount and we convert via the FX cache to the account currency at save.
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode | null>(null);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  // Effective values feed the actual submit.
  const effectiveCat = mode === 'transfer' ? null : catOverride ?? predicted.category;
  const effectiveAcct =
    accountOverride ?? predicted.accountId ?? accounts[0]?.id ?? 'cash';

  // Transfer mode: from/to accounts (separate from prediction).
  const [fromAcct, setFromAcct] = useState<string>(accounts[0]?.id ?? 'cash');
  const [toAcct, setToAcct] = useState<string>(accounts[1]?.id ?? 'savings');

  useEffect(() => {
    // Set sensible from/to defaults once accounts load.
    if (accounts.length >= 2) {
      setFromAcct((p) => (accounts.find((a) => a.id === p) ? p : accounts[0].id));
      setToAcct((p) => (accounts.find((a) => a.id === p) ? p : accounts[1].id));
    }
  }, [accounts]);

  const onKey = (k: string) => {
    if (k === 'C') return setAmount('0');
    if (k === 'del') return setAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    if (k === '.') return setAmount((a) => (a.includes('.') ? a : a + '.'));
    setAmount((a) => (a === '0' ? k : a + k));
  };

  // The account's own currency. When entryCurrency differs from this we
  // compute the account-currency `amount` via FX and persist the original
  // amount + currency alongside.
  const acctCurrencyFor = (id: string): CurrencyCode => {
    const a = accounts.find((x) => x.id === id);
    return ((a?.currency as CurrencyCode | null) ?? currency) as CurrencyCode;
  };
  const accountCurrency = acctCurrencyFor(
    mode === 'transfer' ? fromAcct : effectiveAcct,
  );
  // entryCurrency defaults to the account's currency. When the user picks
  // a different one, we surface the converted account-currency value
  // beneath the amount as a small subline.
  const effectiveEntryCurrency: CurrencyCode = entryCurrency ?? accountCurrency;
  const isMixed = effectiveEntryCurrency !== accountCurrency;

  const submit = () => {
    const v = parseFloat(amount);
    if (!v) return;

    // For mixed-currency entries: amount the user typed is in
    // entryCurrency; we persist `amount` in account currency.
    const accountAmount = isMixed
      ? convert(v, effectiveEntryCurrency, accountCurrency)
      : v;
    const originalAmount = isMixed ? v : null;
    const originalCurrency = isMixed ? effectiveEntryCurrency : null;

    if (mode === 'transfer') {
      if (fromAcct === toAcct) return;
      addTransaction({
        type: 'transfer',
        amount: accountAmount,
        accountId: fromAcct,
        toAccountId: toAcct,
        note: note || null,
        originalAmount,
        originalCurrency,
      });
    } else {
      // Expense or income: needs category. Predicted strip should always
      // populate one in normal use, but the user can override or, in the
      // worst case, pick from the override grid.
      if (!effectiveCat) {
        // Force the override grid open so the user can pick.
        setOverrideOpen(true);
        return;
      }
      addTransaction({
        type: mode,
        amount: accountAmount,
        category: effectiveCat,
        accountId: effectiveAcct,
        note: note || null,
        halalStatus: (draft.halalStatus as Transaction['halalStatus']) ?? null,
        receiptImagePath: (draft.receiptImagePath as string | undefined) ?? null,
        asnaf: (draft as { asnaf?: string | null }).asnaf ?? null,
        originalAmount,
        originalCurrency,
      });
      // Remember the user's account choice so L4 fallback can lock in.
      setDefaultAccount(effectiveAcct);
      // Delight moment: when the prediction had real prior evidence and the
      // user didn't override, surface the source so they feel the magic.
      const usedPrediction = !catOverride && predicted.source && predicted.evidence;
      if (usedPrediction && predicted.evidence) {
        const ev = predicted.evidence;
        const key = ev.count === 1 ? 'add.predicted.one' : 'add.predicted';
        setSuccessCaption(t(key, { n: ev.count, token: ev.token }));
      } else {
        setSuccessCaption(null);
      }
    }
    haptics.success();
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setSuccessCaption(null);
      router.back();
    }, 900);
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
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.modeTab, mode === m && styles.modeActive]}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{t(`add.${m}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={submit} hitSlop={10} accessibilityLabel="Submit">
          <MaterialCommunityIcons name="check" size={24} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.amountRow}>
          <Text
            style={styles.amount}
            accessibilityLabel={`Amount ${currencyPrefix(effectiveEntryCurrency)}${amount}`}
            accessibilityLiveRegion="polite"
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {currencyPrefix(effectiveEntryCurrency)}
            {amount}
          </Text>
          <Pressable
            onPress={() => setCurrencyPickerOpen(true)}
            style={styles.currencyChip}
            accessibilityRole="button"
            accessibilityLabel={`Currency ${effectiveEntryCurrency}, tap to change`}
          >
            <Text style={styles.currencyChipText}>{effectiveEntryCurrency}</Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color={theme.text2} />
          </Pressable>
        </View>
        {isMixed && Number(amount) > 0 && (
          <Text style={styles.fxConvertedLine}>
            ≈ {currencyPrefix(accountCurrency)}
            {convert(parseFloat(amount) || 0, effectiveEntryCurrency, accountCurrency).toFixed(
              CURRENCIES[accountCurrency].decimalDigits,
            )}{' '}
            withdrawn from {accountCurrency}
          </Text>
        )}
        <CurrencyPickerSheet
          visible={currencyPickerOpen}
          title={t('me.currency')}
          selected={effectiveEntryCurrency}
          onPick={(c) => setEntryCurrency(c)}
          onClose={() => setCurrencyPickerOpen(false)}
        />

        {/* Note input + voice mic. */}
        <View style={styles.noteRow}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('add.notePlaceholder')}
            placeholderTextColor={theme.text3}
            style={styles.note}
          />
          <VoiceMicButton
            locale={locale}
            onResult={({ amount: a, note: n }) => {
              if (a !== null) setAmount(String(a));
              if (n) setNote(n);
            }}
          />
          <ReceiptScanButton
            onScanned={({ amount: a, note: n, receiptUri }) => {
              if (a !== null) setAmount(String(a));
              if (n) setNote(n);
              setDraft((d) => ({ ...d, receiptImagePath: receiptUri }));
            }}
          />
        </View>

        {/* Smart suggestions: fuzzy merchants + exact replays. Skip for transfers. */}
        {mode === 'expense' && (
          <SmartSuggestionRow
            currency={currency}
            amountEntered={amount !== '0' && amount !== ''}
            onPickExact={(t) => {
              // 1-tap submit identical txn.
              addTransaction({
                type: 'expense',
                amount: t.amount,
                category: t.category,
                accountId: t.accountId,
                note: t.note,
              });
              haptics.success();
              setSuccess(true);
              setTimeout(() => { setSuccess(false); router.back(); }, 700);
            }}
            onPickFuzzy={(m) => {
              // Fill note + override cat/account; user adjusts amount.
              setNote(m.note);
              setCatOverride(m.category);
              setAccountOverride(m.accountId);
            }}
          />
        )}

        {/* Transfer: from / to as tap-to-pick rows. */}
        {mode === 'transfer' && (
          <View style={styles.transferRow}>
            <TransferAcctRow
              label={t('add.transfer.from')}
              accounts={accounts}
              value={fromAcct}
              onPick={setFromAcct}
            />
            <MaterialCommunityIcons name="arrow-right" size={20} color={theme.text3} />
            <TransferAcctRow
              label={t('add.transfer.to')}
              accounts={accounts}
              value={toAcct}
              onPick={setToAcct}
            />
          </View>
        )}

        {/* Predicted strip — expense/income only. */}
        {mode !== 'transfer' && (
          <PredictedStrip
            category={effectiveCat}
            accountId={effectiveAcct}
            accounts={accounts}
            source={predicted.source}
            expanded={overrideOpen}
            onToggle={() => setOverrideOpen((x) => !x)}
          />
        )}

        {/* Override (cat grid + account picker) — collapsed by default. */}
        {mode !== 'transfer' && overrideOpen && (
          <View style={{ gap: spacing.md }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.acctRow}
            >
              {accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => setAccountOverride(a.id)}
                  style={[
                    styles.acctPill,
                    effectiveAcct === a.id && {
                      backgroundColor: a.color,
                      borderColor: 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.acctText, effectiveAcct === a.id && { color: theme.bg }]}>
                    {a.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.catGrid}>
              {cats.map((c) => (
                <CategoryTile
                  key={c.id}
                  cat={c}
                  selected={effectiveCat === c.id}
                  onPress={() => {
                    setCatOverride(c.id);
                    // Auto-collapse the override panel after a category pick
                    // — saves a separate tap to close.
                    setOverrideOpen(false);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Islamic AddTxExtras — halal selector + asnaf for giving categories.
            Generic: nothing renders. We pass `category: effectiveCat` so the
            asnaf picker can gate itself to zakat/sadaqa/qurban. */}
        <FeatureSlots.AddTxExtras
          txDraft={{ ...draft, category: effectiveCat }}
          onChange={(p) => setDraft({ ...draft, ...p })}
        />

        <Numpad onPress={onKey} />

        <Pressable
          onPress={submit}
          style={({ pressed }) => [styles.submit, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <Text style={styles.submitText}>
            {t(mode === 'expense' ? 'add.cta.expense' : mode === 'income' ? 'add.cta.income' : 'add.cta.transfer')}
          </Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>

      <SuccessOverlay visible={success} caption={successCaption} />
    </SafeAreaView>
  );
}

/** Compact transfer-mode account selector row.
 *  Shows label + currently-picked account name. Tap → PickerSheet opens
 *  with all accounts.
 */
function TransferAcctRow({
  label,
  accounts,
  value,
  onPick,
}: {
  label: string;
  accounts: { id: string; name: string; color: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const acct = accounts.find((a) => a.id === value);
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.transferLabel}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.transferRowChip, acct && { borderColor: `${acct.color}88` }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${acct?.name ?? 'pick account'}`}
      >
        <View style={[styles.transferDot, { backgroundColor: acct?.color ?? theme.text3 }]} />
        <Text style={styles.transferRowText}>{acct?.name ?? 'Pick account'}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={theme.text3} />
      </Pressable>
      <PickerSheet
        visible={open}
        title={`${label} account`}
        options={accounts.map((a) => ({ value: a.id, label: a.name, iconColor: a.color, icon: 'wallet-outline' }))}
        selected={value}
        onPick={onPick}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function currencyPrefix(c: CurrencyCode): string {
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  return c + ' ';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: radii.pill,
    backgroundColor: theme.bg2,
  },
  modeTab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill },
  modeActive: { backgroundColor: theme.accent },
  modeText: { color: theme.text2, fontSize: sizes.sm, textTransform: 'capitalize' },
  modeTextActive: { color: theme.bg, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  amount: {
    color: theme.text1,
    fontSize: 56,
    fontFamily: font.displayBold,
    textAlign: 'center',
    flexShrink: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  currencyChipText: { color: theme.text1, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  fxConvertedLine: {
    color: theme.text3,
    fontSize: 13,
    textAlign: 'center',
    marginTop: -8,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.bg2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  note: {
    flex: 1,
    color: theme.text1,
    fontFamily: font.body,
    fontSize: sizes.md,
    paddingVertical: 0,
  },
  acctRow: { gap: 8 },
  acctPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  acctText: { color: theme.text2, fontSize: sizes.sm },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  transferLabel: { color: theme.text2, fontSize: sizes.xs, marginBottom: 6 },
  transferRowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  transferDot: { width: 10, height: 10, borderRadius: 5 },
  transferRowText: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.body, flex: 1 },
  submit: {
    backgroundColor: theme.accent,
    padding: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  submitText: {
    color: theme.bg,
    fontSize: sizes.lg,
    fontWeight: '700',
    fontFamily: font.display,
  },
});
