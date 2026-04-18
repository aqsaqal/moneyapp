/**
 * FeatureSlots — how core UI hosts flavor-specific extensions.
 *
 * Core screens reference only the generic-safe symbols exported from here.
 * In generic builds:
 *   - IS_ISLAMIC is literal `false` (babel inlined)
 *   - the `if (IS_ISLAMIC)` branch is dead-code-eliminated
 *   - the require('@/features/islamic/slots') call never enters the bundle
 * In islamic builds:
 *   - the branch executes, islamicSlots replaces genericSlots
 *   - all Islamic components/strings flow in transitively
 */

import type React from 'react';
import { IS_ISLAMIC } from '@/constants/flavor';
import type { CategoryDef } from '@/constants/categories';
import type { Transaction } from '@/utils/db/schema';

export const FeatureFlags = {
  zakat: IS_ISLAMIC,
  hijriDates: IS_ISLAMIC,
  halalStatus: IS_ISLAMIC,
  sadaqa: IS_ISLAMIC,
  ramadanMode: IS_ISLAMIC,
  islamicCategories: IS_ISLAMIC,
} as const;

export interface HalalFilterChipProps {
  value: string | null;
  onChange: (v: string | null) => void;
}

export interface AddTxExtrasProps {
  txDraft: Partial<Transaction>;
  onChange: (patch: Partial<Transaction>) => void;
}

export interface TxActionSheetExtrasProps {
  txId: string;
}

export interface MoreMenuItemsProps {
  onNavigate: (path: string) => void;
}

export interface FeatureSlotSet {
  HomeHeaderExtras: React.FC;
  HomeExtras: React.FC;
  MoreMenuItems: React.FC<MoreMenuItemsProps>;
  AddTxExtras: React.FC<AddTxExtrasProps>;
  TxActionSheetExtras: React.FC<TxActionSheetExtrasProps>;
  HistoryFilterExtras: React.FC<HalalFilterChipProps>;
  CategoryExtras: { expense: CategoryDef[]; income: CategoryDef[] };
}

const EmptySlot: React.FC = () => null;

const genericSlots: FeatureSlotSet = {
  HomeHeaderExtras: EmptySlot,
  HomeExtras: EmptySlot,
  MoreMenuItems: EmptySlot,
  AddTxExtras: EmptySlot,
  TxActionSheetExtras: EmptySlot,
  HistoryFilterExtras: EmptySlot,
  CategoryExtras: { expense: [], income: [] },
};

// The load-bearing conditional. Babel turns this into:
//   if (false) { slots = require('@/features/islamic/slots').islamicSlots; }
// Metro's minifier strips the branch. Net result: generic bundle has no reference
// to '@/features/islamic/slots' at all.
let slots: FeatureSlotSet = genericSlots;
if (IS_ISLAMIC) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  slots = require('@/features/islamic/slots').islamicSlots;
}

export const FeatureSlots: FeatureSlotSet = slots;
