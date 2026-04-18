// Islamic slot bindings — replaces the canary placeholder from Phase 1.
// Imported by features/index.ts ONLY when IS_ISLAMIC === true.
//
// In generic builds, every symbol referenced from this file is invisible to
// the bundler (Metro resolver returns {type:'empty'}, Babel folds the import
// site to dead code, and the file is in resolver.blockList).

import React from 'react';
import type { FeatureSlotSet } from '@/features';

import { HijriDateBadge } from './hijri/HijriDateBadge';
import { ZakatHomeCard } from './zakat/ZakatHomeCard';
import { RamadanHomeCard } from './ramadan/RamadanHomeCard';
import { MoreMenuEntries } from './screens/MoreMenuEntries';
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

export const islamicSlots: FeatureSlotSet = {
  HomeHeaderExtras: HijriDateBadge,
  HomeExtras,
  MoreMenuItems: MoreMenuEntries,
  AddTxExtras: HalalInlinePicker,
  TxActionSheetExtras: HalalStatusSheet,
  HistoryFilterExtras: HalalFilterChip,
  CategoryExtras: { expense: ISLAMIC_EXPENSE_CATEGORIES, income: [] },
};
