// Seeds the DB on first launch. Matches v4's SEED IIFE (lines 97-110) but writes
// into the relational schema instead of a single JSON blob.

import { sql } from 'drizzle-orm';
import { getDB } from './client';
import { accounts, budgets, recurring, transactions } from './schema';
import { DEFAULT_ACCOUNTS, DEFAULT_BUDGETS, DEFAULT_RECURRING } from '@/constants/defaults';
import { kv } from '@/utils/kv';

export async function isEmpty(): Promise<boolean> {
  const db = getDB();
  const rows = await db.select({ c: sql<number>`count(*)` }).from(accounts);
  return (rows[0]?.c ?? 0) === 0;
}

/** Phase 10y: sample-data seeding is OFF by default. Real money apps
 *  shouldn't pollute the user's ledger with fake transactions — the
 *  Disposable hero, Activity totals, and budget bars would all show
 *  nonsense numbers. We keep the seed routine in source so a future
 *  "Try with sample data" Demo profile opt-in can call seedDemoData()
 *  directly, but the boot path never invokes it.
 *
 *  Anything genuinely default (category list, system categories,
 *  "Personal" profile) is configuration, not transactions — those
 *  remain seeded elsewhere. */
export async function seedIfEmpty() {
  return; // no-op
}

/** Explicit opt-in: dumps the legacy demo dataset into the active
 *  profile's DB. Not wired to UI yet; reserved for a "Demo profile"
 *  onboarding affordance. */
export async function seedDemoData() {
  if (kv.getBool('hasSeededOnce', false)) return;
  if (!(await isEmpty())) return;
  const db = getDB();

  await db.insert(accounts).values(DEFAULT_ACCOUNTS);
  await db.insert(budgets).values(DEFAULT_BUDGETS);
  await db.insert(recurring).values(DEFAULT_RECURRING);

  // Transactions: 25 this-month, 20 last-month, 3 income, 1 transfer.
  // Matches v4 SEED IIFE seeds.
  const now = new Date();
  const cats = ['food', 'transport', 'shopping', 'coffee', 'bills', 'entertainment', 'health', 'fuel', 'subs', 'clothing'];
  const amts = [12.5, 8.99, 45, 5.75, 120, 25, 35, 55, 14.99, 89, 6.5, 18, 32, 4.25, 150, 22.5, 9.99, 67, 3.5, 42];
  const notes = ['Lunch', 'Uber', 'Amazon', 'Starbucks', 'Electric', 'Netflix', 'Pharmacy', 'Gas', 'Spotify', 'H&M', 'Latte', 'Pizza', 'Groceries', 'Tea', 'Insurance', 'Dinner', 'iTunes', 'Shoes', 'Snack', 'Books'];

  const toInsert: (typeof transactions.$inferInsert)[] = [];
  for (let i = 0; i < 25; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.floor(Math.random() * 28));
    toInsert.push({
      id: `s${i}`,
      type: 'expense',
      amount: amts[i % amts.length],
      category: cats[i % cats.length],
      accountId: i % 3 === 0 ? 'credit' : i % 2 === 0 ? 'bank' : 'cash',
      date: d.getTime(),
      createdAt: Date.now(),
      note: notes[i % notes.length],
    });
  }
  for (let i = 0; i < 20; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    d.setDate(1 + Math.floor(Math.random() * 28));
    toInsert.push({
      id: `lm${i}`,
      type: 'expense',
      amount: amts[(i + 3) % amts.length],
      category: cats[i % cats.length],
      accountId: 'bank',
      date: d.getTime(),
      createdAt: Date.now(),
      note: notes[(i + 5) % notes.length],
    });
  }
  // Income + transfer dated strictly in the past so newly-added user
  // transactions sort to the top of Activity / Recent.
  const incomeDaysAgo = [28, 14, 4]; // Salary 28d ago, Design gig 14d, Dividends 4d
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - incomeDaysAgo[i]);
    toInsert.push({
      id: `si${i}`,
      type: 'income',
      amount: i === 0 ? 3500 : i === 1 ? 450 : 200,
      category: i === 0 ? 'salary' : i === 1 ? 'freelance' : 'investment',
      accountId: 'bank',
      date: d.getTime(),
      createdAt: Date.now(),
      note: i === 0 ? 'Salary' : i === 1 ? 'Design gig' : 'Dividends',
    });
  }
  const transferDate = new Date(now);
  transferDate.setDate(transferDate.getDate() - 7);
  toInsert.push({
    id: 'st0',
    type: 'transfer',
    amount: 200,
    accountId: 'bank',
    toAccountId: 'savings',
    date: transferDate.getTime(),
    createdAt: Date.now(),
    note: 'Monthly savings',
  });

  await db.insert(transactions).values(toInsert);
  kv.setBool('hasSeededOnce', true);
}
