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
  type: text('type', { enum: ['cash', 'bank', 'credit', 'savings'] }).notNull(),
  balance: real('balance').notNull(),
  creditLimit: real('credit_limit'),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
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

// Convenience: monthKey for a given date (YYYY-MM).
export function monthKey(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
