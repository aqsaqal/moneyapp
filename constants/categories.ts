// Shared category type + core lists. Islamic categories live in
// features/islamic/categories/islamicCategories.ts and merge in via
// FeatureSlots.CategoryExtras (see features/index.ts).

export interface CategoryDef {
  id: string;
  name: string;
  icon: string; // key into ICON_MAP (see constants/icons.ts)
  color: string;
  isIslamic?: boolean; // set only on Islamic categories; core reads for crescent badge
}

// Minimum stubs — full list filled in Phase 2.
export const EXPENSE_CATEGORIES: CategoryDef[] = [];
export const INCOME_CATEGORIES: CategoryDef[] = [];
