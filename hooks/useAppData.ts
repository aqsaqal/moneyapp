// useAppData — replaces v4's ~25 useState hooks with a Drizzle-backed store.
// Queries return live rows; mutations commit to SQLite and poke a version bump
// so consumers re-render. Avoids the "deserialize whole blob on every render"
// problem that a single JSON column would have.
//
// Usage:
//   const { transactions, addTransaction, deleteTransaction } = useAppData();

import { useCallback, useEffect, useMemo, useState } from 'react';
import { and, desc, eq, gt, gte, like, lt, lte, or, sql } from 'drizzle-orm';
import { getDB, getRawDB } from '@/utils/db/client';
import {
  accounts,
  budgets,
  customCategories,
  debts,
  goals,
  paidItems,
  recurring,
  transactions,
  type Account,
  type Budget,
  type CustomCategory,
  type Debt,
  type Goal,
  type NewBudget,
  type NewCustomCategory,
  type NewDebt,
  type NewGoal,
  type NewTransaction,
  type PaidItem,
  type Recurring,
  type Transaction,
} from '@/utils/db/schema';
import { monthKey } from '@/utils/format';
import { seedIfEmpty } from '@/utils/db/seed';
import { onProfileChange } from '@/utils/profiles';
import { snapshotTodayIfMissing } from '@/utils/netWorthSnapshot';
import { FX_TTL_MS, oldestFetchedAt, refreshRates } from '@/utils/fx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, localizedSeededName } from '@/constants/categories';
import { kv } from '@/utils/kv';
import { getLocale } from '@/utils/i18n';
import { LOCALES } from '@/constants/locales';

// Single process-wide version counter that all hooks watch. Bumped on every
// mutation so useEffect-driven re-queries fire.
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

// Profile switch invalidates everything: getDB() will reopen against the
// new profile's .db file, so we also need every subscribed query to re-run.
// One-time wiring at module load.
onProfileChange(() => {
  // Re-seed in case the new profile is empty.
  void seedIfEmpty();
  // Capture today's snapshot for the freshly-active profile.
  try { snapshotTodayIfMissing(); } catch { /* swallow */ }
  bump();
});
function useVersion(): number {
  const [, setV] = useState(0);
  useEffect(() => {
    const l = () => setV((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return version;
}

// ---- Boot ----

let booted = false;
let bootPromise: Promise<void> | null = null;

export function bootAppData(): Promise<void> {
  if (booted) return Promise.resolve();
  if (!bootPromise) {
    bootPromise = (async () => {
      getDB(); // opens + creates tables
      await seedIfEmpty();
      // Phase 10w: one-time migration — copy any pre-existing standalone
      // `budgets` rows onto the matching custom_categories row so the
      // category becomes the single source of truth.
      try { migrateBudgetsToCategories(); } catch { /* idempotent; safe to ignore */ }
      // Phase 10z: settle any scheduled transactions whose date has
      // passed since the last launch. Idempotent, fast (single SELECT
      // + per-row UPDATE inside a transaction).
      try { applyDueTransactions(); } catch { /* never block boot */ }
      // Phase 10p: capture today's net-worth snapshot once per app launch.
      // No-op when today's row already exists.
      try { snapshotTodayIfMissing(); } catch { /* never block boot on this */ }
      // Always-on FX refresh whenever the cache is stale or empty. Multi-
      // source fallback (open.er-api → fxratesapi → frankfurter), so a
      // single provider outage doesn't strand the user. Non-blocking;
      // failures are silent because identity-fallback is acceptable for a
      // user with no multi-currency accounts.
      try {
        const lastFetched = oldestFetchedAt();
        const stale = lastFetched === 0 || Date.now() - lastFetched > FX_TTL_MS;
        if (stale) {
          void refreshRates().catch(() => { /* offline / all sources down */ });
        }
      } catch { /* never block boot */ }
      // Phase 10q.2: islamic-only metals refresh when the toggle is on
      // and the cache is stale. Fire-and-forget, non-blocking.
      if (process.env.APP_FLAVOR === 'islamic') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { isStale, refreshMetals } = require('@/features/islamic/zakat/metalsRefresh');
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { kv: kvMod } = require('@/utils/kv');
          if (kvMod.getBool('islamic.nisabAutoRefresh', false) && isStale()) {
            void refreshMetals().catch(() => {/* offline / quota — keep fallback */});
          }
        } catch { /* never block boot */ }
      }
      booted = true;
    })();
  }
  return bootPromise;
}

export function useAppDataReady(): boolean {
  const [ready, setReady] = useState(booted);
  useEffect(() => {
    if (!booted) bootAppData().then(() => setReady(true));
  }, []);
  return ready;
}

// ---- Queries ----

export interface UseTransactionsOpts {
  monthKey?: string;        // 'YYYY-MM'
  category?: string | null;
  accountId?: string | null;
  type?: 'expense' | 'income' | 'transfer' | null;
  search?: string;
  halalStatus?: string | null;
  /** Hard cap on rows returned. Default: see DEFAULT_TX_LIMIT below. */
  limit?: number;
  /** Inclusive upper bound on date (epoch ms). Used to exclude future-
   *  dated transactions from "what's already happened" rollups —
   *  Disposable, budgets, insights — so a scheduled future expense
   *  doesn't shrink today's headline numbers. */
  dateLte?: number;
  /** Exclusive lower bound on date (epoch ms). For the Upcoming
   *  section on Activity: only rows with date > end-of-today. */
  dateGt?: number;
}

/** Default page size for transaction queries when no limit is passed.
 *  Activity tab can still page beyond this via the "Load more" affordance.
 *  Without a default, a heavy user (10k+ tx) pulls everything into JS each
 *  re-render, OOMs older devices. */
export const DEFAULT_TX_LIMIT = 200;

function monthRange(key: string): [number, number] {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  return [start, end];
}

export function useTransactions(opts: UseTransactionsOpts = {}): Transaction[] {
  useVersion();
  const db = getDB();
  return useMemo(() => {
    const clauses = [];
    if (opts.monthKey) {
      const [s, e] = monthRange(opts.monthKey);
      clauses.push(and(gte(transactions.date, s), lt(transactions.date, e)));
    }
    if (opts.category) clauses.push(eq(transactions.category, opts.category));
    if (opts.accountId) clauses.push(eq(transactions.accountId, opts.accountId));
    if (opts.type) clauses.push(eq(transactions.type, opts.type));
    if (opts.halalStatus) clauses.push(eq(transactions.halalStatus, opts.halalStatus));
    if (opts.search) {
      const s = `%${opts.search}%`;
      clauses.push(or(like(transactions.note, s), like(transactions.category, s))!);
    }
    if (typeof opts.dateLte === 'number') clauses.push(lte(transactions.date, opts.dateLte));
    if (typeof opts.dateGt === 'number') clauses.push(gt(transactions.date, opts.dateGt));
    const where = clauses.length ? and(...clauses) : undefined;
    let q = db.select().from(transactions).where(where).orderBy(desc(transactions.date));
    // Always cap. The caller can override with an explicit limit; otherwise
    // we apply the safety default to keep memory bounded.
    const cap = opts.limit ?? DEFAULT_TX_LIMIT;
    q = q.limit(cap) as typeof q;
    return q.all();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, opts.monthKey, opts.category, opts.accountId, opts.type, opts.search, opts.halalStatus, opts.limit]);
}

export interface UseAccountsOpts {
  /** Default false — archived accounts are hidden so pickers don't let
   *  users select retired wallets / credit cards. The Accounts tab opts
   *  in via { includeArchived: true } and renders them dimmed. */
  includeArchived?: boolean;
}

export function useAccounts(opts: UseAccountsOpts = {}): Account[] {
  useVersion();
  const db = getDB();
  const includeArchived = opts.includeArchived ?? false;
  return useMemo(() => {
    const all = db.select().from(accounts).orderBy(accounts.sortOrder).all();
    return includeArchived ? all : all.filter((a) => a.archived !== 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, includeArchived]);
}

/** Phase 10w: budgets are now stored on custom_categories.monthly_budget.
 *  Legacy callers still get { id, category, limit } via this synth view. */
export function useBudgets(): Budget[] {
  useVersion();
  const raw = getRawDB();
  return useMemo(() => {
    try {
      const rows = raw.getAllSync(
        `SELECT id, monthly_budget AS lim FROM custom_categories
          WHERE monthly_budget IS NOT NULL
            AND (archived IS NULL OR archived != 1)`,
      ) as Array<{ id: string; lim: number }>;
      return rows.map((r) => ({ id: r.id, category: r.id, limit: r.lim }));
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

/** Read all categories (seeded + customs) with their monthly_budget /
 *  budget_currency / pinned / archived metadata. Surfaced here so the
 *  Settings → Categories management surface and Plan → Budgets
 *  dashboard share the same source of truth. */
export interface CategoryWithMeta {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'both';
  isSystem: boolean;
  isPinned: boolean;
  archived: boolean;
  monthlyBudget: number | null;
  budgetCurrency: string | null;
  rolloverEnabled: boolean;
  sortOrder: number;
  budgetAlertsSent: string | null;
}

export function useCategoriesWithMeta(): CategoryWithMeta[] {
  useVersion();
  const raw = getRawDB();
  return useMemo(() => {
    // Start with seeded categories so even uncustomized ones show up in
    // Settings; merge custom_categories rows on top (shadow by id).
    const out = new Map<string, CategoryWithMeta>();
    for (const c of EXPENSE_CATEGORIES) {
      out.set(c.id, {
        id: c.id, name: localizedSeededName(c.id, c.name), icon: c.icon, color: c.color, type: 'expense',
        isSystem: c.id === 'other' || c.id === 'adjustment',
        isPinned: false, archived: false,
        monthlyBudget: null, budgetCurrency: null, rolloverEnabled: false,
        sortOrder: 0, budgetAlertsSent: null,
      });
    }
    for (const c of INCOME_CATEGORIES) {
      const existing = out.get(c.id);
      if (existing) {
        existing.type = 'both';
      } else {
        out.set(c.id, {
          id: c.id, name: localizedSeededName(c.id, c.name), icon: c.icon, color: c.color, type: 'income',
          isSystem: c.id === 'other_in' || c.id === 'adjustment',
          isPinned: false, archived: false,
          monthlyBudget: null, budgetCurrency: null, rolloverEnabled: false,
          sortOrder: 0, budgetAlertsSent: null,
        });
      }
    }
    try {
      const rows = raw.getAllSync(
        `SELECT id, name, icon, color, type, is_system, is_pinned, sort_order,
                archived, monthly_budget, budget_currency, rollover_enabled,
                budget_alerts_sent, name_translations
           FROM custom_categories`,
      ) as Array<{
        id: string; name: string; icon: string; color: string; type: string;
        is_system: number | null; is_pinned: number | null;
        sort_order: number | null; archived: number | null;
        monthly_budget: number | null; budget_currency: string | null;
        rollover_enabled: number | null; budget_alerts_sent: string | null;
        name_translations: string | null;
      }>;
      const activeLocale = getLocale();
      for (const r of rows) {
        // Resolve display name: active locale override → `name` field.
        let displayName = r.name;
        if (r.name_translations) {
          try {
            const map = JSON.parse(r.name_translations) as Record<string, string>;
            if (typeof map[activeLocale] === 'string') displayName = map[activeLocale];
          } catch {
            /* malformed JSON — fall back to `name` */
          }
        }
        out.set(r.id, {
          id: r.id, name: displayName, icon: r.icon, color: r.color,
          type: (r.type as 'expense' | 'income' | 'both'),
          isSystem: r.is_system === 1,
          isPinned: r.is_pinned === 1,
          archived: r.archived === 1,
          monthlyBudget: r.monthly_budget,
          budgetCurrency: r.budget_currency,
          rolloverEnabled: r.rollover_enabled === 1,
          sortOrder: r.sort_order ?? 0,
          budgetAlertsSent: r.budget_alerts_sent,
        });
      }
    } catch {
      /* swallow */
    }
    return Array.from(out.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

/** Persist budget + flags onto a category. Inserts an override row when
 *  the category is seeded-only and has no existing custom_categories row. */
export function setCategoryMeta(
  id: string,
  patch: Partial<{
    isPinned: boolean;
    archived: boolean;
    monthlyBudget: number | null;
    budgetCurrency: string | null;
    rolloverEnabled: boolean;
    sortOrder: number;
    name: string;
    icon: string;
    color: string;
    type: 'expense' | 'income' | 'both';
  }>,
): void {
  const raw = getRawDB();
  // Look up the seeded defaults so a fresh insert has icon/color/etc.
  const seededExpense = EXPENSE_CATEGORIES.find((c) => c.id === id);
  const seededIncome = INCOME_CATEGORIES.find((c) => c.id === id);
  const seeded = seededExpense ?? seededIncome;
  const existing = raw.getFirstSync(
    `SELECT id FROM custom_categories WHERE id = ?`,
    [id],
  ) as { id: string } | undefined;
  if (!existing) {
    // Create: flood-fill the user's typed name across all 50 locales so
    // it shows up uniformly until they re-edit in a specific language.
    const initialName = patch.name ?? seeded?.name ?? id;
    const floodFilled: Record<string, string> = {};
    for (const l of LOCALES) floodFilled[l.code] = initialName;
    raw.runSync(
      `INSERT INTO custom_categories
         (id, name, icon, color, type, created_at, is_pinned, archived,
          monthly_budget, budget_currency, rollover_enabled, sort_order,
          name_translations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        initialName,
        patch.icon ?? seeded?.icon ?? 'MoreHorizontal',
        patch.color ?? seeded?.color ?? '#8888AA',
        patch.type ?? (seededIncome && !seededExpense ? 'income' : 'expense'),
        Date.now(),
        patch.isPinned ? 1 : 0,
        patch.archived ? 1 : 0,
        patch.monthlyBudget ?? null,
        patch.budgetCurrency ?? null,
        patch.rolloverEnabled ? 1 : 0,
        patch.sortOrder ?? 0,
        JSON.stringify(floodFilled),
      ],
    );
  } else {
    const sets: string[] = [];
    const args: Array<string | number | null> = [];
    const push = (col: string, val: string | number | null) => {
      sets.push(`${col} = ?`);
      args.push(val);
    };
    if (patch.name != null) {
      // Edit-of-name: update ONLY the active locale's entry in the
      // translations map; leave other locales' values alone. Also keep
      // the `name` column in sync with the active-locale string so
      // legacy code paths don't regress.
      push('name', patch.name);
      const existingRow = raw.getFirstSync(
        `SELECT name_translations FROM custom_categories WHERE id = ?`,
        [id],
      ) as { name_translations: string | null } | undefined;
      let map: Record<string, string> = {};
      if (existingRow?.name_translations) {
        try { map = JSON.parse(existingRow.name_translations); } catch { map = {}; }
      }
      // Ensure every locale has *some* value, defaulting to the new name
      // for any locale we haven't yet recorded — keeps the picker readable
      // in unfamiliar languages until the user explicitly edits there.
      for (const l of LOCALES) {
        if (typeof map[l.code] !== 'string') map[l.code] = patch.name;
      }
      map[getLocale()] = patch.name;
      push('name_translations', JSON.stringify(map));
    }
    if (patch.icon != null) push('icon', patch.icon);
    if (patch.color != null) push('color', patch.color);
    if (patch.type != null) push('type', patch.type);
    if (patch.isPinned != null) push('is_pinned', patch.isPinned ? 1 : 0);
    if (patch.archived != null) push('archived', patch.archived ? 1 : 0);
    if ('monthlyBudget' in patch) push('monthly_budget', patch.monthlyBudget ?? null);
    if ('budgetCurrency' in patch) push('budget_currency', patch.budgetCurrency ?? null);
    if (patch.rolloverEnabled != null) push('rollover_enabled', patch.rolloverEnabled ? 1 : 0);
    if (patch.sortOrder != null) push('sort_order', patch.sortOrder);
    if (sets.length === 0) return;
    args.push(id);
    raw.runSync(`UPDATE custom_categories SET ${sets.join(', ')} WHERE id = ?`, args);
  }
  bump();
}

/** Count expense transactions referencing this category (any date).
 *  Used by the delete-with-archive-instead guard. */
export function categoryTxnCount(id: string): number {
  const raw = getRawDB();
  const row = raw.getFirstSync(
    `SELECT COUNT(*) AS c FROM transactions WHERE category = ?`,
    [id],
  ) as { c: number } | undefined;
  return row?.c ?? 0;
}

/** Recency-weighted category frequency for the Smart Add chip strip.
 *  Looks back N days and counts expense transactions per category. */
export function useCategoryFrequency(opts: { days?: number } = {}): Map<string, number> {
  useVersion();
  const raw = getRawDB();
  const days = opts.days ?? 60;
  return useMemo(() => {
    const since = Date.now() - days * 86_400_000;
    try {
      const rows = raw.getAllSync(
        `SELECT category, COUNT(*) AS c
           FROM transactions
          WHERE type = 'expense' AND category IS NOT NULL AND date >= ?
          GROUP BY category`,
        [since],
      ) as Array<{ category: string; c: number }>;
      return new Map(rows.map((r) => [r.category, r.c]));
    } catch {
      return new Map();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, days]);
}

export function useRecurring(): Recurring[] {
  useVersion();
  const db = getDB();
  return useMemo(() => db.select().from(recurring).all(), [version]);
}

export function useGoals(): Goal[] {
  useVersion();
  const db = getDB();
  return useMemo(
    () => db.select().from(goals).orderBy(goals.createdAt).all(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
}

export function useDebts(): Debt[] {
  useVersion();
  const db = getDB();
  return useMemo(
    () => db.select().from(debts).orderBy(debts.createdAt).all(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
}

export function useCustomCategories(): CustomCategory[] {
  useVersion();
  const db = getDB();
  return useMemo(
    () => db.select().from(customCategories).orderBy(customCategories.createdAt).all(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
}

export function upsertCustomCategory(c: NewCustomCategory): void {
  const db = getDB();
  const existing = db.select().from(customCategories).where(eq(customCategories.id, c.id)).get();
  if (existing) db.update(customCategories).set(c).where(eq(customCategories.id, c.id)).run();
  else db.insert(customCategories).values(c).run();
  bump();
}

export function deleteCustomCategory(id: string): void {
  getDB().delete(customCategories).where(eq(customCategories.id, id)).run();
  bump();
}

export function usePaidItemsForMonth(key: string): PaidItem[] {
  useVersion();
  const db = getDB();
  return useMemo(
    () => db.select().from(paidItems).where(eq(paidItems.monthKey, key)).all(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, key],
  );
}

// ---- Aggregations (SQL, not JS array reduce) ----

export interface CategoryTotal {
  category: string;
  total: number;
}

export function useMonthTotalsByCategory(key: string, type: 'expense' | 'income' = 'expense'): CategoryTotal[] {
  useVersion();
  const db = getDB();
  return useMemo(() => {
    const [s, e] = monthRange(key);
    // Phase 10z: cap at "now" so a scheduled future expense doesn't
    // inflate the category bar before it actually fires. The upper
    // bound is whichever is smaller — end-of-month or right-now.
    const cap = Math.min(e, Date.now());
    return db
      .select({
        category: transactions.category,
        total: sql<number>`SUM(${transactions.amount})`.as('total'),
      })
      .from(transactions)
      .where(and(eq(transactions.type, type), gte(transactions.date, s), lt(transactions.date, cap)))
      .groupBy(transactions.category)
      .all()
      .filter((r): r is CategoryTotal => !!r.category) as CategoryTotal[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, key, type]);
}

export interface DayTotal {
  day: number;
  amount: number;
}

export function useDailySpend(key: string): DayTotal[] {
  useVersion();
  return useMemo(() => {
    const [s, e] = monthRange(key);
    const raw = getRawDB();
    // strftime works on unix seconds; we store ms.
    const rows = raw.getAllSync<{ day: number; amount: number }>(
      `SELECT CAST(strftime('%d', date/1000, 'unixepoch') AS INTEGER) AS day,
              SUM(amount) AS amount
         FROM transactions
        WHERE type = 'expense' AND date >= ? AND date < ?
        GROUP BY day
        ORDER BY day`,
      [s, e],
    );
    // Fill missing days with 0.
    const dim = new Date(new Date(s).getFullYear(), new Date(s).getMonth() + 1, 0).getDate();
    const map = new Map(rows.map((r) => [r.day, r.amount]));
    return Array.from({ length: dim }, (_, i) => ({ day: i + 1, amount: map.get(i + 1) ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, key]);
}

export function useNetBalance(): number {
  useVersion();
  const db = getDB();
  return useMemo(() => {
    const rows = db.select({ s: sql<number>`SUM(${accounts.balance})` }).from(accounts).all();
    return rows[0]?.s ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}

// ---- Mutations ----

function newId(prefix = 't'): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export interface AddTxnInput {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category?: string | null;
  accountId: string;
  toAccountId?: string | null;
  note?: string | null;
  halalStatus?: string | null;
  date?: number;
  recurringId?: string | null;
  /** Phase 10m: optional URI of the receipt image stored on the device. */
  receiptImagePath?: string | null;
  /** Phase 10q.3: optional asnaf tag for zakat/sadaqa/qurban recipients. */
  asnaf?: string | null;
  /** Multi-currency: when the user paid in a different currency than the
   *  account, `amount` is in account-currency (FX-converted) and these
   *  preserve the original entry. */
  originalAmount?: number | null;
  originalCurrency?: string | null;
}

/** Pre-flight checks. Throws AccountValidationError with `code='cash_negative'`
 *  when the transaction would drop a Cash-type account below zero. Callers
 *  catch the error and prompt the user; non-cash accounts are exempt. */
export class AccountValidationError extends Error {
  constructor(public code: 'cash_negative', public details: { accountId: string; projected: number }) {
    super(`account-validation:${code}`);
  }
}

function checkCashNegative(
  input: { type: AddTxnInput['type']; amount: number; accountId: string; toAccountId?: string | null },
) {
  const db = getDB();
  // The account-id we deduct from in the relevant direction:
  //   transfer  → accountId is the "from"  → projected = balance - amount
  //   expense   → accountId balance       → projected = balance - amount
  //   income    → no negative projection (adds)
  if (input.type === 'income') return;
  const acc = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
  if (!acc || acc.type !== 'cash') return;
  const projected = acc.balance - input.amount;
  if (projected < 0) {
    throw new AccountValidationError('cash_negative', { accountId: input.accountId, projected });
  }
}

export function addTransaction(
  input: AddTxnInput,
  opts: { skipCashCheck?: boolean } = {},
): Transaction {
  const db = getDB();
  const raw = getRawDB();
  const now = Date.now();
  const txDate = input.date ?? now;
  // Phase 10z: future-dated transactions are SCHEDULED, not yet
  // executed. Their row gets `applied = 0`; the balance does NOT
  // move on insert. The boot-time applyDueTransactions() pass debits
  // the account once the date has arrived.
  const isFuture = txDate > now;
  if (!isFuture && !opts.skipCashCheck) checkCashNegative(input);
  const id = newId();
  const row: NewTransaction = {
    id,
    type: input.type,
    amount: input.amount,
    category: input.category ?? null,
    accountId: input.accountId,
    toAccountId: input.toAccountId ?? null,
    note: input.note ?? null,
    halalStatus: input.halalStatus ?? null,
    recurringId: input.recurringId ?? null,
    receiptImagePath: input.receiptImagePath ?? null,
    asnaf: input.asnaf ?? null,
    originalAmount: input.originalAmount ?? null,
    originalCurrency: input.originalCurrency ?? null,
    date: txDate,
    createdAt: now,
    applied: isFuture ? 0 : 1,
  };
  raw.withTransactionSync(() => {
    db.insert(transactions).values(row).run();
    if (isFuture) {
      // Scheduled — don't touch account balances yet. Editing or
      // deletion before the date is a no-op on balances; once the
      // boot pass applies it, those reversals work like any normal tx.
      return;
    }
    // Account balance updates (only for already-applied / past-or-now txns).
    if (input.type === 'transfer' && input.toAccountId) {
      db.update(accounts).set({ balance: sql`${accounts.balance} - ${input.amount}` }).where(eq(accounts.id, input.accountId)).run();
      db.update(accounts).set({ balance: sql`${accounts.balance} + ${input.amount}` }).where(eq(accounts.id, input.toAccountId)).run();
    } else if (input.type === 'income') {
      db.update(accounts).set({ balance: sql`${accounts.balance} + ${input.amount}` }).where(eq(accounts.id, input.accountId)).run();
    } else {
      db.update(accounts).set({ balance: sql`${accounts.balance} - ${input.amount}` }).where(eq(accounts.id, input.accountId)).run();
    }
    if (input.type === 'expense' && input.category && input.note && !input.recurringId) {
      bumpMerchantMemoryInline(raw, input.note, input.category, input.accountId, now);
    }
  });
  bump();
  return { ...row } as Transaction;
}

/** Boot-time pass: any future-dated transaction whose date has now
 *  arrived gets its balance change applied and `applied` flips to 1.
 *  Safe to run on every cold launch (idempotent: applied=1 rows are
 *  skipped). */
export function applyDueTransactions(): number {
  const raw = getRawDB();
  const db = getDB();
  const now = Date.now();
  type Row = {
    id: string; type: 'expense' | 'income' | 'transfer';
    amount: number; account_id: string; to_account_id: string | null;
  };
  const rows = raw.getAllSync(
    `SELECT id, type, amount, account_id, to_account_id
       FROM transactions
      WHERE applied = 0 AND date <= ?`,
    [now],
  ) as Row[];
  if (rows.length === 0) return 0;
  raw.withTransactionSync(() => {
    for (const r of rows) {
      if (r.type === 'transfer' && r.to_account_id) {
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${r.amount}` }).where(eq(accounts.id, r.account_id)).run();
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${r.amount}` }).where(eq(accounts.id, r.to_account_id)).run();
      } else if (r.type === 'income') {
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${r.amount}` }).where(eq(accounts.id, r.account_id)).run();
      } else {
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${r.amount}` }).where(eq(accounts.id, r.account_id)).run();
      }
      raw.runSync(`UPDATE transactions SET applied = 1 WHERE id = ?`, [r.id]);
    }
  });
  if (rows.length > 0) bump();
  return rows.length;
}

/** Inline duplicate of bumpMerchantMemory to avoid pulling useSmartPredict into
 *  this file's import graph (would create a cycle). Kept in sync with the
 *  exported version in hooks/useSmartPredict.ts. */
function bumpMerchantMemoryInline(
  raw: ReturnType<typeof getRawDB>,
  note: string,
  category: string,
  accountId: string,
  now: number,
) {
  const tokens = note
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  for (const tok of tokens) {
    raw.runSync(
      `INSERT INTO merchant_memory (text, category, account_id, count, last_used)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(text) DO UPDATE SET
         category = excluded.category,
         account_id = excluded.account_id,
         count = merchant_memory.count + 1,
         last_used = excluded.last_used`,
      [tok, category, accountId, now],
    );
  }
}

export function deleteTransaction(id: string): void {
  const db = getDB();
  const raw = getRawDB();
  const existing = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!existing) return;
  // Phase 10z: only reverse balances when the transaction was already
  // applied. Scheduled-but-not-yet-fired rows (applied = 0) never
  // touched the account balance, so deleting them is a pure row
  // remove — no balance correction needed.
  const wasApplied = existing.applied !== 0;
  raw.withTransactionSync(() => {
    if (wasApplied) {
      if (existing.type === 'transfer' && existing.toAccountId) {
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${existing.amount}` }).where(eq(accounts.id, existing.toAccountId)).run();
      } else if (existing.type === 'income') {
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
      } else {
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
      }
    }
    db.delete(transactions).where(eq(transactions.id, id)).run();
    db.delete(paidItems).where(eq(paidItems.transactionId, id)).run();
  });
  bump();
}

/** Update a transaction with full balance reconciliation. If amount, type,
 *  accountId, or toAccountId change, the old account-balance impact is
 *  reversed and the new one re-applied within a single SQLite transaction
 *  so partial states never persist. Pure-metadata edits (note, category,
 *  halalStatus, date) skip the balance dance. */
export function updateTransaction(id: string, patch: Partial<Transaction>): void {
  const db = getDB();
  const raw = getRawDB();
  const existing = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!existing) return;

  const next = { ...existing, ...patch };
  const balanceTouched =
    patch.amount !== undefined && patch.amount !== existing.amount ||
    patch.type !== undefined && patch.type !== existing.type ||
    patch.accountId !== undefined && patch.accountId !== existing.accountId ||
    patch.toAccountId !== undefined && patch.toAccountId !== existing.toAccountId;

  raw.withTransactionSync(() => {
    if (balanceTouched) {
      // 1. Reverse old balance effects.
      if (existing.type === 'transfer' && existing.toAccountId) {
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${existing.amount}` }).where(eq(accounts.id, existing.toAccountId)).run();
      } else if (existing.type === 'income') {
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
      } else {
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
      }
      // 2. Apply new balance effects.
      if (next.type === 'transfer' && next.toAccountId) {
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${next.amount}` }).where(eq(accounts.id, next.accountId)).run();
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${next.amount}` }).where(eq(accounts.id, next.toAccountId)).run();
      } else if (next.type === 'income') {
        db.update(accounts).set({ balance: sql`${accounts.balance} + ${next.amount}` }).where(eq(accounts.id, next.accountId)).run();
      } else {
        db.update(accounts).set({ balance: sql`${accounts.balance} - ${next.amount}` }).where(eq(accounts.id, next.accountId)).run();
      }
    }
    db.update(transactions).set(patch).where(eq(transactions.id, id)).run();
  });
  bump();
}

export function setHalalStatus(id: string, status: Transaction['halalStatus']): void {
  updateTransaction(id, { halalStatus: status });
}

// ---- Phase 10w: budgets→categories migration ----

/** Copy any rows from the legacy standalone `budgets` table onto the
 *  matching custom_categories row. Idempotent: skips when the target
 *  row already has monthly_budget set, and deletes the legacy row only
 *  after the merge succeeds. Safe to run on every boot. */
function migrateBudgetsToCategories() {
  const raw = getRawDB();
  let legacy: Array<{ id: string; category: string; limit: number }> = [];
  try {
    legacy = raw.getAllSync(`SELECT id, category, "limit" FROM budgets`) as typeof legacy;
  } catch {
    return;
  }
  if (legacy.length === 0) return;
  const defaultCurrency = kv.get('currency') ?? 'USD';

  const seededLookup = new Map<string, { name: string; icon: string; color: string; type: 'expense' | 'income' }>();
  for (const c of EXPENSE_CATEGORIES) {
    seededLookup.set(c.id, { name: c.name, icon: c.icon, color: c.color, type: 'expense' });
  }
  for (const c of INCOME_CATEGORIES) {
    if (!seededLookup.has(c.id)) {
      seededLookup.set(c.id, { name: c.name, icon: c.icon, color: c.color, type: 'income' });
    }
  }

  raw.withTransactionSync(() => {
    for (const b of legacy) {
      const existing = raw.getFirstSync(
        `SELECT id, monthly_budget FROM custom_categories WHERE id = ?`,
        [b.category],
      ) as { id: string; monthly_budget: number | null } | undefined;
      if (existing) {
        if (existing.monthly_budget == null) {
          raw.runSync(
            `UPDATE custom_categories SET monthly_budget = ?, budget_currency = ? WHERE id = ?`,
            [b.limit, defaultCurrency, b.category],
          );
        }
      } else {
        const seeded = seededLookup.get(b.category);
        const name = seeded?.name ?? b.category;
        const icon = seeded?.icon ?? 'MoreHorizontal';
        const color = seeded?.color ?? '#8888AA';
        const type = seeded?.type ?? 'expense';
        raw.runSync(
          `INSERT INTO custom_categories (id, name, icon, color, type, created_at, monthly_budget, budget_currency)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.category, name, icon, color, type, Date.now(), b.limit, defaultCurrency],
        );
      }
      raw.runSync(`DELETE FROM budgets WHERE id = ?`, [b.id]);
    }
  });
  bump();
}

// ---- Accounts ----

/** Reorder accounts. Caller passes the IDs in the new display order;
 *  we batch-update sort_order to N×10 so future inserts have room
 *  between existing rows without renumbering. */
export function reorderAccounts(orderedIds: string[]): void {
  const db = getDB();
  const raw = getRawDB();
  raw.withTransactionSync(() => {
    orderedIds.forEach((id, i) => {
      db.update(accounts).set({ sortOrder: (i + 1) * 10 }).where(eq(accounts.id, id)).run();
    });
  });
  bump();
}

export function upsertAccount(a: typeof accounts.$inferInsert): void {
  const db = getDB();
  const existing = db.select().from(accounts).where(eq(accounts.id, a.id)).get();
  if (existing) db.update(accounts).set(a).where(eq(accounts.id, a.id)).run();
  else db.insert(accounts).values(a).run();
  bump();
}

export function deleteAccount(id: string): void {
  const db = getDB();
  // Low-level: removes the account row WITHOUT touching transactions.
  // Callers typically want deleteAccountCascade() — see below.
  db.delete(accounts).where(eq(accounts.id, id)).run();
  bump();
}

/**
 * Cascade delete with the semantics the user expects:
 *   • Direct expense/income transactions on this account → deleted
 *   • Transfers involving this account → kept; the account row is renamed
 *     to "Deleted: <original>" and archived so the reference still
 *     resolves, but it won't show in account pickers or net-worth totals.
 *   • If there are no references, the account row is hard-deleted.
 *
 * Returns counts so the success toast can report "N transactions removed,
 * M transfers preserved." Idempotent at the row level.
 */
export function deleteAccountCascade(id: string): { txnsDeleted: number; transfersPreserved: number } {
  const db = getDB();
  const raw = getRawDB();
  const acc = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!acc) return { txnsDeleted: 0, transfersPreserved: 0 };

  const direct = raw.getAllSync<{ id: string }>(
    `SELECT id FROM transactions WHERE account_id = ? AND type IN ('expense', 'income')`,
    [id],
  );
  for (const t of direct) {
    db.delete(transactions).where(eq(transactions.id, t.id)).run();
  }

  const transfers = raw.getAllSync<{ id: string }>(
    `SELECT id FROM transactions WHERE type = 'transfer' AND (account_id = ? OR to_account_id = ?)`,
    [id, id],
  );

  if (transfers.length === 0) {
    // No transfer refs — hard-delete the row.
    db.delete(accounts).where(eq(accounts.id, id)).run();
  } else {
    // Preserve transfer history by renaming + archiving so the lookup
    // still resolves to a stable record but the account is invisible
    // in pickers / totals.
    db.update(accounts).set({
      name: `Deleted: ${acc.name}`,
      archived: 1,
      includeInTotal: 0,
      balance: 0,
    }).where(eq(accounts.id, id)).run();
  }

  bump();
  return { txnsDeleted: direct.length, transfersPreserved: transfers.length };
}

// ---- Budgets (Phase 10w: now stored on categories) ----

/** Legacy shape — id here is the *category id*. Routes through
 *  setCategoryMeta so the budget lives on the canonical row. */
export function upsertBudget(b: NewBudget): void {
  const defaultCurrency = kv.get('currency') ?? 'USD';
  setCategoryMeta(b.category, {
    monthlyBudget: b.limit,
    budgetCurrency: defaultCurrency,
  });
}

/** `id` here is the category id (we synthesize id=category in useBudgets). */
export function deleteBudget(id: string): void {
  setCategoryMeta(id, { monthlyBudget: null, budgetCurrency: null });
}

// ---- Goals (Phase 10l) ----

export function upsertGoal(g: NewGoal): void {
  const db = getDB();
  const existing = db.select().from(goals).where(eq(goals.id, g.id)).get();
  if (existing) db.update(goals).set(g).where(eq(goals.id, g.id)).run();
  else db.insert(goals).values(g).run();
  bump();
}

export function deleteGoal(id: string): void {
  getDB().delete(goals).where(eq(goals.id, id)).run();
  bump();
}

// ---- Debts (Phase 10o) ----

export function upsertDebt(d: NewDebt): void {
  const db = getDB();
  const existing = db.select().from(debts).where(eq(debts.id, d.id)).get();
  if (existing) db.update(debts).set(d).where(eq(debts.id, d.id)).run();
  else db.insert(debts).values(d).run();
  bump();
}

export function deleteDebt(id: string): void {
  getDB().delete(debts).where(eq(debts.id, id)).run();
  bump();
}

// ---- Recurring ----

export function upsertRecurring(r: typeof recurring.$inferInsert): void {
  const db = getDB();
  const existing = db.select().from(recurring).where(eq(recurring.id, r.id)).get();
  if (existing) db.update(recurring).set(r).where(eq(recurring.id, r.id)).run();
  else db.insert(recurring).values(r).run();
  bump();
}

export function deleteRecurring(id: string): void {
  getDB().delete(recurring).where(eq(recurring.id, id)).run();
  bump();
}

export function markRecurringPaid(rec: Recurring, date: Date = new Date()): void {
  const key = monthKey(date);
  const txn = addTransaction({
    type: rec.type,
    amount: rec.amount,
    category: rec.category,
    accountId: rec.accountId,
    note: rec.name,
    recurringId: rec.id,
    date: date.getTime(),
  });
  const db = getDB();
  db.insert(paidItems)
    .values({
      id: `${rec.id}_${key}`,
      recurringId: rec.id,
      monthKey: key,
      transactionId: txn.id,
      paidAt: Date.now(),
    })
    .run();
  bump();
}

export function unmarkRecurringPaid(recId: string, key: string): void {
  const db = getDB();
  const item = db
    .select()
    .from(paidItems)
    .where(and(eq(paidItems.recurringId, recId), eq(paidItems.monthKey, key)))
    .get();
  if (!item) return;
  deleteTransaction(item.transactionId);
  db.delete(paidItems).where(eq(paidItems.id, item.id)).run();
  bump();
}

/** Phase 10v: link an already-created transaction to a recurring item
 *  for the given month (no new tx, just the paid_items row). Used when
 *  the user opens Smart Add prefilled from a recurring row, edits, and
 *  submits — the checkbox then becomes "paid" because a real txn now
 *  exists. */
export function linkRecurringPaid(recId: string, transactionId: string, date: Date = new Date()): void {
  const key = monthKey(date);
  const db = getDB();
  db.insert(paidItems)
    .values({
      id: `${recId}_${key}`,
      recurringId: recId,
      monthKey: key,
      transactionId,
      paidAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();
  bump();
}
