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

// Icon names are MaterialCommunityIcons keys (not Lucide names). Most
// category render sites pass `c.icon` straight to <MaterialCommunityIcons
// name={…}/>, so the names here must resolve in mcc's icon set or the
// glyph falls back to question marks. Verified against:
// https://pictogrammers.com/library/mdi/
export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: 'food', name: 'Food', icon: 'silverware-fork-knife', color: '#FF6B8A' },
  { id: 'transport', name: 'Transport', icon: 'car', color: '#818CF8' },
  { id: 'shopping', name: 'Shopping', icon: 'cart-outline', color: '#FFBE44' },
  { id: 'coffee', name: 'Coffee', icon: 'coffee', color: '#C084FC' },
  { id: 'bills', name: 'Bills', icon: 'flash', color: '#F97316' },
  { id: 'health', name: 'Health', icon: 'heart-outline', color: '#34D399' },
  { id: 'entertainment', name: 'Fun', icon: 'star', color: '#FB7185' },
  { id: 'education', name: 'Education', icon: 'book-open-variant', color: '#60A5FA' },
  { id: 'travel', name: 'Travel', icon: 'airplane', color: '#2DD4BF' },
  { id: 'gifts', name: 'Gifts', icon: 'gift-outline', color: '#E879F9' },
  { id: 'fuel', name: 'Fuel', icon: 'gas-station', color: '#FBBF24' },
  { id: 'internet', name: 'Internet', icon: 'wifi', color: '#38BDF8' },
  { id: 'phone', name: 'Phone', icon: 'cellphone', color: '#A78BFA' },
  { id: 'rent', name: 'Rent', icon: 'home-variant', color: '#FB923C' },
  { id: 'clothing', name: 'Clothing', icon: 'tshirt-crew-outline', color: '#F472B6' },
  { id: 'fitness', name: 'Fitness', icon: 'run', color: '#4ADE80' },
  { id: 'subs', name: 'Subs', icon: 'file-document-outline', color: '#38BDF8' },
  { id: 'other', name: 'Other', icon: 'dots-horizontal', color: '#8888AA' },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { id: 'salary', name: 'Salary', icon: 'briefcase-outline', color: '#00E09E' },
  { id: 'freelance', name: 'Freelance', icon: 'pencil', color: '#60A5FA' },
  { id: 'investment', name: 'Investment', icon: 'trending-up', color: '#818CF8' },
  { id: 'gift_in', name: 'Gift', icon: 'gift-outline', color: '#E879F9' },
  { id: 'refund', name: 'Refund', icon: 'swap-horizontal', color: '#FFBE44' },
  { id: 'other_in', name: 'Other', icon: 'dots-horizontal', color: '#8888AA' },
];

// Runtime helpers that merge in Islamic categories when FeatureSlots.CategoryExtras
// is populated, plus user-defined custom categories from Phase 10s.
// catInfo() prefers customs when ids overlap with seeded.

import { FeatureSlots } from '@/features';
import { getRawDB } from '@/utils/db/client';
import { t as i18nT, getLocale as i18nGetLocale } from '@/utils/i18n';

// Seeded categories carry English `name` strings in the table above so
// other tooling (search index, exports, OCR matchers) still has stable
// text to work with. The picker / sheets show the translated name via
// this helper. Custom categories don't pass through here — their names
// come from the DB row (single name today; per-locale overrides land
// later via the name_translations column).
export function localizedSeededName(id: string, fallback: string): string {
  // Missing-key fallback in t() returns the key itself, so we test the
  // translation against the key string to decide whether to use the
  // English fallback.
  const key = `cat.${id}`;
  const tr = i18nT(key);
  return tr === key ? fallback : tr;
}

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
    const rows = raw.getAllSync(
      `SELECT id, name, icon, color, type, archived, is_pinned, sort_order,
              name_translations
         FROM custom_categories
        WHERE type = ? OR type = 'both'
        ORDER BY is_pinned DESC, sort_order, created_at`,
      [type],
    ) as Array<CustomRow & { name_translations: string | null }>;
    const activeLocale = i18nGetLocale();
    return rows.map((r) => {
      if (!r.name_translations) return r;
      try {
        const map = JSON.parse(r.name_translations) as Record<string, string>;
        if (typeof map[activeLocale] === 'string') {
          return { ...r, name: map[activeLocale] };
        }
      } catch {
        /* swallow */
      }
      return r;
    });
  } catch {
    return [];
  }
}

// Categories that exist for system reasons but should never appear in a
// manual category picker. (Currently empty after the 'adjustment' →
// 'other' merge in Phase 10y. Kept as a hook for future system rows.)
const HIDDEN_FROM_MANUAL_PICKERS = new Set<string>();

export function allExpenseCategories(): CategoryDef[] {
  // Order: customs first (so they shadow seeded by id) → seeded → islamic.
  const customs = readCustoms('expense');
  const liveCustoms = customs
    .filter((c) => c.archived !== 1 && !HIDDEN_FROM_MANUAL_PICKERS.has(c.id))
    .map<CategoryDef>((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));
  const shadowed = new Set(customs.map((c) => c.id));
  const archivedIds = new Set(customs.filter((c) => c.archived === 1).map((c) => c.id));
  const seededFiltered = EXPENSE_CATEGORIES
    .filter(
      (c) =>
        !shadowed.has(c.id) &&
        !archivedIds.has(c.id) &&
        !HIDDEN_FROM_MANUAL_PICKERS.has(c.id),
    )
    .map<CategoryDef>((c) => ({ ...c, name: localizedSeededName(c.id, c.name) }));
  return [...liveCustoms, ...seededFiltered, ...FeatureSlots.CategoryExtras.expense];
}

export function allIncomeCategories(): CategoryDef[] {
  const customs = readCustoms('income');
  const liveCustoms = customs
    .filter((c) => c.archived !== 1 && !HIDDEN_FROM_MANUAL_PICKERS.has(c.id))
    .map<CategoryDef>((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }));
  const shadowed = new Set(customs.map((c) => c.id));
  const archivedIds = new Set(customs.filter((c) => c.archived === 1).map((c) => c.id));
  const seededFiltered = INCOME_CATEGORIES
    .filter(
      (c) =>
        !shadowed.has(c.id) &&
        !archivedIds.has(c.id) &&
        !HIDDEN_FROM_MANUAL_PICKERS.has(c.id),
    )
    .map<CategoryDef>((c) => ({ ...c, name: localizedSeededName(c.id, c.name) }));
  return [...liveCustoms, ...seededFiltered, ...FeatureSlots.CategoryExtras.income];
}

const FALLBACK: CategoryDef = { id: 'unknown', name: 'Other', icon: 'MoreHorizontal', color: '#8888AA' };

export function catInfo(id: string | null | undefined, type: 'expense' | 'income' = 'expense'): CategoryDef {
  if (!id) return { ...FALLBACK, name: localizedSeededName('other', FALLBACK.name) };
  const pool = type === 'income' ? allIncomeCategories() : allExpenseCategories();
  return pool.find((c) => c.id === id) ?? { ...FALLBACK, id, name: id };
}
