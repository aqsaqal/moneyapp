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
import { ReceiptScanButton } from '@/components/ReceiptScanButton';
import { PickerSheet } from '@/components/PickerSheet';
import { FeatureSlots } from '@/features';
import { useAccounts, addTransaction, linkRecurringPaid, updateTransaction, deleteTransaction, useTransactions, useCategoriesWithMeta, useMonthTotalsByCategory, AccountValidationError } from '@/hooks/useAppData';
import { CategoryPicker } from '@/components/CategoryPicker';
import { AccountPicker } from '@/components/AccountPicker';
import type { Account } from '@/utils/db/schema';
import { monthKey, daysDiff, relativeDayLabel } from '@/utils/format';
import { decodePrefill } from '@/utils/prefill';
import { useSmartPredict, setDefaultAccount } from '@/hooks/useSmartPredict';
import { useT } from '@/hooks/useT';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { convert } from '@/utils/fx';
import { CURRENCIES, formatMoney, formatSmartAddAmount } from '@/constants/currency';
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
import { t as i18nT } from '@/utils/i18n';
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
  // Full account set including archived. Used ONLY by the transfer
  // pickers so an edited transfer that references a since-archived
  // account can still display + re-select that account on its side.
  // Active pickers (expense/income) keep using the filtered `accounts`.
  const allAccounts = useAccounts({ includeArchived: true });
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const locale = kv.get('locale') ?? 'en-US';

  // Phase 10v: when launched from a Plan item (recurring bill, goal,
  // debt) the caller passes ?prefill=<base64 JSON> so we open with the
  // amount / category / account / type / currency / date populated.
  const params = useLocalSearchParams<{ prefill?: string }>();
  const prefill = useMemo(() => {
    if (!params.prefill) return null;
    // Decode via shared Buffer-based helper — handles Cyrillic, Arabic,
    // Chinese notes that the legacy `atob` path silently choked on.
    return decodePrefill(params.prefill) as {
      type?: Mode;
      amount?: number;
      accountAmount?: number;
      /** Edit-mode only: the stored To-side credit of a cross-currency
       *  transfer. Seeds the To conversion line so a re-save keeps the
       *  user's manual correction instead of re-converting. */
      toAccountAmount?: number;
      accountId?: string;
      toAccountId?: string;
      category?: string;
      note?: string;
      originalCurrency?: string;
      date?: number;
      recurringId?: string;
      /** The month the user originally tapped a recurring's checkbox
       *  from. Set by the Plan tab; used at submit to key the
       *  paid_items link so future-dated txns still mark THIS month
       *  as paid. */
      markMonth?: string;
      editId?: string;
    } | null;
  }, [params.prefill]);

  const isEditing = !!prefill?.editId;
  const [mode, setMode] = useState<Mode>(prefill?.type ?? 'expense');
  // String(20.00) drops to "20" and String(23.2) to "23.2" — both look
  // weird on the Smart Add display when seeded from a recurring's amount.
  // Format with the prefill currency's decimal-digits (default 2) so
  // "20.00" stays "20.00" and "23.20" stays "23.20". The display amount
  // is just a string going into the calc/expression parser — leading
  // trailing zeros don't affect submit math.
  const [amount, setAmount] = useState(() => {
    const a = prefill?.amount;
    if (a == null) return '0';
    const ccy = (prefill?.originalCurrency as CurrencyCode | undefined);
    const digits = (ccy && CURRENCIES[ccy]?.decimalDigits) ?? 2;
    return a.toFixed(digits);
  });
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
    prefill?.accountAmount != null ? prefill.accountAmount.toFixed(2) : null,
  );
  // Phase 10z: independent override for the destination side of a
  // transfer. From-side keeps using accountAmountOverride above so the
  // existing reconciliation logic for non-transfer types stays as-is.
  const [accountAmountOverrideTo, setAccountAmountOverrideTo] = useState<string | null>(
    prefill?.toAccountAmount != null ? prefill.toAccountAmount.toFixed(2) : null,
  );

  // Bug fix: a manual correction on a conversion line is tied to the
  // amount it was typed against. When the user changes the amount
  // afterwards (numpad, suggestion, OCR), drop the stale override so the
  // line flips back to the live auto conversion. The ref lets the prefill
  // re-sync effect below set amount + override together without this
  // effect immediately wiping the override it just seeded.
  // Transient "Enter an amount" hint when ✓ is tapped on 0 / an
  // unparseable expression. Lives in the conversion slot so the
  // layout doesn't jump.
  const [amountError, setAmountError] = useState(false);
  const amountErrorTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashAmountError = () => {
    setAmountError(true);
    if (amountErrorTimer.current) clearTimeout(amountErrorTimer.current);
    amountErrorTimer.current = setTimeout(() => setAmountError(false), 1600);
  };
  useEffect(() => () => { if (amountErrorTimer.current) clearTimeout(amountErrorTimer.current); }, []);
  // A manual conversion is tied to the amount, account pair and entry
  // currency it was typed against. Any user-driven change to those
  // drops it so the line flips back to the live auto conversion.
  // (Prefill re-sync below seeds overrides directly and never goes
  // through these handlers.)
  const resetFxOverrides = () => {
    setAccountAmountOverride(null);
    setAccountAmountOverrideTo(null);
  };
  // Wise-style dual amounts: when currencies differ, the converted
  // account-side amounts render as their own tappable fields and the
  // numpad edits whichever one is focused. `fresh` = the field was just
  // focused and the first digit should replace the auto value.
  type FocusField = 'entry' | 'from' | 'to';
  const [focus, setFocus] = useState<FocusField>('entry');
  const freshRef = React.useRef(false);
  const focusField = (f: FocusField) => {
    setFocus(f);
    freshRef.current = f !== 'entry';
  };
  // Entry amount changed: a manual account-side amount encodes the
  // user's bank rate, so rescale it to the new entry amount instead of
  // throwing it away. Falls back to auto when either side is 0 / NaN
  // (e.g. the amount was cleared or is mid-expression).
  const lastAmountRef = React.useRef(amount);
  useEffect(() => {
    if (amount === lastAmountRef.current) return;
    const prev = evalAmount(lastAmountRef.current);
    const next = evalAmount(amount);
    lastAmountRef.current = amount;
    if (!(prev > 0) || !(next > 0)) {
      resetFxOverrides();
      return;
    }
    const rescale = (o: string | null) => {
      if (o == null) return null;
      const v = evalAmount(o.replace(',', '.'));
      return v > 0 ? ((v * next) / prev).toFixed(2) : null;
    };
    setAccountAmountOverride(rescale);
    setAccountAmountOverrideTo(rescale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  // Re-sync state from prefill whenever the route params change. Expo
  // Router reuses the /add screen instance across navigations from Plan
  // / Activity / Home, so the useState() initializers only fire on the
  // very first mount — without this effect, tapping "income recurring"
  // after the screen has already opened once for an expense leaves the
  // expense state in place. We key on params.prefill (the encoded
  // string, not the decoded object) so identical re-taps still re-init.
  useEffect(() => {
    if (!prefill) return;
    if (prefill.type) setMode(prefill.type);
    if (prefill.amount != null) {
      const ccy = (prefill.originalCurrency as CurrencyCode | undefined);
      const digits = (ccy && CURRENCIES[ccy]?.decimalDigits) ?? 2;
      const next = prefill.amount.toFixed(digits);
      lastAmountRef.current = next;
      setAmount(next);
    }
    if (prefill.note != null) setNote(prefill.note);
    if (prefill.date != null) setTxDate(new Date(prefill.date));
    if (prefill.category != null) setCatOverride(prefill.category);
    if (prefill.accountId != null) setAccountOverride(prefill.accountId);
    if (prefill.originalCurrency != null) {
      setEntryCurrency(prefill.originalCurrency as CurrencyCode);
    }
    if (prefill.accountAmount != null) {
      setAccountAmountOverride(prefill.accountAmount.toFixed(2));
    }
    if (prefill.toAccountAmount != null) {
      setAccountAmountOverrideTo(prefill.toAccountAmount.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.prefill]);

  // Phase 10z: categories metadata still used by the budget context
  // line (below From/To) and the inline CategoryPicker — the top-6
  // chip strip is gone. SmartSuggestionRow handles "More…" → grid now.
  const categories = useCategoriesWithMeta();
  const monthTotals = useMonthTotalsByCategory(monthKey(), 'expense');
  const [gridOpen, setGridOpen] = useState(false);

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
  const acctCurrencyFor = (id: string | null | undefined): CurrencyCode | null => {
    if (!id) return null;
    const a = accounts.find((x) => x.id === id);
    if (!a) return null;
    return ((a.currency as CurrencyCode | null) ?? currency) as CurrencyCode;
  };

  // Phase 10z: per-side account currencies. Expense uses From only,
  // income uses To only, transfer uses both. The "primary" account
  // currency anchors the default transaction currency.
  const fromAccountCcy =
    mode === 'transfer'
      ? acctCurrencyFor(fromAcct)
      : mode === 'expense'
        ? acctCurrencyFor(effectiveAcct)
        : null;
  const toAccountCcy =
    mode === 'transfer'
      ? acctCurrencyFor(toAcct)
      : mode === 'income'
        ? acctCurrencyFor(effectiveAcct)
        : null;
  // Default transaction currency: From for expense/transfer (debit
  // side), To for income. For transfers this means the user types in
  // the source account's currency and the destination is credited
  // with the FX-converted amount. Matches the "I'm sending $100 from
  // my dollar account" mental model.
  const primaryAccountCcy = mode === 'income' ? toAccountCcy : fromAccountCcy;
  const effectiveEntryCurrency: CurrencyCode =
    entryCurrency ?? primaryAccountCcy ?? currency;
  // Per-side conversion need: shown when that side's account currency
  // differs from the transaction currency.
  const showFromConv =
    (mode === 'expense' || mode === 'transfer') &&
    !!fromAccountCcy && fromAccountCcy !== effectiveEntryCurrency;
  const showToConv =
    (mode === 'income' || mode === 'transfer') &&
    !!toAccountCcy && toAccountCcy !== effectiveEntryCurrency;
  // Legacy alias for the existing submit-side math: the single
  // account-currency this transaction is recorded against. Equals the
  // From for expense / transfer (debit side) and the To for income.
  const accountCurrency: CurrencyCode =
    mode === 'income' ? (toAccountCcy ?? currency) : (fromAccountCcy ?? currency);
  const isMixed = effectiveEntryCurrency !== accountCurrency;

  // Auto (market-rate) strings for the converted fields. Two decimals
  // regardless of the currency's minor unit so the field is stable
  // while typing.
  const entryValue = evalAmount(amount);
  const entryForConv = Number.isFinite(entryValue) && entryValue > 0 ? entryValue : 0;
  const hasFromField = showFromConv && !!fromAccountCcy;
  const hasToField = showToConv && !!toAccountCcy;
  const autoFromStr = hasFromField ? convert(entryForConv, effectiveEntryCurrency, fromAccountCcy!).toFixed(2) : null;
  const autoToStr = hasToField ? convert(entryForConv, effectiveEntryCurrency, toAccountCcy!).toFixed(2) : null;
  // Income has one account side (the To account) but reuses the
  // From-side override state for the legacy submit math.
  const toOverride = mode === 'transfer' ? accountAmountOverrideTo : accountAmountOverride;
  const setToOverride = mode === 'transfer' ? setAccountAmountOverrideTo : setAccountAmountOverride;
  const focusedString =
    focus === 'entry' ? amount
      : focus === 'from' ? (accountAmountOverride ?? autoFromStr ?? '0')
        : (toOverride ?? autoToStr ?? '0');
  // Fall back to the entry field when the focused converted field
  // disappears (mode / account / currency change).
  useEffect(() => {
    if ((focus === 'from' && !hasFromField) || (focus === 'to' && !hasToField)) {
      setFocus('entry');
      freshRef.current = false;
    }
  }, [focus, hasFromField, hasToField]);
  const setFocusedAmount = (next: string | ((prev: string) => string)) => {
    const updater = typeof next === 'function' ? next : () => next;
    if (focus === 'entry') {
      setAmount(updater);
      return;
    }
    const setter = focus === 'from' ? setAccountAmountOverride : setToOverride;
    const fresh = freshRef.current;
    freshRef.current = false;
    setter((prev) => updater(fresh || prev == null ? '0' : prev));
  };
  const clearFocusedOverride = () => {
    (focus === 'from' ? setAccountAmountOverride : setToOverride)(null);
    freshRef.current = true;
  };

  // Phase 10z: calc mode appends operators to the amount string. The
  // amount field doubles as an expression display.
  // Phase 10ae: the operators column is always visible, % is now a
  // numpad key (applied immediately, doesn't enter evaluate mode), and
  // the primary action key flips between ✓ (submit) and = (evaluate)
  // based on whether an unevaluated op is in the buffer.
  const onKey = (k: string) => {
    // Converted fields: C always returns to the auto rate; del on a
    // freshly-focused field does the same (nothing typed yet to erase).
    if (focus !== 'entry' && (k === 'C' || (k === 'del' && freshRef.current))) {
      clearFocusedOverride();
      return;
    }
    if (k === 'C') return setFocusedAmount('0');
    if (k === 'del') return setFocusedAmount((a) => (a.length <= 1 ? '0' : a.slice(0, -1)));
    if (k === '.') {
      // Don't allow a second dot in the same numeric segment.
      return setFocusedAmount((a) => {
        const lastOp = Math.max(a.lastIndexOf('+'), a.lastIndexOf('-'), a.lastIndexOf('*'), a.lastIndexOf('/'));
        const tail = a.slice(lastOp + 1);
        return tail.includes('.') ? a : a + '.';
      });
    }
    if (k === '%') {
      // iOS-calculator percent. Resolves the active op against the
      // preceding operand and collapses the expression to the result.
      //   500 × 60%  → 300   (60% of 500)
      //   500 + 30%  → 650   (500 + 30% of 500)
      //   500 − 20%  → 400   (500 − 20% of 500)
      //   500 ÷ 50%  → 1000  (500 ÷ 0.5)
      //   200%       → 2     (no op queued — plain divide by 100)
      // Always commits a numeric result, never leaves an expression
      // in the buffer, so the primary key returns to ✓.
      return setFocusedAmount((a) => {
        if (/[+\-*/]$/.test(a)) return a; // ignore right after an op

        // Find the last binary op (skip a leading sign at index 0).
        let lastOp = -1;
        for (let i = a.length - 1; i > 0; i--) {
          const c = a[i];
          if (c === '+' || c === '-' || c === '*' || c === '/') {
            lastOp = i;
            break;
          }
        }

        const fmt = (n: number) => {
          if (!Number.isFinite(n)) return a;
          // Trim FP noise + trailing zeros: 0.30000001 → 0.3, 5 → "5".
          const r = Math.round(n * 1e9) / 1e9;
          return Number.isInteger(r) ? String(r) : String(r);
        };

        if (lastOp === -1) {
          const n = parseFloat(a);
          return fmt(n / 100);
        }

        const head = a.slice(0, lastOp);
        const op = a[lastOp];
        const tailN = parseFloat(a.slice(lastOp + 1));
        const headV = evalAmount(head);
        if (!Number.isFinite(headV) || !Number.isFinite(tailN)) return a;

        if (op === '+') return fmt(headV + headV * (tailN / 100));
        if (op === '-') return fmt(headV - headV * (tailN / 100));
        if (op === '*') return fmt(headV * (tailN / 100));
        return fmt(headV / (tailN / 100)); // '/'
      });
    }
    setFocusedAmount((a) => (a === '0' ? k : a + k));
  };
  const onCalcOp = (op: '+' | '-' | '*' | '/') => {
    setFocusedAmount((a) => {
      // Replace a trailing operator instead of stacking — same UX as
      // every calculator app.
      if (/[+\-*/]$/.test(a)) return a.slice(0, -1) + op;
      return a + op;
    });
  };

  const doSubmit = (opts: { skipCashCheck?: boolean } = {}) => {
    submitInner(opts);
  };

  // Guard against the user mashing ✓ — without this, a fast double-tap
  // could insert the same transaction twice (the modal stays mounted
  // long enough for the second tap to land before router.dismiss runs).
  const submittingRef = React.useRef(false);
  const submit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setTimeout(() => { submittingRef.current = false; }, 1000);
    doSubmit();
  };

  const submitInner = (opts: { skipCashCheck?: boolean }) => {
    // Amount may be a tiny expression like "100+50*2" when calc mode
    // was used. evalAmount() returns the resolved number or NaN.
    const v = evalAmount(amount);
    if (!Number.isFinite(v) || v <= 0) {
      // Don't fail silently — buzz and show a hint under the amount.
      haptics.error();
      flashAmountError();
      return;
    }

    // For mixed-currency entries: amount the user typed is in
    // entryCurrency; we persist `amount` in account currency. If the
    // user manually overrode the converted line (e.g. bank used a
    // non-mid-market rate), honor that instead of the FX convert().
    const overrideNum = accountAmountOverride
      ? evalAmount(accountAmountOverride.replace(',', '.'))
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
          t('add.cashNegative.title'),
          t('add.cashNegative.body', { projected: e.details.projected.toFixed(2) }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('add.cashNegative.continue'), onPress: () => submitInner({ skipCashCheck: true }) },
          ],
        );
        return true;
      }
      throw e;
    };
    if (mode === 'transfer') {
      if (fromAcct === toAcct) return;
      // Cross-currency: the From-side debit is `accountAmount` (in
      // fromAccountCcy, computed above). The To-side credit is the
      // entry amount converted into toAccountCcy. Same currency on
      // both sides → toAmount stays null (legacy single-amount path).
      const toCcy = toAccountCcy ?? currency;
      // Honor a manual correction on the To line (the bank credited a
      // different amount than our cached rate predicts), same as the
      // From side above. Fall back to the live conversion otherwise.
      const overrideToNum = accountAmountOverrideTo
        ? evalAmount(accountAmountOverrideTo.replace(',', '.'))
        : NaN;
      const toAmount =
        fromAccountCcy && toCcy && fromAccountCcy !== toCcy
          ? Number.isFinite(overrideToNum) && overrideToNum > 0
            ? overrideToNum
            : convert(v, effectiveEntryCurrency, toCcy)
          : null;
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
          toAmount,
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
            toAmount,
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
            // When the user came in via a recurring row's checkmark
            // the prefill carries recurringId — persist it on the
            // transaction so downstream analytics (avg-daily-variable,
            // subscription audit, edit-flow detection) can identify
            // the row as fixed-cost rather than discretionary.
            recurringId: prefill?.recurringId ?? null,
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
    // the row to "paid" by inserting the paid_items link. The Plan
    // tab stamps the month the user tapped from in `markMonth`, so a
    // future-dated transaction still ticks the originating month
    // rather than the future month. Fallback to txDate's month when
    // markMonth is missing (e.g. older callers).
    if (createdTxId && prefill?.recurringId) {
      const markDate = prefill.markMonth
        ? new Date(`${prefill.markMonth}-01T00:00:00`)
        : txDate;
      linkRecurringPaid(prefill.recurringId, createdTxId, markDate);
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
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
        <View style={styles.modeRow}>
          {(['expense', 'income', 'transfer'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => {
                if (m !== mode) resetFxOverrides();
                setMode(m);
              }}
              style={[styles.modeTab, mode === m && styles.modeActive]}
            >
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]} maxFontSizeMultiplier={1.3}>{t(`add.${m}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={submit} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('add.a11y.submit')}>
          <MaterialCommunityIcons name="check" size={24} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {(() => {
          const dual = hasFromField || hasToField;
          const acctName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';
          const entryLabel =
            mode === 'expense' ? t('add.field.paid')
              : mode === 'income' ? t('add.field.received')
                : t('add.field.send');
          return (
            <View style={styles.amountStack}>
              {/* Entry amount. Single-currency: the familiar big number.
                  Cross-currency: becomes the first of 2–3 stacked
                  fields (Wise pattern) — tap any field and the numpad
                  edits it; the others follow at the market rate until
                  the user types their own bank amount. */}
              <Pressable
                onPress={() => focusField('entry')}
                disabled={!dual}
                style={[
                  dual && styles.amountFieldCard,
                  dual && focus === 'entry' && styles.amountFieldFocused,
                ]}
                accessibilityRole={dual ? 'button' : undefined}
                accessibilityState={dual ? { selected: focus === 'entry' } : undefined}
              >
                {dual && <Text style={styles.fieldLabel}>{entryLabel}</Text>}
                <View style={styles.amountRow}>
                  <Text
                    style={[styles.amount, dual && styles.amountDual]}
                    accessibilityLabel={`${entryLabel} ${currencyPrefix(effectiveEntryCurrency)}${formatSmartAddAmount(amount)}`}
                    accessibilityLiveRegion="polite"
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {currencyPrefix(effectiveEntryCurrency)}
                    {formatSmartAddAmount(amount)}
                  </Text>
                  <Pressable
                    onPress={() => setCurrencyPickerOpen(true)}
                    style={styles.currencyChip}
                    accessibilityRole="button"
                    accessibilityLabel={t('add.a11y.currency', { ccy: effectiveEntryCurrency })}
                  >
                    <Text style={styles.currencyChipText}>{effectiveEntryCurrency}</Text>
                    <MaterialCommunityIcons name="chevron-down" size={14} color={theme.text2} />
                  </Pressable>
                </View>
              </Pressable>
              {hasFromField && (
                <ConvertedAmountField
                  label={
                    mode === 'transfer'
                      ? t('add.field.debited', { account: acctName(fromAcct) })
                      : t('add.field.charged', { account: acctName(effectiveAcct) })
                  }
                  currency={fromAccountCcy!}
                  srcCurrency={effectiveEntryCurrency}
                  entryValue={entryForConv}
                  override={accountAmountOverride}
                  auto={autoFromStr ?? '0.00'}
                  focused={focus === 'from'}
                  onFocus={() => focusField('from')}
                  onReset={() => setAccountAmountOverride(null)}
                />
              )}
              {hasToField && (
                <ConvertedAmountField
                  label={
                    mode === 'transfer'
                      ? t('add.field.receives', { account: acctName(toAcct) })
                      : t('add.field.credited', { account: acctName(effectiveAcct) })
                  }
                  currency={toAccountCcy!}
                  srcCurrency={effectiveEntryCurrency}
                  entryValue={entryForConv}
                  override={toOverride}
                  auto={autoToStr ?? '0.00'}
                  focused={focus === 'to'}
                  onFocus={() => focusField('to')}
                  onReset={() => setToOverride(null)}
                />
              )}
              <View style={styles.errorSlot}>
                {amountError && (
                  <Text style={styles.amountError} accessibilityLiveRegion="assertive">
                    {t('add.amountRequired')}
                  </Text>
                )}
              </View>
            </View>
          );
        })()}
        {/* Date — small grey text directly under the amount. Always
            visible; tap (or the 📅 key in the numpad's right column)
            to open the picker. Day matters for analytics, budgets,
            and the day-grouped Activity list. */}
        {(() => {
          const diff = daysDiff(Date.now(), txDate);
          // Tone: future = amber (scheduled, draws attention); past
          // = accent (intentional backdate is fine); today = neutral.
          const tone =
            diff > 0 ? '#F59E0B' : diff < 0 ? theme.accent : theme.text3;
          return (
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Date ${txDate.toDateString()}, tap to change`}
              hitSlop={8}
            >
              <Text style={[styles.dateInlineText, { color: tone }]}>
                {relativeDayLabel(txDate, locale)}
              </Text>
            </Pressable>
          );
        })()}
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
              // Honour the in-app language setting — without this the
              // Android dialog falls back to the OS locale and reads
              // English even when the app is Russian.
              locale={locale}
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
          onPick={(c) => {
            if (c !== effectiveEntryCurrency) resetFxOverrides();
            setEntryCurrency(c);
          }}
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
          {/* Voice dictation deferred to v1.1+. Component file kept
              in /components for the relaunch — re-add the import +
              render here once the speech plugin is back in app.config. */}
          <ReceiptScanButton
            onScanned={({ amount: a, note: n, receiptUri }) => {
              if (a !== null) setAmount(String(a));
              if (n) setNote(n);
              setDraft((d) => ({ ...d, receiptImagePath: receiptUri }));
            }}
          />
        </View>

        {/* Frequent-merchant chip strip — opts in via Settings. Each
            chip prefills amount/note/account/category. A "More…" chip
            at the end opens the full category grid for fresh entries
            without prior exact matches. */}
        {mode === 'expense' && kv.getBool('smartSuggestions', false) && (
          <SmartSuggestionRow
            currency={currency}
            amount={amount}
            onMore={() => setGridOpen(true)}
            onPickExact={(tx) => {
              setAmount(String(tx.amount));
              setNote(tx.note ?? '');
              if (tx.category) setCatOverride(tx.category);
              if (tx.accountId !== effectiveAcct) resetFxOverrides();
              setAccountOverride(tx.accountId);
            }}
            onPickFuzzy={(m) => {
              setNote(m.note);
              setCatOverride(m.category);
              if (m.accountId !== effectiveAcct) resetFxOverrides();
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
        {mode === 'transfer' ? (() => {
          // Both pickers see the same set: active accounts plus any
          // archived account that's currently selected on either side
          // (so the user can swap to it when editing a transfer whose
          // wallet was retired). Same-account collisions are resolved
          // via swap on the onPick side, not by hiding.
          const archivedHere = (sideValue: string) => {
            const arc = allAccounts.find((a) => a.id === sideValue && a.archived === 1);
            return arc ? [arc] : [];
          };
          const pickerList = [
            ...accounts,
            ...archivedHere(fromAcct),
            ...archivedHere(toAcct).filter((a) => a.id !== fromAcct),
          ];
          return (
            <View style={styles.transferRow}>
              <TransferAcctRow
                label={t('add.transfer.from')}
                accounts={pickerList}
                value={fromAcct}
                onPick={(id) => {
                  // Picking the account that's already on To swaps the
                  // two sides instead of nudging To to the next active
                  // account — natural "I'm reversing this transfer" UX.
                  if (id !== fromAcct) resetFxOverrides();
                  if (id === toAcct) setToAcct(fromAcct);
                  setFromAcct(id);
                }}
              />
              <MaterialCommunityIcons name="arrow-right" size={20} color={theme.text3} />
              <TransferAcctRow
                label={t('add.transfer.to')}
                accounts={pickerList}
                value={toAcct}
                onPick={(id) => {
                  if (id !== toAcct) resetFxOverrides();
                  if (id === fromAcct) setFromAcct(toAcct);
                  setToAcct(id);
                }}
              />
            </View>
          );
        })() : (
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
                      onPick={(id) => {
                        if (id !== effectiveAcct) resetFxOverrides();
                        setAccountOverride(id);
                      }}
                      auto={acctAuto}
                      autoLabel={badge}
                      debit={{
                        amount: parseFloat(amount) || 0,
                        currency: effectiveEntryCurrency,
                      }}
                    />
                    <MaterialCommunityIcons name="arrow-right" size={20} color={theme.text3} />
                    <CategoryPickerRow
                      label={t('add.toCategory')}
                      cats={cats}
                      value={effectiveCat}
                      onPick={setCatOverride}
                      auto={catAuto}
                      autoLabel={badge}
                      transactionType="expense"
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
                      transactionType="income"
                    />
                    <MaterialCommunityIcons name="arrow-right" size={20} color={theme.text3} />
                    <TransferAcctRow
                      label={t('add.transfer.to')}
                      accounts={accounts}
                      value={effectiveAcct}
                      onPick={(id) => {
                        if (id !== effectiveAcct) resetFxOverrides();
                        setAccountOverride(id);
                      }}
                      auto={acctAuto}
                      autoLabel={badge}
                    />
                  </>
                )}
              </View>
            );
          })()
        )}

        {/* Phase 10z: budget context line sits directly below From/To.
            Three states:
              1. Category has a budget → live progress bar with
                 "spent / cap CCY this month" header. Bar projects
                 the typed amount in real time.
              2. Category has no budget → grey one-liner with current
                 spend ("Coffee: 45 USD this month").
              3. First transaction this month → "Coffee: 0 USD —
                 your first this month".
            Hidden for income, transfers, and the Adjustment system
            category (irrelevant context). */}
        {mode === 'expense' && effectiveCat && effectiveCat !== 'adjustment' && (() => {
          const cat = categories.find((c) => c.id === effectiveCat);
          if (!cat) return null;
          const ccy = (cat.budgetCurrency as CurrencyCode | null) ?? currency;
          const spentRaw = monthTotals.find((m) => m.category === effectiveCat)?.total ?? 0;
          const spentInCcy = ccy === currency ? spentRaw : convert(spentRaw, currency, ccy);
          const entered = parseFloat(amount) || 0;
          const enteredInCcy =
            entered > 0
              ? ccy === effectiveEntryCurrency
                ? entered
                : convert(entered, effectiveEntryCurrency, ccy)
              : 0;
          const projected = spentInCcy + enteredInCcy;

          if (cat.monthlyBudget != null && cat.monthlyBudget > 0) {
            const pct = Math.min(projected / cat.monthlyBudget, 1);
            const over = projected > cat.monthlyBudget;
            const warn = !over && projected / cat.monthlyBudget >= 0.8;
            const barColor = over ? theme.expense : warn ? '#F97316' : '#10B981';
            return (
              <View style={styles.budgetBarWrap}>
                <Text style={styles.budgetBarLabel}>
                  {cat.name}:{' '}
                  {enteredInCcy > 0
                    ? `${formatMoney(spentInCcy, ccy)} → ${formatMoney(projected, ccy)}`
                    : formatMoney(spentInCcy, ccy)}
                  {' '}/ {formatMoney(cat.monthlyBudget, ccy)} {t('budget.thisMonth')}
                </Text>
                <View style={styles.budgetBarBg}>
                  <View style={[styles.budgetBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
                </View>
                {over && enteredInCcy > 0 && (
                  <Text style={styles.budgetWarn}>
                    {t('budget.over', {
                      over: formatMoney(projected - cat.monthlyBudget, ccy),
                      name: cat.name,
                    })}
                  </Text>
                )}
              </View>
            );
          }

          // No budget — grey one-liner. First-of-month gets a friendly tail.
          if (spentInCcy === 0 && enteredInCcy === 0) {
            return (
              <Text style={styles.budgetNeutralLine}>
                {t('budget.firstThisMonth', {
                  name: cat.name,
                  zero: formatMoney(0, ccy),
                })}
              </Text>
            );
          }
          return (
            <Text style={styles.budgetNeutralLine}>
              {cat.name}:{' '}
              {enteredInCcy > 0
                ? `${formatMoney(spentInCcy, ccy)} → ${formatMoney(projected, ccy)}`
                : formatMoney(spentInCcy, ccy)}
              {' '}{t('budget.thisMonth')}
            </Text>
          );
        })()}

        {/* Islamic AddTxExtras — halal selector + asnaf for giving categories.
            Generic: nothing renders. We pass `category: effectiveCat` so the
            asnaf picker can gate itself to zakat/sadaqa/qurban. */}
        <FeatureSlots.AddTxExtras
          txDraft={{ ...draft, category: effectiveCat }}
          onChange={(p) => setDraft({ ...draft, ...p })}
        />

        {/* Numpad's right column owns ⌫, 📅, and a tall ✓/= key. The
            standalone Add-expense / Save CTA below the keypad is gone
            — ✓ is the only submit. When the amount expression contains
            an unevaluated op the ✓ flips to = and resolves the
            expression in-place; the next render restores ✓. */}
        <Numpad
          onPress={onKey}
          onDate={() => setDatePickerOpen(true)}
          onSubmit={submit}
          onEvaluate={() => {
            const v = evalAmount(focusedString);
            if (Number.isFinite(v)) {
              // Trim a trailing zero on integers so the buffer reads
              // "150" not "150.0" after an evaluation.
              const s = Number.isInteger(v) ? String(v) : String(v);
              setFocusedAmount(s);
            }
          }}
          onCalcOp={onCalcOp}
          awaitingEval={/[+\-*/]/.test(focusedString)}
          submitLabel={isEditing ? t('common.save') : t(`add.cta.${mode}`)}
        />

        {isEditing && prefill?.editId && (
          <Pressable
            onPress={() => {
              Alert.alert(
                t('tx.deleteConfirm.title'),
                t('tx.deleteConfirm.body', { undone: t('common.cannotBeUndone') }),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                      deleteTransaction(prefill.editId!);
                      router.back();
                    },
                  },
                ],
              );
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
        headerText={t('picker.pickCategory')}
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
/** One converted-amount field in the Wise-style stack: label, big
 *  amount in the account's currency, and the rate it implies. Tapping
 *  focuses it so the numpad edits this amount; the tag flips from
 *  "market rate" to "your rate" once the user types, and the refresh
 *  icon returns to the market conversion. */
function ConvertedAmountField({
  label,
  currency,
  srcCurrency,
  entryValue,
  override,
  auto,
  focused,
  onFocus,
  onReset,
}: {
  label: string;
  currency: CurrencyCode;
  srcCurrency: CurrencyCode;
  entryValue: number;
  override: string | null;
  auto: string;
  focused: boolean;
  onFocus: () => void;
  onReset: () => void;
}) {
  const manual = override != null;
  const value = override ?? auto;
  const valueNum = parseFloat(value.replace(',', '.'));
  // Implied rate: the user's own when manual, otherwise the cached
  // market cross-rate. Precision steps down as the rate grows so
  // "1 USD = 512.40 KZT" and "1 KZT = 0.0020 USD" both read well.
  const rate =
    manual && entryValue > 0 && Number.isFinite(valueNum)
      ? valueNum / entryValue
      : convert(1, srcCurrency, currency);
  const rateText = `1 ${srcCurrency} = ${rate >= 10 ? rate.toFixed(2) : rate >= 1 ? rate.toFixed(3) : rate.toFixed(4)} ${currency}`;
  const tag = manual ? i18nT('add.rate.bank') : i18nT('add.rate.market');
  return (
    <Pressable
      onPress={onFocus}
      style={[styles.amountFieldCard, focused && styles.amountFieldFocused]}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={i18nT('add.field.a11y', { label, amount: `${formatSmartAddAmount(value)} ${currency}` })}
    >
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel} numberOfLines={1}>{label}</Text>
        <Text style={[styles.fxSourceTag, manual && styles.fxSourceTagManual]}>{tag}</Text>
        {manual && (
          <Pressable onPress={onReset} hitSlop={10} accessibilityLabel={i18nT('add.a11y.resetRate')}>
            <MaterialCommunityIcons name="refresh" size={14} color={theme.text3} />
          </Pressable>
        )}
      </View>
      <View style={styles.amountRow}>
        <Text
          style={[styles.amount, styles.amountSecondary, focused && styles.amountSecondaryFocused]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {currencyPrefix(currency)}
          {formatSmartAddAmount(value)}
        </Text>
      </View>
      <Text style={styles.rateText}>{rateText}</Text>
    </Pressable>
  );
}

function TransferAcctRow({
  label,
  accounts,
  value,
  onPick,
  auto = false,
  autoLabel,
  debit,
}: {
  label: string;
  accounts: Account[];
  value: string;
  onPick: (id: string) => void;
  /** Auto-filled visual state (dashed border). */
  auto?: boolean;
  autoLabel?: string;
  /** Pre-flight: amount + currency, so the picker can tag accounts
   *  that would go negative if this debit landed on them. */
  debit?: { amount: number; currency: CurrencyCode };
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const acct = accounts.find((a) => a.id === value);
  void autoLabel;
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
        accessibilityLabel={`${label}: ${acct?.name ?? t('picker.pickAccount')}${auto ? ', auto-filled' : ''}`}
      >
        <View style={[styles.transferDot, { backgroundColor: acct?.color ?? theme.text3 }]} />
        <Text style={styles.transferRowText}>{acct?.name ?? t('picker.pickAccount')}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={theme.text3} />
      </Pressable>
      <AccountPicker
        visible={open}
        accounts={accounts}
        value={value}
        debit={debit}
        headerText={t('picker.pickAccount')}
        onSelect={onPick}
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
  transactionType,
}: {
  label: string;
  cats: { id: string; name: string; color: string }[];
  value: string | null;
  onPick: (id: string) => void;
  auto?: boolean;
  autoLabel?: string;
  transactionType: 'expense' | 'income';
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const cat = value ? cats.find((c) => c.id === value) : undefined;
  void autoLabel;
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
        accessibilityLabel={`${label}: ${cat?.name ?? t('picker.pickCategory')}${auto ? ', auto-filled' : ''}`}
      >
        <View style={[styles.transferDot, { backgroundColor: cat?.color ?? theme.text3 }]} />
        <Text style={styles.transferRowText}>{cat?.name ?? t('picker.pickCategory')}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={theme.text3} />
      </Pressable>
      <CategoryPicker
        visible={open}
        mode="select"
        transactionType={transactionType}
        showBudgetProgress
        showAddNew
        headerText={label}
        onSelect={(id) => {
          onPick(id);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/** Symbol to render on the left of the amount in Smart Add's header.
 *  Was hard-coded to $/€/£ with a "CHF "-style fallback that read as a
 *  3-letter code rather than a glyph — now goes through the currency
 *  catalog so CHF → Fr., KZT → ₸, JPY → ¥, etc. Falls back to the
 *  code only when the catalog has no entry (truly unknown). The
 *  right-side picker chip keeps the ISO code so the user has both
 *  signals visible. */
function currencyPrefix(c: CurrencyCode): string {
  const sym = CURRENCIES[c]?.symbolNative;
  return sym ? `${sym} ` : `${c} `;
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
  amountError: {
    color: theme.expense,
    fontFamily: font.bodySemi,
    fontSize: sizes.sm,
    textAlign: 'center',
  },
  amountStack: {
    gap: spacing.sm,
  },
  amountDual: {
    fontSize: 40,
  },
  amountFieldCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radii.lg,
    backgroundColor: theme.bg1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  amountFieldFocused: {
    borderColor: theme.accent,
    backgroundColor: theme.accentDim,
  },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldLabel: {
    flex: 1,
    color: theme.text2,
    fontSize: sizes.xs,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  amountSecondary: {
    fontSize: 32,
    color: theme.text2,
  },
  amountSecondaryFocused: {
    color: theme.text1,
  },
  rateText: {
    color: theme.text3,
    fontSize: sizes.xs,
    textAlign: 'center',
  },
  errorSlot: {
    minHeight: 18,
    justifyContent: 'center',
  },
  fxSourceTagManual: {
    color: theme.accent,
  },
  fxSourceTag: {
    color: theme.text3,
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
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
  budgetBarWrap: { gap: 4 },
  budgetBarLabel: { color: theme.text2, fontSize: sizes.xs },
  budgetBarBg: { height: 5, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: 3 },
  budgetWarn: { color: theme.expense, fontSize: sizes.xs, fontFamily: font.bodySemi },
  budgetNeutralLine: { color: theme.text3, fontSize: sizes.xs },
});
