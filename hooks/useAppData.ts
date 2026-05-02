// useAppData — replaces v4's ~25 useState hooks with a Drizzle-backed store.
// Queries return live rows; mutations commit to SQLite and poke a version bump
// so consumers re-render. Avoids the "deserialize whole blob on every render"
// problem that a single JSON column would have.
//
// Usage:
//   const { transactions, addTransaction, deleteTransaction } = useAppData();

import { useCallback, useEffect, useMemo, useState } from 'react';
import { and, desc, eq, gte, like, lt, or, sql } from 'drizzle-orm';
import { getDB, getRawDB } from '@/utils/db/client';
import {
  accounts,
  budgets,
  paidItems,
  recurring,
  transactions,
  type Account,
  type Budget,
  type NewBudget,
  type NewTransaction,
  type PaidItem,
  type Recurring,
  type Transaction,
} from '@/utils/db/schema';
import { monthKey } from '@/utils/format';
import { seedIfEmpty } from '@/utils/db/seed';

// Single process-wide version counter that all hooks watch. Bumped on every
// mutation so useEffect-driven re-queries fire.
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
function bump() {
  version += 1;
  listeners.forEach((l) => l());
}
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
  limit?: number;
}

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
    const where = clauses.length ? and(...clauses) : undefined;
    let q = db.select().from(transactions).where(where).orderBy(desc(transactions.date));
    if (opts.limit) q = q.limit(opts.limit) as typeof q;
    return q.all();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, opts.monthKey, opts.category, opts.accountId, opts.type, opts.search, opts.halalStatus, opts.limit]);
}

export function useAccounts(): Account[] {
  useVersion();
  const db = getDB();
  return useMemo(() => db.select().from(accounts).orderBy(accounts.sortOrder).all(), [version]);
}

export function useBudgets(): Budget[] {
  useVersion();
  const db = getDB();
  return useMemo(() => db.select().from(budgets).all(), [version]);
}

export function useRecurring(): Recurring[] {
  useVersion();
  const db = getDB();
  return useMemo(() => db.select().from(recurring).all(), [version]);
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
    return db
      .select({
        category: transactions.category,
        total: sql<number>`SUM(${transactions.amount})`.as('total'),
      })
      .from(transactions)
      .where(and(eq(transactions.type, type), gte(transactions.date, s), lt(transactions.date, e)))
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
}

export function addTransaction(input: AddTxnInput): Transaction {
  const db = getDB();
  const raw = getRawDB();
  const id = newId();
  const now = Date.now();
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
    date: input.date ?? now,
    createdAt: now,
  };
  raw.withTransactionSync(() => {
    db.insert(transactions).values(row).run();
    // Account balance updates.
    if (input.type === 'transfer' && input.toAccountId) {
      db.update(accounts).set({ balance: sql`${accounts.balance} - ${input.amount}` }).where(eq(accounts.id, input.accountId)).run();
      db.update(accounts).set({ balance: sql`${accounts.balance} + ${input.amount}` }).where(eq(accounts.id, input.toAccountId)).run();
    } else if (input.type === 'income') {
      db.update(accounts).set({ balance: sql`${accounts.balance} + ${input.amount}` }).where(eq(accounts.id, input.accountId)).run();
    } else {
      db.update(accounts).set({ balance: sql`${accounts.balance} - ${input.amount}` }).where(eq(accounts.id, input.accountId)).run();
    }
    // Phase 7: bump merchant_memory for L2 prediction. Skipped for transfers
    // (no category) and recurring auto-creates (system-named, not user notes).
    if (input.type === 'expense' && input.category && input.note && !input.recurringId) {
      bumpMerchantMemoryInline(raw, input.note, input.category, input.accountId, now);
    }
  });
  bump();
  return { ...row } as Transaction;
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
  raw.withTransactionSync(() => {
    // Reverse balance effects.
    if (existing.type === 'transfer' && existing.toAccountId) {
      db.update(accounts).set({ balance: sql`${accounts.balance} + ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
      db.update(accounts).set({ balance: sql`${accounts.balance} - ${existing.amount}` }).where(eq(accounts.id, existing.toAccountId)).run();
    } else if (existing.type === 'income') {
      db.update(accounts).set({ balance: sql`${accounts.balance} - ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
    } else {
      db.update(accounts).set({ balance: sql`${accounts.balance} + ${existing.amount}` }).where(eq(accounts.id, existing.accountId)).run();
    }
    db.delete(transactions).where(eq(transactions.id, id)).run();
    // Clean any paid_items referencing this transaction.
    db.delete(paidItems).where(eq(paidItems.transactionId, id)).run();
  });
  bump();
}

export function updateTransaction(id: string, patch: Partial<Transaction>): void {
  const db = getDB();
  db.update(transactions).set(patch).where(eq(transactions.id, id)).run();
  bump();
}

export function setHalalStatus(id: string, status: Transaction['halalStatus']): void {
  updateTransaction(id, { halalStatus: status });
}

// ---- Budgets ----

// ---- Accounts ----

export function upsertAccount(a: typeof accounts.$inferInsert): void {
  const db = getDB();
  const existing = db.select().from(accounts).where(eq(accounts.id, a.id)).get();
  if (existing) db.update(accounts).set(a).where(eq(accounts.id, a.id)).run();
  else db.insert(accounts).values(a).run();
  bump();
}

export function deleteAccount(id: string): void {
  const db = getDB();
  // Caller should warn the user — deleting an account orphans its txns'
  // accountId reference. We intentionally don't cascade-delete txns; that's
  // user data. Caller can choose to reassign first.
  db.delete(accounts).where(eq(accounts.id, id)).run();
  bump();
}

// ---- Budgets ----

export function upsertBudget(b: NewBudget): void {
  const db = getDB();
  const existing = db.select().from(budgets).where(eq(budgets.category, b.category)).get();
  if (existing) db.update(budgets).set({ limit: b.limit }).where(eq(budgets.id, existing.id)).run();
  else db.insert(budgets).values({ ...b, id: b.id ?? newId('b') }).run();
  bump();
}

export function deleteBudget(id: string): void {
  getDB().delete(budgets).where(eq(budgets.id, id)).run();
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
