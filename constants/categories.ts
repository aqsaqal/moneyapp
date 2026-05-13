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
  { id: 'adjustment', name: 'Adjustment', icon: 'Scale', color: '#94A3B8' },
  { id: 'other', name: 'Other', icon: 'MoreHorizontal', color: '#8888AA' },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#00E09E' },
  { id: 'freelance', name: 'Freelance', icon: 'Edit3', color: '#60A5FA' },
  { id: 'investment', name: 'Investment', icon: 'TrendingUp', color: '#818CF8' },
  { id: 'gift_in', name: 'Gift', icon: 'Gift', color: '#E879F9' },
  { id: 'refund', name: 'Refund', icon: 'ArrowRightLeft', color: '#FFBE44' },
  { id: 'adjustment', name: 'Adjustment', icon: 'Scale', color: '#94A3B8' },
  { id: 'other_in', name: 'Other', icon: 'MoreHorizontal', color: '#8888AA' },
];

// Runtime helpers that merge in Islamic categories when FeatureSlots.CategoryExtras
// is populated, plus user-defined custom categories from Phase 10s.
// catInfo() prefers customs when ids overlap with seeded.

import { FeatureSlots } from '@/features';
import { getRawDB } from '@/utils/db/client';

interface CustomRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'both';
  archived: number | null;
  is_pinned: number | null;
  sort_order: number | null;
}

function readCustoms(type: 'expense' | 'income'): CustomRow[] {
  try {
    const raw = getRawDB();
    return raw.getAllSync(
      `SELECT id, name, icon, color, type, archived, is_pinned, sort_order
         FROM custom_categories
        WHERE type = ? OR type = 'both'
        ORDER BY is_pinned DESC, sort_order, created_at`,
      [type],
    ) as CustomRow[];
  } catch {
    return [];
  }
}

// Categories that exist for system reasons but should never appear in a
// manual category picker. `adjustment` is reserved for the balance-
// reconciliation flow.
const HIDDEN_FROM_MANUAL_PICKERS = new Set(['adjustment']);

export function allExpenseCategories(): CategoryDef[] {
  // Order: customs first (so they shadow seeded by id) → seeded → islamic.
  const customs = readCustoms('expense');
  const liveCustoms = customs
    .filter((c) => c.archived !== 1 && !HIDDEN_FROM_MANUAL_PICKERS.has(c.id))
    .map<CategoryDef>((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));
  const shadowed = new Set(customs.map((c) => c.id));
  const archivedIds = new Set(customs.filter((c) => c.archived === 1).map((c) => c.id));
  const seededFiltered = EXPENSE_CATEGORIES.filter(
    (c) =>
      !shadowed.has(c.id) &&
      !archivedIds.has(c.id) &&
      !HIDDEN_FROM_MANUAL_PICKERS.has(c.id),
  );
  return [...liveCustoms, ...seededFiltered, ...FeatureSlots.CategoryExtras.expense];
}

export function allIncomeCategories(): CategoryDef[] {
  const customs = readCustoms('income');
  const liveCustoms = customs
    .filter((c) => c.archived !== 1 && !HIDDEN_FROM_MANUAL_PICKERS.has(c.id))
    .map<CategoryDef>((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));
  const shadowed = new Set(customs.map((c) => c.id));
  const archivedIds = new Set(customs.filter((c) => c.archived === 1).map((c) => c.id));
  const seededFiltered = INCOME_CATEGORIES.filter(
    (c) =>
      !shadowed.has(c.id) &&
      !archivedIds.has(c.id) &&
      !HIDDEN_FROM_MANUAL_PICKERS.has(c.id),
  );
  return [...liveCustoms, ...seededFiltered, ...FeatureSlots.CategoryExtras.income];
}

const FALLBACK: CategoryDef = { id: 'unknown', name: 'Other', icon: 'MoreHorizontal', color: '#8888AA' };

export function catInfo(id: string | null | undefined, type: 'expense' | 'income' = 'expense'): CategoryDef {
  if (!id) return FALLBACK;
  const pool = type === 'income' ? allIncomeCategories() : allExpenseCategories();
  return pool.find((c) => c.id === id) ?? { ...FALLBACK, id, name: id };
}
