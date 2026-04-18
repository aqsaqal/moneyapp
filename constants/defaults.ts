// Default seed data — ported from v4 lines 76-95.
// Shape matches the Drizzle schema in utils/db/schema.ts.

import type { NewAccount, NewBudget, NewRecurring } from '@/utils/db/schema';

export const DEFAULT_ACCOUNTS: NewAccount[] = [
  { id: 'cash',    name: 'Cash',        type: 'cash',    balance: 500,   icon: 'Wallet',     color: '#00E09E', sortOrder: 0 },
  { id: 'bank',    name: 'Bank',        type: 'bank',    balance: 3200,  icon: 'Banknote',   color: '#818CF8', sortOrder: 1 },
  { id: 'credit',  name: 'Credit Card', type: 'credit',  balance: -450,  creditLimit: 5000, icon: 'CreditCard', color: '#FF6B8A', sortOrder: 2 },
  { id: 'savings', name: 'Savings',     type: 'savings', balance: 8500,  icon: 'PiggyBank',  color: '#FFBE44', sortOrder: 3 },
];

export const DEFAULT_BUDGETS: NewBudget[] = [
  { id: 'b1', category: 'food', limit: 500 },
  { id: 'b2', category: 'transport', limit: 200 },
  { id: 'b3', category: 'shopping', limit: 300 },
  { id: 'b4', category: 'entertainment', limit: 150 },
  { id: 'b5', category: 'coffee', limit: 80 },
];

export const DEFAULT_RECURRING: NewRecurring[] = [
  { id: 'r1', name: 'Netflix', amount: 15.99, type: 'expense', category: 'subs', accountId: 'credit', dayOfMonth: 15, icon: 'Star', color: '#E50914' },
  { id: 'r2', name: 'Claude Pro', amount: 20, type: 'expense', category: 'subs', accountId: 'credit', dayOfMonth: 1, icon: 'Star', color: '#D4A27F' },
  { id: 'r3', name: 'Spotify', amount: 11.99, type: 'expense', category: 'subs', accountId: 'credit', dayOfMonth: 22, icon: 'Star', color: '#1DB954' },
  { id: 'r4', name: 'Rent', amount: 1500, type: 'expense', category: 'rent', accountId: 'bank', dayOfMonth: 1, icon: 'Home', color: '#FB923C' },
  { id: 'r5', name: 'Internet', amount: 65, type: 'expense', category: 'internet', accountId: 'bank', dayOfMonth: 5, icon: 'Wifi', color: '#38BDF8' },
  { id: 'r6', name: 'Phone Plan', amount: 45, type: 'expense', category: 'phone', accountId: 'bank', dayOfMonth: 12, icon: 'Smartphone', color: '#A78BFA' },
  { id: 'r7', name: 'Gym', amount: 39.99, type: 'expense', category: 'fitness', accountId: 'bank', dayOfMonth: 1, icon: 'Activity', color: '#4ADE80' },
  { id: 'r8', name: 'Monthly Salary', amount: 3500, type: 'income', category: 'salary', accountId: 'bank', dayOfMonth: 1, icon: 'Briefcase', color: '#00E09E' },
  { id: 'r9', name: 'Rental Income', amount: 800, type: 'income', category: 'investment', accountId: 'bank', dayOfMonth: 5, icon: 'TrendingUp', color: '#818CF8' },
];
