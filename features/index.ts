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

export interface NavSlotProps {
  onNavigate: (path: string) => void;
}

/** @deprecated v2 collapsed the More tab into Plan + Me. Use NavSlotProps. */
export type MoreMenuItemsProps = NavSlotProps;

export interface FeatureSlotSet {
  // v1 slots (still used)
  HomeHeaderExtras: React.FC;
  HomeExtras: React.FC;
  AddTxExtras: React.FC<AddTxExtrasProps>;
  TxActionSheetExtras: React.FC<TxActionSheetExtrasProps>;
  HistoryFilterExtras: React.FC<HalalFilterChipProps>;
  CategoryExtras: { expense: CategoryDef[]; income: CategoryDef[] };

  // v2 slots
  /** Hijri-first hero row under brand on Home. Replaces HomeHeaderExtras for islamic. */
  HomeHeroExtras: React.FC;
  /** Bottom of Plan tab — Zakat + Sadaqa entries (islamic). */
  PlanTabExtras: React.FC<NavSlotProps>;
  /** Mid-section of Me tab — mazhab + prayer-method rows (islamic). */
  MeTabExtras: React.FC<NavSlotProps>;
  /** Optional row for Activity tab header — currently unused (HistoryFilterExtras
   *  already handles halal filter chip). Reserved for future filter chips. */
  ActivityHeaderExtras: React.FC;

  /**
   * @deprecated v1 More tab is gone in v2. Aliased to PlanTabExtras for back-compat
   * with any caller that imports MoreMenuItems. New code should use PlanTabExtras.
   */
  MoreMenuItems: React.FC<NavSlotProps>;
}

const EmptySlot: React.FC = () => null;
const EmptyNavSlot: React.FC<NavSlotProps> = () => null;

const genericSlots: FeatureSlotSet = {
  HomeHeaderExtras: EmptySlot,
  HomeExtras: EmptySlot,
  AddTxExtras: EmptySlot,
  TxActionSheetExtras: EmptySlot,
  HistoryFilterExtras: EmptySlot,
  CategoryExtras: { expense: [], income: [] },

  HomeHeroExtras: EmptySlot,
  PlanTabExtras: EmptyNavSlot,
  MeTabExtras: EmptyNavSlot,
  ActivityHeaderExtras: EmptySlot,

  MoreMenuItems: EmptyNavSlot, // deprecated alias
};

// The load-bearing conditional. Use INLINE process.env check (not the IS_ISLAMIC
// constant) so Babel's transform-inline-environment-variables can fold the entire
// branch to dead code in generic builds. With the constant indirection, Metro's
// minifier may not perform cross-module folding aggressively enough.
//
// In generic: `process.env.APP_FLAVOR === 'islamic'` becomes `'generic' === 'islamic'`
//             → `false` → terser DCEs the entire if body, removing the require string.
// In islamic: same expression becomes `'islamic' === 'islamic'` → `true` → branch runs.
let slots: FeatureSlotSet = genericSlots;
if (process.env.APP_FLAVOR === 'islamic') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  slots = require('@/features/islamic/slots').islamicSlots;
}

export const FeatureSlots: FeatureSlotSet = slots;
