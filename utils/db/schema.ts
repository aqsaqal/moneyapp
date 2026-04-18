// Drizzle ORM schema. Full tables authored in Phase 2 — this file declares
// only the TypeScript types that other modules import during Phase 1 scaffolding.

export interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category?: string | null;
  accountId: string;
  toAccountId?: string | null;
  note?: string | null;
  date: number; // unix ms
  createdAt: number;
  // Optional — islamic flavor sets this via HalalStatusSheet. Generic never reads or writes it.
  halalStatus?: 'halal' | 'haram' | 'mushbooh' | 'unspecified' | null;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'savings';
  balance: number;
  creditLimit?: number | null;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
}

export interface Recurring {
  id: string;
  type: 'expense' | 'income';
  name: string;
  amount: number;
  category?: string | null;
  accountId: string;
  dayOfMonth: number;
}
