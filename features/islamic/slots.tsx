// Islamic slot bindings.
// Imported by features/index.ts ONLY when IS_ISLAMIC === true.
//
// In generic builds, every symbol referenced from this file is invisible to
// the bundler (Metro resolver returns {type:'empty'}, Babel folds the import
// site to dead code, and the file is in resolver.blockList).
//
// v2 IA mapping:
//   HomeHeaderExtras → HijriDateBadge          (kept; Phase 6 may replace with HomeHeroExtras)
//   HomeExtras       → ZakatHomeCard + RamadanHomeCard
//   AddTxExtras      → HalalInlinePicker
//   TxActionSheetExtras → HalalStatusSheet
//   HistoryFilterExtras → HalalFilterChip
//   CategoryExtras   → ISLAMIC_EXPENSE_CATEGORIES
//   PlanTabExtras    → MoreMenuEntries (Zakat + Sadaqa nav rows; was MoreMenuItems in v1)
//   MoreMenuItems    → MoreMenuEntries (deprecated alias for back-compat)
//   MeTabExtras      → empty for Phase 5; Phase 8 wires mazhab + prayer-method rows
//   HomeHeroExtras   → empty for Phase 5; Phase 6 wires HijriGregorianHero
//   ActivityHeaderExtras → empty (reserved)

import React from 'react';
import type { FeatureSlotSet } from '@/features';

import { HijriDateBadge } from './hijri/HijriDateBadge';
import { HijriGregorianHero } from './hijri/HijriGregorianHero';
import { ZakatHomeCard } from './zakat/ZakatHomeCard';
import { RamadanHomeCard } from './ramadan/RamadanHomeCard';
import { MoreMenuEntries } from './screens/MoreMenuEntries';
import { MeTabExtras as MeTabExtrasComponent } from './screens/MeTabExtras';
import { HalalStatusSheet } from './halal/HalalStatusSheet';
import { HalalInlinePicker } from './halal/HalalInlinePicker';
import { HalalFilterChip } from './halal/HalalFilterChip';
import { ISLAMIC_EXPENSE_CATEGORIES } from './categories/islamicCategories';

const HomeExtras: React.FC = () => (
  <>
    <ZakatHomeCard />
    <RamadanHomeCard />
  </>
);

const EmptySlot: React.FC = () => null;
const EmptyNavSlot: React.FC<{ onNavigate: (path: string) => void }> = () => null;

export const islamicSlots: FeatureSlotSet = {
  // v1 slots
  HomeHeaderExtras: HijriDateBadge,
  HomeExtras,
  AddTxExtras: HalalInlinePicker,
  TxActionSheetExtras: HalalStatusSheet,
  HistoryFilterExtras: HalalFilterChip,
  CategoryExtras: { expense: ISLAMIC_EXPENSE_CATEGORIES, income: [] },

  // v2 slots — wired
  PlanTabExtras: MoreMenuEntries, // Zakat + Sadaqa nav rows live on Plan tab in v2

  // v2 slots — Phase 6 wires HomeHeroExtras, Phase 8 wires MeTabExtras
  HomeHeroExtras: HijriGregorianHero,
  MeTabExtras: MeTabExtrasComponent,
  ActivityHeaderExtras: EmptySlot,  // reserved

  // Deprecated alias for back-compat with any external caller still importing
  // FeatureSlots.MoreMenuItems. Same component as PlanTabExtras.
  MoreMenuItems: MoreMenuEntries,
};
