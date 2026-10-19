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
    // Phase 10q.3 — zakat distribution recipient (one of 8 asnaf).
    // Null on every non-zakat/sadaqa transaction. Generic builds never
    // write or read this column; it's harmless dead weight there.
    asnaf: text('asnaf'),
    // Multi-currency transactions: when the user spent in a currency
    // different from their account's currency, `amount` stays in the
    // account's currency (so balance math works), and these two fields
    // capture the original input — e.g. EUR 500 charged on a USD card
    // becomes amount=588.73, originalAmount=500, originalCurrency='EUR'.
    // Null on same-currency transactions.
    originalAmount: real('original_amount'),
    originalCurrency: text('original_currency'),
    // Phase 10z: scheduled future-dated transactions. When `date > now`
    // at insert time, the row is created but the account balance is NOT
    // moved. `applied = 0` flags pending; a boot-time pass flips it to
    // 1 and debits the balance once the date has arrived. Existing
    // historical rows have applied = NULL which we treat as 1 (legacy
    // = always applied) so the migration is a no-op for everyone.
    applied: integer('applied'),  // 0/1; null = legacy / always applied
    // Cross-currency transfers: `amount` lives in the FROM account's
    // currency (and powers the debit). `to_amount` is the credit value
    // in the TO account's currency. Both are stored so the deposit
    // can be reversed exactly on delete/edit without re-fetching FX
    // (which may have drifted since the transfer was recorded).
    // Null on non-transfer rows AND on same-currency transfers — the
    // apply/reverse code treats null as "same as amount".
    toAmount: real('to_amount'),
    // Amount in the user's MAIN currency, fixed at save time with the
    // rate for the transaction's date (fx_history; today's rate when no
    // history covers that day). Totals sum this column directly, so a
    // later rate change never rewrites history. Null on transfers and
    // on rows written before the column existed (backfilled at boot).
    amountMain: real('amount_main'),
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
  // 'investment' (10v) tracks brokerage / pension / crypto wallets — value
  // can fluctuate, included in net worth by default.
  // 'receivable' = money OWED TO the user (lent to a friend, a deposit
  // due back). Positive balance, counts as an asset; the mirror image of
  // 'debt'. Lending = transfer cash → receivable; repayment = back.
  type: text('type', { enum: ['cash', 'bank', 'credit', 'savings', 'debt', 'investment', 'receivable'] }).notNull(),
  balance: real('balance').notNull(),
  creditLimit: real('credit_limit'),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  // Phase 10k: per-account currency (ISO 4217). NULL = inherit the user's
  // global display currency (kv.currency). Lets a single user hold accounts
  // in mixed currencies without forcing all balances onto one ledger unit.
  currency: text('currency'),
  // Phase 10q: islamic-only flag indicating the account earns interest
  // (riba). Surfaces a footer warning in the Accounts list and an
  // advisory line on the Zakat calculator. The column exists in both
  // flavors but is only set / read in the islamic build — keeping it
  // schema-wide avoids a flavor-specific migration.
  isRiba: integer('is_riba'),  // 0 / 1; null = unset (default no warning)
  // Phase 10v: account lifecycle / visibility flags.
  // includeInTotal: 0 lets the user keep an account on file but exclude
  // it from Net Balance / Assets / Debt (e.g. spouse's card, archived
  // joint account). Default 1.
  // archived: hides the account from active lists, excludes from totals,
  // historical transactions still resolve to it. Default 0.
  includeInTotal: integer('include_in_total'),   // 0 / 1; null = 1
  archived: integer('archived'),                 // 0 / 1; null = 0
  // Unix-ms stamp set when upsertAccount sees archived flip 0 → 1.
  // Null for accounts that were never archived; surfaced in the
  // detail screen as "Archived on {date}".
  archivedAt: integer('archived_at'),
});

// Phase 10k: cached daily exchange rates from frankfurter.app. Rows are
// always base=USD (we cross-rate via USD on the JS side). Refreshed at
// most once per 24h, gated behind kv.fxAutoRefresh.
export const fxRates = sqliteTable('fx_rates', {
  quote: text('quote').primaryKey(),     // ISO 4217 (e.g. 'EUR', 'GBP')
  rate: real('rate').notNull(),          // 1 USD = `rate` quote-currency units
  fetchedAt: integer('fetched_at').notNull(),
});

// Phase 10s: user-defined categories. Layered ON TOP of the seeded
// EXPENSE_CATEGORIES / INCOME_CATEGORIES from constants/categories — id
// space is shared, so a custom row with id='coffee' would shadow the
// seeded one. catInfo() prefers customs when both exist.
//
// Phase 10w extends this table to be the canonical management surface for
// ALL category metadata users care about — pinning, archiving, budgets,
// rollover. Seeded categories that the user customizes get an override
// row inserted here (id matches the seeded id).
export const customCategories = sqliteTable('custom_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  // 'both' means the category is offered in expense AND income pickers.
  type: text('type', { enum: ['expense', 'income', 'both'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  // 10w fields ----------------------------------------------------------
  isSystem: integer('is_system'),         // 1 for 'other' / 'adjustment'
  isPinned: integer('is_pinned'),         // 1 = stick to top
  sortOrder: integer('sort_order'),       // user-defined within pinned/unpinned groups
  archived: integer('archived'),          // 1 = hide from pickers
  monthlyBudget: real('monthly_budget'),  // nullable cap; null = no budget
  budgetCurrency: text('budget_currency'),// ISO; locked at budget creation
  rolloverEnabled: integer('rollover_enabled'), // 1 = unused budget rolls into next month
  // Per-month bookkeeping for the 80% / 100% push-notification gates.
  // Stored as a JSON map { "2026-05": ["80","100"], … } — small enough
  // to live inline; saves a separate `budget_alerts` table.
  budgetAlertsSent: text('budget_alerts_sent'),
  // Phase 10ab: per-locale name overrides. JSON map { "<locale>": "<name>", … }.
  // Create-flow flood-fills the user-typed name across all 50 locales.
  // Edit-flow only updates the active locale's entry — other locales keep
  // their existing value. `name` (above) stays in sync with the active-locale
  // entry for back-compat and as a final fallback.
  nameTranslations: text('name_translations'),
});

// Phase 10p: daily net-worth snapshots so the Activity analytics can chart
// "net worth over time". Keyed by ISO date (YYYY-MM-DD) — at most one row
// per day. Captured at app boot whenever the active profile's "today" row
// is missing; subsequent boots in the same day just no-op.
export const netWorthSnapshots = sqliteTable('net_worth_snapshots', {
  date: text('date').primaryKey(),  // YYYY-MM-DD (local time, profile-scoped)
  assets: real('assets').notNull(),
  debt: real('debt').notNull(),
  net: real('net').notNull(),
});

// Phase 10o: liability tracker. Distinct from `accounts` of type='debt'
// because we need APR + minimum-payment metadata to do payoff math —
// account balances alone don't carry that. The `accountId` is optional;
// when set, the account's balance is treated as the live debt balance
// (so paying it down via a transfer automatically reduces the debt).
// Otherwise `balance` is the source of truth.
export const debts = sqliteTable('debts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  balance: real('balance').notNull(),         // current outstanding (positive)
  apr: real('apr').notNull(),                 // annual percentage rate, e.g. 18.99
  minPayment: real('min_payment').notNull(),  // monthly minimum payment
  accountId: text('account_id'),              // optional link to an `accounts` row
  currency: text('currency'),                 // ISO; null = user default
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  createdAt: integer('created_at').notNull(),
});

// Phase 10l: savings goals. Each goal is anchored to an account; progress
// is computed from that account's current balance against `targetAmount`.
// Anchoring to an account (vs. a free-floating progress counter) means
// every transfer/income to that account automatically advances the goal
// — no separate "log a contribution" step.
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  targetDate: integer('target_date'),     // unix ms; null = open-ended
  accountId: text('account_id').notNull(),
  currency: text('currency'),             // ISO; null = user default
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  createdAt: integer('created_at').notNull(),
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
  currency: text('currency'),             // ISO; null = user default
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

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;

export type NetWorthSnapshot = typeof netWorthSnapshots.$inferSelect;

export type CustomCategory = typeof customCategories.$inferSelect;
export type NewCustomCategory = typeof customCategories.$inferInsert;

// Convenience: monthKey for a given date (YYYY-MM).
export function monthKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
