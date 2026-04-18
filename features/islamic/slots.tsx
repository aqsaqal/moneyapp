// Islamic flavor slot bindings.
//
// This file is imported ONLY from features/index.ts under
// `if (IS_ISLAMIC)`. In generic builds the whole if-branch is dead-code-
// eliminated; the Metro resolver further refuses to resolve paths under
// features/islamic/; the blocklist makes the folder invisible. Even if one of
// those layers were to fail silently, scripts/verify-tree-shake.sh asserts no
// strings from this module appear in the generic bundle.

import React from 'react';
import { Text } from 'react-native';
import type { FeatureSlotSet } from '@/features';
import { CANARY, AMANAH_CANARY, HIJRI_CANARY } from './canary';

// Placeholder components. Phase 4 replaces these with real implementations.
const CanaryBadge: React.FC = () => <Text style={{ color: '#00C9A7', fontSize: 11 }}>{CANARY}</Text>;

export const islamicSlots: FeatureSlotSet = {
  HomeHeaderExtras: CanaryBadge,
  HomeExtras: () => (
    <Text style={{ color: '#D4AF37', fontSize: 10 }}>
      {AMANAH_CANARY} / {HIJRI_CANARY}
    </Text>
  ),
  MoreMenuItems: () => null,
  AddTxExtras: () => null,
  TxActionSheetExtras: () => null,
  HistoryFilterExtras: () => null,
  CategoryExtras: { expense: [], income: [] },
};
