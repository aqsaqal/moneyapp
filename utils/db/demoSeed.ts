// Demo profile seed — 24 months of activity across multiple accounts,
// recurring bills, budgets, goals, and debts. Used to populate a
// "Demo" profile so a freshly-installed app feels lived-in and the
// charts/insights have something to draw.
//
// Two entry points:
//   - ensureDemoProfile()   — idempotent; called on fresh install to
//                              create the Demo profile alongside the
//                              user's blank profile. No-op if Demo
//                              already exists.
//   - rebuildDemoProfile()  — destructive rebuild used by the Settings
//                              button when the user wants fresh data.
//                              Drops the existing Demo profile (if any)
//                              and recreates it.
//
// Both wipe/insert *only* the Demo profile's DB — the user's data is
// never touched.

import { kv } from '@/utils/kv';
import {
  readProfiles,
  createProfile,
  deleteProfile,
  switchActiveProfile,
  getActiveProfileId,
} from '@/utils/profiles';
import { getDB, getRawDB } from './client';
import { accounts, recurring, transactions, goals, debts, paidItems } from './schema';

const DEMO_NAME = 'Demo';

interface SeedResult {
  profileId: string;
  created: boolean; // false when already existed and rebuild==false
}

export function findDemoProfile(): { id: string } | null {
  const p = readProfiles().find((x) => x.name.toLowerCase() === DEMO_NAME.toLowerCase());
  return p ? { id: p.id } : null;
}

/** Idempotent + silent — boot path. Creates the Demo profile if it
 *  doesn't exist yet, leaves the user on whatever profile they were
 *  on before. */
export function ensureDemoProfile(): SeedResult {
  const existing = findDemoProfile();
  if (existing) return { profileId: existing.id, created: false };
  return doSeed({ restoreOriginal: true });
}

/** User-invoked — drops any existing Demo profile, recreates it, and
 *  lands the user inside the new Demo profile so they can explore it. */
export function rebuildDemoProfile(): SeedResult {
  const existing = findDemoProfile();
  if (existing) {
    if (getActiveProfileId() === existing.id) {
      const others = readProfiles().filter((p) => p.id !== existing.id);
      if (others[0]) switchActiveProfile(others[0].id);
    }
    deleteProfile(existing.id);
  }
  return doSeed({ restoreOriginal: false });
}

function doSeed({ restoreOriginal }: { restoreOriginal: boolean }): SeedResult {
  const original = getActiveProfileId();
  const profile = createProfile({ name: DEMO_NAME, color: '#A78BFA', icon: 'flask-outline' });
  switchActiveProfile(profile.id);
  try {
    seedAll();
  } finally {
    if (restoreOriginal && original && original !== profile.id) {
      switchActiveProfile(original);
    }
  }
  return { profileId: profile.id, created: true };
}

// ---- Seed body ----------------------------------------------------------

function seedAll(): void {
  seedAccounts();
  seedRecurring();
  seedGoalsAndDebts();
  seedBudgets();
  seedTransactions();
}

function seedAccounts(): void {
  const db = getDB();
  db.insert(accounts).values([
    { id: 'demo-checking', name: 'Main Checking', type: 'bank',    balance: 4820.45, icon: 'Banknote',   color: '#818CF8', sortOrder: 1, currency: 'USD', includeInTotal: 1 },
    { id: 'demo-savings',  name: 'Savings',       type: 'savings', balance: 12500.0, icon: 'PiggyBank',  color: '#FFBE44', sortOrder: 2, currency: 'USD', includeInTotal: 1 },
    { id: 'demo-cc',       name: 'Credit Card',   type: 'credit',  balance: -642.30, creditLimit: 5000, icon: 'CreditCard', color: '#FF6B8A', sortOrder: 3, currency: 'USD', includeInTotal: 1 },
    { id: 'demo-cash',     name: 'Cash',          type: 'cash',    balance: 180.0,   icon: 'Wallet',     color: '#00E09E', sortOrder: 4, currency: 'USD', includeInTotal: 1 },
    { id: 'demo-mortgage', name: 'Mortgage',      type: 'loan',    balance: -184500, icon: 'Home',       color: '#F97316', sortOrder: 5, currency: 'USD', includeInTotal: 1 },
    { id: 'demo-carloan',  name: 'Car Loan',      type: 'loan',    balance: -8240.0, icon: 'Car',        color: '#EAB308', sortOrder: 6, currency: 'USD', includeInTotal: 1 },
  ]);
}

function seedRecurring(): void {
  const db = getDB();
  db.insert(recurring).values([
    { id: 'demo-r-rent',    name: 'Mortgage Payment', amount: 1650,  type: 'expense', category: 'rent',          accountId: 'demo-checking', dayOfMonth: 1,  icon: 'Home',       color: '#FB923C' },
    { id: 'demo-r-elec',    name: 'Electric',         amount: 92.5,  type: 'expense', category: 'utilities',     accountId: 'demo-checking', dayOfMonth: 5,  icon: 'Zap',        color: '#EAB308' },
    { id: 'demo-r-water',   name: 'Water',            amount: 38,    type: 'expense', category: 'utilities',     accountId: 'demo-checking', dayOfMonth: 6,  icon: 'Droplet',    color: '#38BDF8' },
    { id: 'demo-r-int',     name: 'Internet',         amount: 65,    type: 'expense', category: 'internet',      accountId: 'demo-checking', dayOfMonth: 7,  icon: 'Wifi',       color: '#38BDF8' },
    { id: 'demo-r-phone',   name: 'Phone Plan',       amount: 42,    type: 'expense', category: 'phone',         accountId: 'demo-checking', dayOfMonth: 12, icon: 'Smartphone', color: '#A78BFA' },
    { id: 'demo-r-netflix', name: 'Netflix',          amount: 15.49, type: 'expense', category: 'subs',          accountId: 'demo-cc',       dayOfMonth: 10, icon: 'Star',       color: '#E50914' },
    { id: 'demo-r-spotify', name: 'Spotify',          amount: 11.99, type: 'expense', category: 'subs',          accountId: 'demo-cc',       dayOfMonth: 14, icon: 'Star',       color: '#1DB954' },
    { id: 'demo-r-gym',     name: 'Gym',              amount: 39.99, type: 'expense', category: 'fitness',       accountId: 'demo-checking', dayOfMonth: 18, icon: 'Activity',   color: '#4ADE80' },
    { id: 'demo-r-ins',     name: 'Auto Insurance',   amount: 125,   type: 'expense', category: 'insurance',     accountId: 'demo-checking', dayOfMonth: 25, icon: 'Shield',     color: '#A3A3A3' },
    { id: 'demo-r-carloan', name: 'Car Loan Payment', amount: 320,   type: 'expense', category: 'loan_payment',  accountId: 'demo-checking', dayOfMonth: 20, icon: 'Car',        color: '#EAB308' },
    { id: 'demo-r-salary',  name: 'Salary',           amount: 5200,  type: 'income',  category: 'salary',        accountId: 'demo-checking', dayOfMonth: 1,  icon: 'Briefcase',  color: '#00E09E' },
    { id: 'demo-r-side',    name: 'Freelance',        amount: 700,   type: 'income',  category: 'freelance',     accountId: 'demo-checking', dayOfMonth: 15, icon: 'TrendingUp', color: '#818CF8' },
  ]);
}

function seedGoalsAndDebts(): void {
  const db = getDB();
  const now = Date.now();
  const DAY = 86_400_000;
  db.insert(goals).values([
    { id: 'demo-g-emergency', name: 'Emergency Fund',  targetAmount: 10000, targetDate: now + 180 * DAY, accountId: 'demo-savings', icon: 'shield-outline',   color: '#10B981', createdAt: now - 540 * DAY },
    { id: 'demo-g-vacation',  name: 'Vacation',         targetAmount: 3000,  targetDate: now + 120 * DAY, accountId: 'demo-savings', icon: 'beach',            color: '#F97316', createdAt: now - 200 * DAY },
    { id: 'demo-g-downpay',   name: 'House Down Payment', targetAmount: 50000, targetDate: now + 720 * DAY, accountId: 'demo-savings', icon: 'home-outline',   color: '#A78BFA', createdAt: now - 90 * DAY },
  ]);
  db.insert(debts).values([
    { id: 'demo-d-cc',   name: 'Credit Card', balance: 642.30, apr: 22.99, minPayment: 35, accountId: 'demo-cc',      currency: 'USD', icon: 'credit-card-outline', color: '#FF6B8A', createdAt: now - 600 * DAY },
    { id: 'demo-d-car',  name: 'Car Loan',    balance: 8240,   apr: 6.5,   minPayment: 320, accountId: 'demo-carloan', currency: 'USD', icon: 'car-outline',         color: '#EAB308', createdAt: now - 400 * DAY },
  ]);
}

function seedBudgets(): void {
  // Custom categories table owns the monthly_budget column (Phase 10w).
  // Insert stub rows for the categories we want budgeted; if a row
  // already exists for the category id we update the budget column.
  const raw = getRawDB();
  const rows: { catId: string; name: string; icon: string; color: string; limit: number }[] = [
    { catId: 'food',          name: 'Food',          icon: 'food',          color: '#F97316', limit: 450 },
    { catId: 'transport',     name: 'Transport',     icon: 'car',           color: '#38BDF8', limit: 180 },
    { catId: 'shopping',      name: 'Shopping',      icon: 'shopping',      color: '#A78BFA', limit: 250 },
    { catId: 'entertainment', name: 'Entertainment', icon: 'movie-outline', color: '#FB923C', limit: 120 },
    { catId: 'coffee',        name: 'Coffee',        icon: 'coffee',        color: '#7C3AED', limit: 80 },
    { catId: 'health',        name: 'Health',        icon: 'heart-outline', color: '#10B981', limit: 150 },
  ];
  for (const r of rows) {
    raw.runSync(
      `INSERT OR IGNORE INTO custom_categories
         (id, name, icon, color, type, created_at, monthly_budget, budget_currency, sort_order, is_pinned, archived, rollover_enabled)
       VALUES (?, ?, ?, ?, 'expense', ?, ?, 'USD', 0, 0, 0, 0)`,
      [r.catId, r.name, r.icon, r.color, Date.now(), r.limit],
    );
    raw.runSync(
      `UPDATE custom_categories
         SET monthly_budget = ?, budget_currency = 'USD'
       WHERE id = ?`,
      [r.limit, r.catId],
    );
  }
}

// ---- Transaction generator ---------------------------------------------

interface TxnTemplate {
  category: string;
  accountId: string;
  amount: () => number;
  note?: string;
  /** Per-month frequency: 0..N. */
  perMonth: number;
}

const NOTES_FOOD = ['Groceries', 'Lunch', 'Dinner out', 'Takeout', 'Brunch'];
const NOTES_COFFEE = ['Coffee', 'Latte', 'Espresso', 'Cappuccino'];
const NOTES_TRANSPORT = ['Gas', 'Uber', 'Bus pass', 'Parking', 'Toll'];
const NOTES_SHOPPING = ['Amazon', 'Target', 'Walmart', 'Best Buy', 'Apple'];
const NOTES_ENT = ['Movies', 'Concert', 'Steam', 'Apple TV+', 'Books'];
const NOTES_HEALTH = ['Pharmacy', 'Dental', 'Vitamins', 'Co-pay'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }

function seedTransactions(): void {
  const db = getDB();
  const now = new Date();
  const MONTHS_BACK = 24;
  const toInsert: (typeof transactions.$inferInsert)[] = [];

  const templates: TxnTemplate[] = [
    { category: 'food',          accountId: 'demo-checking', amount: () => rand(45, 95),  perMonth: 4, note: 'Groceries' },
    { category: 'food',          accountId: 'demo-cc',       amount: () => rand(9, 28),   perMonth: 8 },
    { category: 'coffee',        accountId: 'demo-cc',       amount: () => rand(3.5, 7),  perMonth: 18 },
    { category: 'transport',     accountId: 'demo-checking', amount: () => rand(28, 55),  perMonth: 4, note: 'Gas' },
    { category: 'transport',     accountId: 'demo-cc',       amount: () => rand(8, 22),   perMonth: 4 },
    { category: 'shopping',      accountId: 'demo-cc',       amount: () => rand(18, 220), perMonth: 3 },
    { category: 'entertainment', accountId: 'demo-cc',       amount: () => rand(12, 80),  perMonth: 2 },
    { category: 'health',        accountId: 'demo-checking', amount: () => rand(15, 90),  perMonth: 1 },
    { category: 'fuel',          accountId: 'demo-cash',     amount: () => rand(5, 18),   perMonth: 6 },
  ];

  for (let m = MONTHS_BACK; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    // For the current month, only emit up to today so future-dated
    // tx don't pollute "today's spend" totals.
    const cap = m === 0 ? now.getDate() : daysInMonth;

    for (const tpl of templates) {
      const n = Math.max(0, Math.round(tpl.perMonth * (cap / daysInMonth) + (Math.random() - 0.5) * 2));
      for (let i = 0; i < n; i++) {
        const day = 1 + Math.floor(Math.random() * cap);
        const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day,
          8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
        const noteSrc =
          tpl.category === 'food' ? NOTES_FOOD
          : tpl.category === 'coffee' ? NOTES_COFFEE
          : tpl.category === 'transport' ? NOTES_TRANSPORT
          : tpl.category === 'shopping' ? NOTES_SHOPPING
          : tpl.category === 'entertainment' ? NOTES_ENT
          : tpl.category === 'health' ? NOTES_HEALTH
          : ['Misc'];
        toInsert.push({
          id: `demo-tx-${m}-${tpl.category}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'expense',
          amount: tpl.amount(),
          category: tpl.category,
          accountId: tpl.accountId,
          date: d.getTime(),
          createdAt: Date.now(),
          note: tpl.note ?? pick(noteSrc),
        });
      }
    }

    // Recurring expenses (mortgage, utilities, subs, etc) — emit as
    // real transactions for past months so the history isn't lopsided.
    // Skip for the current month so the user can interact with the
    // unpaid checkboxes today.
    if (m > 0) {
      const recItems: { id: string; cat: string; acct: string; amt: number; day: number; note: string }[] = [
        { id: 'mortgage', cat: 'rent',         acct: 'demo-checking', amt: 1650,  day: 1,  note: 'Mortgage Payment' },
        { id: 'elec',     cat: 'utilities',    acct: 'demo-checking', amt: 92.5,  day: 5,  note: 'Electric' },
        { id: 'water',    cat: 'utilities',    acct: 'demo-checking', amt: 38,    day: 6,  note: 'Water' },
        { id: 'int',      cat: 'internet',     acct: 'demo-checking', amt: 65,    day: 7,  note: 'Internet' },
        { id: 'phone',    cat: 'phone',        acct: 'demo-checking', amt: 42,    day: 12, note: 'Phone Plan' },
        { id: 'netflix',  cat: 'subs',         acct: 'demo-cc',       amt: 15.49, day: 10, note: 'Netflix' },
        { id: 'spotify',  cat: 'subs',         acct: 'demo-cc',       amt: 11.99, day: 14, note: 'Spotify' },
        { id: 'gym',      cat: 'fitness',      acct: 'demo-checking', amt: 39.99, day: 18, note: 'Gym' },
        { id: 'ins',      cat: 'insurance',    acct: 'demo-checking', amt: 125,   day: 25, note: 'Auto Insurance' },
        { id: 'carloan',  cat: 'loan_payment', acct: 'demo-checking', amt: 320,   day: 20, note: 'Car Loan Payment' },
      ];
      for (const r of recItems) {
        const day = Math.min(r.day, daysInMonth);
        const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 9, 0);
        toInsert.push({
          id: `demo-rectx-${m}-${r.id}`,
          type: 'expense',
          amount: r.amt,
          category: r.cat,
          accountId: r.acct,
          date: d.getTime(),
          createdAt: Date.now(),
          note: r.note,
        });
      }
    }

    // Income — salary on the 1st, freelance on the 15th.
    if (m > 0 || now.getDate() >= 1) {
      const salaryDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1, 9, 0);
      toInsert.push({
        id: `demo-inc-salary-${m}`,
        type: 'income',
        amount: 5200,
        category: 'salary',
        accountId: 'demo-checking',
        date: salaryDay.getTime(),
        createdAt: Date.now(),
        note: 'Salary',
      });
    }
    if (m > 0 || now.getDate() >= 15) {
      const sideDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(15, cap), 13, 0);
      if (sideDay.getTime() <= now.getTime()) {
        toInsert.push({
          id: `demo-inc-side-${m}`,
          type: 'income',
          amount: 700 + Math.random() * 200,
          category: 'freelance',
          accountId: 'demo-checking',
          date: sideDay.getTime(),
          createdAt: Date.now(),
          note: 'Freelance',
        });
      }
    }

    // Monthly transfer to Savings on the 2nd.
    if (m > 0) {
      const xfer = new Date(monthStart.getFullYear(), monthStart.getMonth(), 2, 10, 0);
      toInsert.push({
        id: `demo-xfer-${m}`,
        type: 'transfer',
        amount: 300,
        accountId: 'demo-checking',
        toAccountId: 'demo-savings',
        date: xfer.getTime(),
        createdAt: Date.now(),
        note: 'Monthly savings',
      });
    }
  }

  // Single CC → Checking payoff transfer each month (paying down the
  // statement). Skip current month so the CC balance reflects "you owe X".
  for (let m = MONTHS_BACK; m >= 1; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), 27, 11, 0);
    toInsert.push({
      id: `demo-ccpay-${m}`,
      type: 'transfer',
      amount: 350 + Math.random() * 200,
      accountId: 'demo-checking',
      toAccountId: 'demo-cc',
      date: d.getTime(),
      createdAt: Date.now(),
      note: 'CC payment',
    });
  }

  // Insert in chunks so we don't blow past the SQL parameter limit.
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    db.insert(transactions).values(toInsert.slice(i, i + CHUNK)).run();
  }

  // Mark every past month's recurring as paid by linking the rec txn
  // we just inserted, so the "Plan" view shows them as already settled
  // when the user browses back. Current month stays unpaid.
  const recIds = ['mortgage','elec','water','int','phone','netflix','spotify','gym','ins','carloan'];
  const recToId: Record<string, string> = {
    mortgage:'demo-r-rent', elec:'demo-r-elec', water:'demo-r-water', int:'demo-r-int',
    phone:'demo-r-phone', netflix:'demo-r-netflix', spotify:'demo-r-spotify',
    gym:'demo-r-gym', ins:'demo-r-ins', carloan:'demo-r-carloan',
  };
  for (let m = MONTHS_BACK; m >= 1; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    for (const r of recIds) {
      db.insert(paidItems).values({
        id: `${recToId[r]}_${key}`,
        recurringId: recToId[r],
        monthKey: key,
        transactionId: `demo-rectx-${m}-${r}`,
        paidAt: Date.now(),
      }).onConflictDoNothing().run();
    }
  }
}
