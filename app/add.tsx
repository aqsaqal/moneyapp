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
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { useAccounts, addTransaction, linkRecurringPaid, updateTransaction, deleteTransaction, useTransactions, useCategoriesWithMeta, useCategoryFrequency, useMonthTotalsByCategory, AccountValidationError } from '@/hooks/useAppData';
import { CategoryPicker } from '@/components/CategoryPicker';
import { monthKey } from '@/utils/format';
import { useSmartPredict, setDefaultAccount } from '@/hooks/useSmartPredict';
import { useT } from '@/hooks/useT';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { convert } from '@/utils/fx';
import { CURRENCIES } from '@/constants/currency';
// Lazy-imported so a binary that predates the native module shows a
// graceful fallback instead of crashing.
type DateTimePickerModule = typeof import('@react-native-community/datetimepicker').default;
let _datePicker: DateTimePickerModule | null = null;
function getDatePicker(): DateTimePickerModule | null {
  if (_datePicker) return _datePicker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _datePicker = require('@react-native-community/datetimepicker').default as DateTimePickerModule;
    return _datePicker;
  } catch {
    return null;
  }
}
import { allExpenseCategories, allIncomeCategories } from '@/constants/categories';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { useHaptics } from '@/hooks/useHaptics';
import type { Transaction } from '@/utils/db/schema';

type Mode = 'expense' | 'income' | 'transfer';

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function AddScreen() {
  const router = useRouter();
  const t = useT();
  const haptics = useHaptics();
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const locale = kv.get('locale') ?? 'en-US';

  // Phase 10v: when launched from a Plan item (recurring bill, goal,
  // debt) the caller passes ?prefill=<base64 JSON> so we open with the
  // amount / category / account / type / currency / date populated.
  const params = useLocalSearchParams<{ prefill?: string }>();
  const prefill = useMemo(() => {
    if (!params.prefill) return null;
    try {
      const decoded =
        typeof globalThis.atob === 'function'
          ? globalThis.atob(params.prefill)
          : Buffer.from(params.prefill, 'base64').toString('utf8');
      return JSON.parse(decoded) as {
        type?: Mode;
        amount?: number;
        /** Account-currency amount for mixed-FX edits — seeds the
         *  editable converted-amount line. */
        accountAmount?: number;
        accountId?: string;
        toAccountId?: string;
        category?: string;
        note?: string;
        originalCurrency?: string;
        date?: number;
        /** When set, after Smart Add successfully creates a tx we also
         *  insert a paid_items row so the checkbox flips to "paid". */
        recurringId?: string;
        /** When set, submit calls updateTransaction(editId, ...) instead
         *  of addTransaction(...), turning Smart Add into the edit form. */
        editId?: string;
      };
    } catch {
      return null;
    }
  }, [params.prefill]);

  const isEditing = !!prefill?.editId;
  const [mode, setMode] = useState<Mode>(prefill?.type ?? 'expense');
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '0');
  const [note, setNote] = useState(prefill?.note ?? '');
  const [txDate, setTxDate] = useState<Date>(prefill?.date ? new Date(prefill.date) : new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Transaction>>({});
  const [success, setSuccess] = useState(false);
  const [successCaption, setSuccessCaption] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  // Smart prediction (only meaningful for expenses).
  const predicted = useSmartPredict({
    note,
    amount: parseFloat(amount) || 0,
  });

  // Allow user override of predicted cat / account. Prefill seeds them.
  const [catOverride, setCatOverride] = useState<string | null>(prefill?.category ?? null);
  const [accountOverride, setAccountOverride] = useState<string | null>(prefill?.accountId ?? null);
  // Multi-currency entry: when the user is spending in a currency different
  // from their account's currency, they enter the original currency's
  // amount and we convert via the FX cache to the account currency at save.
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode | null>(
    (prefill?.originalCurrency as CurrencyCode | undefined) ?? null,
  );
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  // When the user manually edits the converted account-currency amount —
  // e.g. their bank used a slightly different FX rate than our cached
  // mid-market quote — we honor that instead of the auto conversion.
  // null = use auto convert(); a number string = override.
  const [accountAmountOverride, setAccountAmountOverride] = useState<string | null>(
    prefill?.accountAmount != null ? String(prefill.accountAmount) : null,
  );

  // Phase 10w: top-6 category chip strip + grid bottom sheet for fast
  // picking. Order: pinned → recency frequency → alpha. Stable within a
  // session (recomputed only when category set or frequency map changes).
  const categories = useCategoriesWithMeta();
  const catFreq = useCategoryFrequency({ days: 60 });
  const monthTotals = useMonthTotalsByCategory(monthKey(), 'expense');
  const [gridOpen, setGridOpen] = useState(false);
  const top6Categories = useMemo(() => {
    const eligible = categories.filter(
      (c) =>
        !c.archived &&
        c.id !== 'adjustment' &&
        (mode === 'income' ? c.type !== 'expense' : c.type !== 'income'),
    );
    return [...eligible]
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const fa = catFreq.get(a.id) ?? 0;
        const fb = catFreq.get(b.id) ?? 0;
        if (fa !== fb) return fb - fa;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 6);
  }, [categories, catFreq, mode]);

  // Confidence check: L1 (keyword) or L2 (merchant memory) with at least
  // one supporting prior add count as "high confidence" (~>70%). L3 (time
  // of day) and L4 (default fallback) are weak — we'd rather show the
  // user's most recent pick of the same mode than push a low-confidence
  // guess into the form.
  const highConfidence =
    (predicted.source === 'l1-keyword' || predicted.source === 'l2-memory') &&
    (predicted.evidence?.count ?? 0) > 0;
  // Last-used fallback: pull the most recent expense or income (matches
  // the current mode) so a low-confidence prediction surfaces familiar
  // defaults rather than a stale L4 "most-used this month" guess.
  const recent = useTransactions({ limit: 5 });
  const lastOfMode = useMemo(
    () => recent.find((tx) => tx.type === mode),
    [recent, mode],
  );
  // Effective values feed the actual submit. Above 70% confidence we
  // trust the predictor; below, we trust the user's last pick.
  const fallbackCat = highConfidence
    ? predicted.category
    : lastOfMode?.category ?? predicted.category;
  const fallbackAcct = highConfidence
    ? predicted.accountId
    : lastOfMode?.accountId ?? predicted.accountId;
  const effectiveCat = mode === 'transfer' ? null : catOverride ?? fallbackCat;
  const effectiveAcct =
    accountOverride ?? fallbackAcct ?? accounts[0]?.id ?? 'cash';

  // Transfer mode: from/to accounts (separate from prediction).
  const [fromAcct, setFromAcct] = useState<string>(
    prefill?.accountId ?? accounts[0]?.id ?? 'cash',
  );
  const [toAcct, setToAcct] = useState<string>(
    prefill?.toAccountId ?? accounts[1]?.id ?? 'savings',
  );

  useEffect(() => {
    // Set sensible from/to defaults once accounts load. Don't clobber
    // an explicit prefill (e.g. editing a transfer).
    if (accounts.length >= 2) {
      setFromAcct((p) => (accounts.find((a) => a.id === p) ? p : prefill?.accountId ?? accounts[0].id));
      setToAcct((p) => (accounts.find((a) => a.id === p) ? p : prefill?.toAccountId ?? accounts[1].id));
    }
  }, [accounts, prefill?.accountId, prefill?.toAccountId]);

  // Phase 10z: calc mode appends operators to the amount string. The
  // amount field doubles as an expression display. Submit evaluates it.
  const [calcOpen, setCalcOpen] = useState(false);
  const onKey = (k: string) => {
    if (k === 'C') return setAmount('0');
    if (k === 'del') return setAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    if (k === '.') {
      // Don't allow a second dot in the same numeric segment.
      return setAmount((a) => {
        const lastOp = Math.max(a.lastIndexOf('+'), a.lastIndexOf('-'), a.lastIndexOf('*'), a.lastIndexOf('/'));
        const tail = a.slice(lastOp + 1);
        return tail.includes('.') ? a : a + '.';
      });
    }
    setAmount((a) => (a === '0' ? k : a + k));
  };
  const onCalcOp = (op: '+' | '-' | '*' | '/') => {
    setAmount((a) => {
      // Replace a trailing operator instead of stacking — same UX as
      // every calculator app.
      if (/[+\-*/]$/.test(a)) return a.slice(0, -1) + op;
      return a + op;
    });
  };
  const evalAmount = (raw: string): number => {
    // Allow only digits, dot, and the four operators. Anything else
    // returns NaN so submit() bails. Tiny shunting-yard parser to
    // honor precedence without using eval / Function.
    if (!/^[0-9.+\-*/]+$/.test(raw)) return NaN;
    const tokens: Array<number | string> = [];
    let buf = '';
    for (const ch of raw) {
      if ('+-*/'.includes(ch)) {
        if (buf) { tokens.push(parseFloat(buf)); buf = ''; }
        tokens.push(ch);
      } else buf += ch;
    }
    if (buf) tokens.push(parseFloat(buf));
    // Strip a trailing operator if the user submitted mid-expression.
    if (typeof tokens[tokens.length - 1] === 'string') tokens.pop();
    if (tokens.length === 0) return NaN;
    // Two passes: * /, then + -.
    const pass = (ops: string[]): boolean => {
      for (let i = 1; i < tokens.length - 1; i += 2) {
        const op = tokens[i] as string;
        if (!ops.includes(op)) continue;
        const a = tokens[i - 1] as number;
        const b = tokens[i + 1] as number;
        const r = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
        tokens.splice(i - 1, 3, r);
        return true;
      }
      return false;
    };
    while (pass(['*', '/'])) { /* keep folding */ }
    while (pass(['+', '-'])) { /* keep folding */ }
    return typeof tokens[0] === 'number' ? tokens[0] : NaN;
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

  const doSubmit = (opts: { skipCashCheck?: boolean } = {}) => {
    submitInner(opts);
  };

  const submit = () => doSubmit();

  const submitInner = (opts: { skipCashCheck?: boolean }) => {
    // Amount may be a tiny expression like "100+50*2" when calc mode
    // was used. evalAmount() returns the resolved number or NaN.
    const v = evalAmount(amount);
    if (!Number.isFinite(v) || v <= 0) return;

    // For mixed-currency entries: amount the user typed is in
    // entryCurrency; we persist `amount` in account currency. If the
    // user manually overrode the converted line (e.g. bank used a
    // non-mid-market rate), honor that instead of the FX convert().
    const overrideNum = accountAmountOverride
      ? parseFloat(accountAmountOverride.replace(',', '.'))
      : NaN;
    const accountAmount = isMixed
      ? Number.isFinite(overrideNum) && overrideNum > 0
        ? overrideNum
        : convert(v, effectiveEntryCurrency, accountCurrency)
      : v;
    const originalAmount = isMixed ? v : null;
    const originalCurrency = isMixed ? effectiveEntryCurrency : null;

    let createdTxId: string | null = null;
    // Wrap each insert in a cash-negative guard. The hook throws when a
    // Cash-type account would drop below zero; we catch + prompt, then
    // retry with skipCashCheck=true if the user opts in.
    const handleValidation = (e: unknown): boolean => {
      if (e instanceof AccountValidationError && e.code === 'cash_negative') {
        if (opts.skipCashCheck) return false;
        Alert.alert(
          'Cash will go negative',
          `This will make the account go below zero (projected ${e.details.projected.toFixed(2)}). Cash accounts usually can't carry a negative balance — switch to a credit/debt account, or continue anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => submitInner({ skipCashCheck: true }) },
          ],
        );
        return true;
      }
      throw e;
    };
    if (mode === 'transfer') {
      if (fromAcct === toAcct) return;
      if (isEditing && prefill?.editId) {
        updateTransaction(prefill.editId, {
          type: 'transfer',
          amount: accountAmount,
          accountId: fromAcct,
          toAccountId: toAcct,
          category: null,
          note: note || null,
          date: txDate.getTime(),
          originalAmount,
          originalCurrency,
        });
      } else {
        try {
          const tx = addTransaction({
            type: 'transfer',
            amount: accountAmount,
            accountId: fromAcct,
            toAccountId: toAcct,
            note: note || null,
            date: txDate.getTime(),
            originalAmount,
            originalCurrency,
          }, { skipCashCheck: opts.skipCashCheck });
          createdTxId = tx.id;
        } catch (e) {
          if (handleValidation(e)) return;
        }
      }
    } else {
      // Expense or income: needs category. Predicted strip should always
      // populate one in normal use, but the user can override or, in the
      // worst case, pick from the override grid.
      if (!effectiveCat) {
        // Force the override grid open so the user can pick.
        setOverrideOpen(true);
        return;
      }
      if (isEditing && prefill?.editId) {
        updateTransaction(prefill.editId, {
          type: mode,
          amount: accountAmount,
          category: effectiveCat,
          accountId: effectiveAcct,
          toAccountId: null,
          note: note || null,
          date: txDate.getTime(),
          originalAmount,
          originalCurrency,
        });
      } else {
        try {
          const tx = addTransaction({
            type: mode,
            amount: accountAmount,
            category: effectiveCat,
            accountId: effectiveAcct,
            note: note || null,
            date: txDate.getTime(),
            halalStatus: (draft.halalStatus as Transaction['halalStatus']) ?? null,
            receiptImagePath: (draft.receiptImagePath as string | undefined) ?? null,
            asnaf: (draft as { asnaf?: string | null }).asnaf ?? null,
            originalAmount,
            originalCurrency,
          }, { skipCashCheck: opts.skipCashCheck });
          createdTxId = tx.id;
          // Remember the user's account choice so L4 fallback can lock in.
          setDefaultAccount(effectiveAcct);
        } catch (e) {
          if (handleValidation(e)) return;
        }
      }
    }
    // Phase 10v: when launched from a recurring row's checkbox, flip
    // the row to "paid" by inserting the paid_items link.
    if (createdTxId && prefill?.recurringId) {
      linkRecurringPaid(prefill.recurringId, createdTxId, txDate);
    }
    // Re-open the lower brace below by aliasing — restoring the
    // original else-block close.
    {
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
          <View style={styles.fxConvertedRow}>
            <Text style={styles.fxConvertedPrefix}>
              {accountAmountOverride ? '=' : '≈'} {currencyPrefix(accountCurrency)}
            </Text>
            <TextInput
              value={
                accountAmountOverride ??
                convert(parseFloat(amount) || 0, effectiveEntryCurrency, accountCurrency).toFixed(
                  CURRENCIES[accountCurrency].decimalDigits,
                )
              }
              onChangeText={(v) => setAccountAmountOverride(v === '' ? null : v)}
              keyboardType="numbers-and-punctuation"
              style={styles.fxConvertedInput}
              accessibilityLabel={`Converted amount in ${accountCurrency}`}
            />
            <Text style={styles.fxConvertedSuffix}>
              {accountCurrency}{' '}
              {accountAmountOverride ? '(edited)' : 'auto'}
            </Text>
            {accountAmountOverride && (
              <Pressable
                onPress={() => setAccountAmountOverride(null)}
                hitSlop={10}
                accessibilityLabel="Reset to auto-convert"
              >
                <MaterialCommunityIcons name="refresh" size={14} color={theme.text3} />
              </Pressable>
            )}
          </View>
        )}
        {/* Date — small grey text directly under the amount. Always
            visible; tap (or the 📅 key in the numpad's right column)
            to open the picker. Day matters for analytics, budgets,
            and the day-grouped Activity list. */}
        <Pressable
          onPress={() => setDatePickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Date ${txDate.toDateString()}, tap to change`}
          hitSlop={8}
        >
          <Text style={styles.dateInlineText}>
            {isSameDay(txDate, new Date())
              ? `Today · ${txDate.toLocaleDateString()}`
              : txDate.toLocaleDateString()}
          </Text>
        </Pressable>
        {datePickerOpen && (() => {
          const DateTimePicker = getDatePicker();
          if (!DateTimePicker) {
            setDatePickerOpen(false);
            return null;
          }
          return (
            <DateTimePicker
              value={txDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date(Date.now() + 365 * 86_400_000)}
              onChange={(event, selected) => {
                setDatePickerOpen(false);
                if (event.type === 'set' && selected) setTxDate(selected);
              }}
            />
          );
        })()}
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

        {/* Phase 10w: top-6 category chip strip + "More…" → full grid.
            Tapping a chip sets catOverride directly so the user doesn't
            have to expand the override drawer for common categories. */}
        {(mode === 'expense' || mode === 'income') && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipStrip}
            keyboardShouldPersistTaps="handled"
          >
            {top6Categories.map((c) => {
              const selected = effectiveCat === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCatOverride(c.id)}
                  style={[
                    styles.catChip,
                    selected && { borderColor: c.color, backgroundColor: `${c.color}22` },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c.name}
                >
                  <MaterialCommunityIcons
                    name={(c.icon as never) || 'tag-outline'}
                    size={14}
                    color={selected ? c.color : theme.text2}
                  />
                  <Text style={[styles.catChipText, selected && { color: c.color }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setGridOpen(true)}
              style={[styles.catChip, styles.catChipMore]}
              accessibilityRole="button"
              accessibilityLabel="More categories"
            >
              <Text style={[styles.catChipText, { color: theme.text2 }]}>More…</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* Inline budget bar — only when an expense category with a
            monthly_budget is selected. Live-projects the impact of the
            currently-typed amount. */}
        {mode === 'expense' && effectiveCat && (() => {
          const cat = categories.find((c) => c.id === effectiveCat);
          if (!cat || cat.monthlyBudget == null) return null;
          const spent = monthTotals.find((m) => m.category === effectiveCat)?.total ?? 0;
          const ccy = cat.budgetCurrency ?? currency;
          // Display in the budget's currency. Convert spent + the new
          // amount via FX cache when they differ from budget currency.
          const enteredInBudgetCcy =
            (parseFloat(amount) || 0) > 0
              ? ccy === effectiveEntryCurrency
                ? parseFloat(amount)
                : convert(parseFloat(amount) || 0, effectiveEntryCurrency, ccy)
              : 0;
          const spentInBudgetCcy = ccy === currency ? spent : convert(spent, currency, ccy);
          const projected = spentInBudgetCcy + enteredInBudgetCcy;
          const pct = cat.monthlyBudget > 0 ? Math.min(projected / cat.monthlyBudget, 1) : 0;
          const over = projected > cat.monthlyBudget;
          const warn = !over && projected / cat.monthlyBudget >= 0.8;
          const overBy = over ? projected - cat.monthlyBudget : 0;
          const barColor = over ? theme.expense : warn ? '#F97316' : cat.color;
          return (
            <View style={styles.budgetBarWrap}>
              <View style={styles.budgetBarHead}>
                <Text style={styles.budgetBarLabel}>
                  {cat.name}: {spentInBudgetCcy.toFixed(0)} / {cat.monthlyBudget.toFixed(0)} {ccy} this month
                </Text>
              </View>
              <View style={styles.budgetBarBg}>
                <View style={[styles.budgetBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
              </View>
              {over && enteredInBudgetCcy > 0 && (
                <Text style={styles.budgetWarn}>
                  This will put you {overBy.toFixed(0)} {ccy} over your {cat.name} budget.
                </Text>
              )}
            </View>
          );
        })()}

        {/* Smart suggestions — top-3 exact replays from the last month.
            Off by default; user opts in via Settings → Preferences. Tap
            now PREFILLS the form (amount, note, account, category) so
            the user can verify / edit before submitting. */}
        {mode === 'expense' && kv.getBool('smartSuggestions', true) && (
          <SmartSuggestionRow
            currency={currency}
            amountEntered={amount !== '0' && amount !== ''}
            onPickExact={(tx) => {
              setAmount(String(tx.amount));
              setNote(tx.note ?? '');
              if (tx.category) setCatOverride(tx.category);
              setAccountOverride(tx.accountId);
            }}
            onPickFuzzy={(m) => {
              setNote(m.note);
              setCatOverride(m.category);
              setAccountOverride(m.accountId);
            }}
          />
        )}

        {/* Two pickers always visible, From + To, mirroring the 1money
            pattern. Layout per mode:
              expense   →  From account · To category
              income    →  From category · To account
              transfer  →  From account · To account
            Predicted values populate initially; tap to change. */}
        {mode === 'transfer' ? (
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
        ) : (
          (() => {
            // High-confidence prediction (>70%) = L1 keyword or L2
            // merchant memory had at least one supporting prior add.
            // Computed once above (see `highConfidence`). L3/L4 fallbacks
            // and last-used defaults don't earn the auto badge.
            // Auto-fill signal is purely the dashed-border state on the
            // chip; no text label is rendered. Both high-confidence
            // predictions and last-used fallback get the dashed border
            // since both are guesses the user can override.
            const acctAuto =
              !accountOverride && !!predicted.accountId &&
              (highConfidence || !!lastOfMode);
            const catAuto =
              !catOverride && !!fallbackCat &&
              (highConfidence || !!lastOfMode);
            const badge = undefined;
            return (
              <View style={styles.transferRow}>
                {mode === 'expense' ? (
                  <>
                    <TransferAcctRow
                      label={t('add.transfer.from')}
                      accounts={accounts}
                      value={effectiveAcct}
                      onPick={setAccountOverride}
                      auto={acctAuto}
                      autoLabel={badge}
                    />
                    <MaterialCommunityIcons name="arrow-right" size={20} color={theme.text3} />
                    <CategoryPickerRow
                      label={t('add.toCategory')}
                      cats={cats}
                      value={effectiveCat}
                      onPick={setCatOverride}
                      auto={catAuto}
                      autoLabel={badge}
                    />
                  </>
                ) : (
                  <>
                    <CategoryPickerRow
                      label={t('add.fromCategory')}
                      cats={cats}
                      value={effectiveCat}
                      onPick={setCatOverride}
                      auto={catAuto}
                      autoLabel={badge}
                    />
                    <MaterialCommunityIcons name="arrow-right" size={20} color={theme.text3} />
                    <TransferAcctRow
                      label={t('add.transfer.to')}
                      accounts={accounts}
                      value={effectiveAcct}
                      onPick={setAccountOverride}
                      auto={acctAuto}
                      autoLabel={badge}
                    />
                  </>
                )}
              </View>
            );
          })()
        )}

        {/* Islamic AddTxExtras — halal selector + asnaf for giving categories.
            Generic: nothing renders. We pass `category: effectiveCat` so the
            asnaf picker can gate itself to zakat/sadaqa/qurban. */}
        <FeatureSlots.AddTxExtras
          txDraft={{ ...draft, category: effectiveCat }}
          onChange={(p) => setDraft({ ...draft, ...p })}
        />

        {/* Numpad's right column owns the function keys: delete, date,
            calc toggle, and submit (✓). The standalone Add expense /
            Save CTA below the keypad is gone — ✓ is the only submit. */}
        <Numpad
          onPress={onKey}
          onDate={() => setDatePickerOpen(true)}
          onSubmit={submit}
          onCalcToggle={() => setCalcOpen((v) => !v)}
          onCalcOp={onCalcOp}
          calcOpen={calcOpen}
          submitLabel={isEditing ? t('common.save') : t(`add.cta.${mode}`)}
        />

        {isEditing && prefill?.editId && (
          <Pressable
            onPress={() => {
              deleteTransaction(prefill.editId!);
              router.back();
            }}
            style={styles.deleteRow}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
            <Text style={styles.deleteText}>{t('common.delete')}</Text>
          </Pressable>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Inline "More…" picker. Local to /add so the typed amount,
          note and account survive the picker. Unified component:
          shows expense or income categories per current mode, with
          live budget bars and a "+ New" tile. */}
      <CategoryPicker
        visible={gridOpen}
        mode="select"
        transactionType={mode === 'income' ? 'income' : 'expense'}
        showBudgetProgress
        showAddNew
        headerText="Pick category"
        onSelect={(id) => {
          setCatOverride(id);
          setGridOpen(false);
        }}
        onClose={() => setGridOpen(false)}
      />

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
  auto = false,
  autoLabel,
}: {
  label: string;
  accounts: { id: string; name: string; color: string }[];
  value: string;
  onPick: (id: string) => void;
  /** True when the value came from a high-confidence Smart prediction
   *  rather than an explicit user pick. Renders with a dashed border +
   *  small badge so the user knows this was guessed and can tap to
   *  override. */
  auto?: boolean;
  /** Override the badge text. Defaults to "auto". Use "predicted" for
   *  high-confidence model output and "last" for last-used fallback. */
  autoLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const acct = accounts.find((a) => a.id === value);
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.transferLabel}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.transferRowChip,
          acct && { borderColor: `${acct.color}88` },
          auto && styles.transferRowChipAuto,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${acct?.name ?? 'pick account'}${auto ? ', auto-filled' : ''}`}
      >
        <View style={[styles.transferDot, { backgroundColor: acct?.color ?? theme.text3 }]} />
        <Text style={styles.transferRowText}>{acct?.name ?? 'Pick account'}</Text>
        {/* Signal of auto-fill is the dashed border (transferRowChipAuto);
            no text badge — labels like LAST USED / PREDICTED ate the
            chip's horizontal budget. */}
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

/** Same pattern as TransferAcctRow, but for picking a category. Used in
 *  expense + income flows so the layout always reads as From → To. */
function CategoryPickerRow({
  label,
  cats,
  value,
  onPick,
  auto = false,
  autoLabel,
}: {
  label: string;
  cats: { id: string; name: string; color: string }[];
  value: string | null;
  onPick: (id: string) => void;
  auto?: boolean;
  autoLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const cat = value ? cats.find((c) => c.id === value) : undefined;
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.transferLabel}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.transferRowChip,
          cat && { borderColor: `${cat.color}88` },
          auto && styles.transferRowChipAuto,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${cat?.name ?? 'pick category'}${auto ? ', auto-filled' : ''}`}
      >
        <View style={[styles.transferDot, { backgroundColor: cat?.color ?? theme.text3 }]} />
        <Text style={styles.transferRowText}>{cat?.name ?? 'Pick category'}</Text>
        {/* Signal of auto-fill is the dashed border (transferRowChipAuto);
            no text badge — labels like LAST USED / PREDICTED ate the
            chip's horizontal budget. */}
        <MaterialCommunityIcons name="chevron-down" size={16} color={theme.text3} />
      </Pressable>
      <PickerSheet
        visible={open}
        title={label}
        options={cats.map((c) => ({ value: c.id, label: c.name, iconColor: c.color }))}
        selected={value ?? ''}
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
  fxConvertedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginTop: -4,
  },
  fxConvertedPrefix: { color: theme.text3, fontSize: 13 },
  fxConvertedInput: {
    color: theme.text2,
    fontSize: 13,
    fontFamily: font.bodySemi,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.bg2,
    minWidth: 60,
    textAlign: 'right',
  },
  fxConvertedSuffix: { color: theme.text3, fontSize: 13 },
  dateInlineText: {
    color: theme.text3,
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
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
  transferRowChipAuto: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  autoBadge: {
    color: theme.text3,
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.bg1,
    overflow: 'hidden',
  },
  transferDot: { width: 10, height: 10, borderRadius: 5 },
  transferRowText: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.body, flex: 1 },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  deleteText: { color: theme.expense, fontSize: sizes.sm, fontFamily: font.bodySemi },
  chipStrip: { gap: 8, paddingVertical: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  catChipMore: { borderStyle: 'dashed' },
  catChipText: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.body },
  budgetBarWrap: { gap: 4 },
  budgetBarHead: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetBarLabel: { color: theme.text2, fontSize: sizes.xs },
  budgetBarBg: { height: 5, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: 3 },
  budgetWarn: { color: theme.expense, fontSize: sizes.xs, fontFamily: font.bodySemi },
});
