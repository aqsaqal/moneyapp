// Drizzle ORM schema. Single JSON column was rejected in plan §6 decision 1 in
// favor of a proper normalized schema — SQL aggregations instead of JS-side
// reduces on deserialized blobs, indexed filters instead of full-parse-per-query.

import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['expense', 'income', 'transfer'] }).notNull(),
    amount: real('amount').notNull(),
    category: text('category'),
    accountId: text('account_id').notNull(),
    toAccountId: text('to_account_id'),
    note: text('note'),
    date: integer('date').notNull(),       // unix ms — indexed
    createdAt: integer('created_at').notNull(),
    recurringId: text('recurring_id'),     // set when created by markPaid()
    halalStatus: text('halal_status'),     // optional; islamic only sets/reads
    // Reserved for v2.3 receipt OCR. Nullable + additive — no migration cost.
    receiptImagePath: text('receipt_image_path'),
  },
  (t) => ({
    dateIdx: index('tx_date_idx').on(t.date),
    categoryIdx: index('tx_category_idx').on(t.category),
    accountIdx: index('tx_account_idx').on(t.accountId),
    typeIdx: index('tx_type_idx').on(t.type),
  }),
);

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // 'debt' = generic liability (loan, mortgage, owed money). Distinct from
  // 'credit' (credit card) which has a creditLimit and is paid back monthly.
  type: text('type', { enum: ['cash', 'bank', 'credit', 'savings', 'debt'] }).notNull(),
  balance: real('balance').notNull(),
  creditLimit: real('credit_limit'),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  // Phase 10k: per-account currency (ISO 4217). NULL = inherit the user's
  // global display currency (kv.currency). Lets a single user hold accounts
  // in mixed currencies without forcing all balances onto one ledger unit.
  currency: text('currency'),
});

// Phase 10k: cached daily exchange rates from frankfurter.app. Rows are
// always base=USD (we cross-rate via USD on the JS side). Refreshed at
// most once per 24h, gated behind kv.fxAutoRefresh.
export const fxRates = sqliteTable('fx_rates', {
  quote: text('quote').primaryKey(),     // ISO 4217 (e.g. 'EUR', 'GBP')
  rate: real('rate').notNull(),          // 1 USD = `rate` quote-currency units
  fetchedAt: integer('fetched_at').notNull(),
});

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  limit: real('limit').notNull(),
});

export const recurring = sqliteTable('recurring', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['expense', 'income'] }).notNull(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  category: text('category'),
  accountId: text('account_id').notNull(),
  dayOfMonth: integer('day_of_month').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
});

// Phase 7 (Smart Add) — merchant memory for L2 category prediction.
//
// Updated on every successful addTransaction(): tokenize the note, upsert
// (token → category, accountId, ++count, lastUsed). On future adds, when
// the user types a token we already know, look it up here and pre-fill
// category + account.
//
// Compound primary key (text, accountId) so the same word can map to
// different (category, account) pairs for different accounts ("uber" on
// the corporate card might be transport; on the cash account, also
// transport — usually consistent, but we don't lock it in).
export const merchantMemory = sqliteTable('merchant_memory', {
  text: text('text').notNull(),                  // lowercased single token
  category: text('category').notNull(),
  accountId: text('account_id').notNull(),
  count: integer('count').notNull().default(1),
  lastUsed: integer('last_used').notNull(),
});
// Note: drizzle-orm/sqlite-core composite PRIMARY KEY support varies; we
// enforce uniqueness via DDL in client.ts (CREATE UNIQUE INDEX on (text)
// gives last-write-wins per token, which is the right semantics here).

// Tracks which recurring items have been paid in which month.
// Composite key: recurringId + monthKey (YYYY-MM).
export const paidItems = sqliteTable('paid_items', {
  id: text('id').primaryKey(),            // `${recurringId}_${monthKey}`
  recurringId: text('recurring_id').notNull(),
  monthKey: text('month_key').notNull(),
  transactionId: text('transaction_id').notNull(),
  paidAt: integer('paid_at').notNull(),
});

// ---- TypeScript types derived from the schema ----

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type Recurring = typeof recurring.$inferSelect;
export type NewRecurring = typeof recurring.$inferInsert;

export type PaidItem = typeof paidItems.$inferSelect;
export type NewPaidItem = typeof paidItems.$inferInsert;

export type MerchantMemoryRow = typeof merchantMemory.$inferSelect;
export type NewMerchantMemoryRow = typeof merchantMemory.$inferInsert;

// Convenience: monthKey for a given date (YYYY-MM).
export function monthKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
