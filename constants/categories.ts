// Shared category type + core lists ported verbatim from v4 lines 45-72.
// Islamic categories live in features/islamic/categories/islamicCategories.ts
// and merge in via FeatureSlots.CategoryExtras at runtime (see features/index.ts).

export interface CategoryDef {
  id: string;
  name: string;
  icon: string;      // key into ICON_MAP (see constants/icons.ts)
  color: string;
  isIslamic?: boolean; // set only on Islamic categories; core reads for crescent badge
}

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: 'food', name: 'Food', icon: 'Utensils', color: '#FF6B8A' },
  { id: 'transport', name: 'Transport', icon: 'Car', color: '#818CF8' },
  { id: 'shopping', name: 'Shopping', icon: 'ShoppingCart', color: '#FFBE44' },
  { id: 'coffee', name: 'Coffee', icon: 'Coffee', color: '#C084FC' },
  { id: 'bills', name: 'Bills', icon: 'Zap', color: '#F97316' },
  { id: 'health', name: 'Health', icon: 'Heart', color: '#34D399' },
  { id: 'entertainment', name: 'Fun', icon: 'Star', color: '#FB7185' },
  { id: 'education', name: 'Education', icon: 'BookOpen', color: '#60A5FA' },
  { id: 'travel', name: 'Travel', icon: 'Plane', color: '#2DD4BF' },
  { id: 'gifts', name: 'Gifts', icon: 'Gift', color: '#E879F9' },
  { id: 'fuel', name: 'Fuel', icon: 'Droplet', color: '#FBBF24' },
  { id: 'internet', name: 'Internet', icon: 'Wifi', color: '#38BDF8' },
  { id: 'phone', name: 'Phone', icon: 'Smartphone', color: '#A78BFA' },
  { id: 'rent', name: 'Rent', icon: 'Home', color: '#FB923C' },
  { id: 'clothing', name: 'Clothing', icon: 'Package', color: '#F472B6' },
  { id: 'fitness', name: 'Fitness', icon: 'Activity', color: '#4ADE80' },
  { id: 'subs', name: 'Subs', icon: 'FileText', color: '#38BDF8' },
  { id: 'other', name: 'Other', icon: 'MoreHorizontal', color: '#8888AA' },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#00E09E' },
  { id: 'freelance', name: 'Freelance', icon: 'Edit3', color: '#60A5FA' },
  { id: 'investment', name: 'Investment', icon: 'TrendingUp', color: '#818CF8' },
  { id: 'gift_in', name: 'Gift', icon: 'Gift', color: '#E879F9' },
  { id: 'refund', name: 'Refund', icon: 'ArrowRightLeft', color: '#FFBE44' },
  { id: 'other_in', name: 'Other', icon: 'MoreHorizontal', color: '#8888AA' },
];

// Runtime helpers that merge in Islamic categories when FeatureSlots.CategoryExtras
// is populated. In generic builds, CategoryExtras is {expense:[],income:[]} so the
// helpers return the pure core list.

import { FeatureSlots } from '@/features';

export function allExpenseCategories(): CategoryDef[] {
  return [...EXPENSE_CATEGORIES, ...FeatureSlots.CategoryExtras.expense];
}

export function allIncomeCategories(): CategoryDef[] {
  return [...INCOME_CATEGORIES, ...FeatureSlots.CategoryExtras.income];
}

const FALLBACK: CategoryDef = { id: 'unknown', name: 'Other', icon: 'MoreHorizontal', color: '#8888AA' };

export function catInfo(id: string | null | undefined, type: 'expense' | 'income' = 'expense'): CategoryDef {
  if (!id) return FALLBACK;
  const pool = type === 'income' ? allIncomeCategories() : allExpenseCategories();
  return pool.find((c) => c.id === id) ?? { ...FALLBACK, id, name: id };
}
