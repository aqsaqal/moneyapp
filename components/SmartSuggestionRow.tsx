// SmartSuggestionRow — horizontal merchant chips above the numpad.
//
// Phase 10z behavior:
//   • Single row of top-3 exact replays.
//   • Active state: when a chip's category matches the currently
//     selected category, fill with the cat color + show ✓. Tap again
//     to deselect (handled by the caller — we just visualize).
//   • "More…" chip at the end — opens the full CategoryPicker for
//     fresh entries with no prior history.
//   • Layout never shifts: the strip is fixed-height, scrolls
//     horizontally, and chips don't change size on tap.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { theme, font, sizes, radii } from '@/constants/theme';
import { catInfo } from '@/constants/categories';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { useExactReplays, type FrequentTxn, type FuzzyMerchant } from '@/hooks/useFrequentTxns';

export interface SmartSuggestionRowProps {
  currency?: CurrencyCode;
  onPickExact: (txn: FrequentTxn) => void;
  onPickFuzzy: (merchant: FuzzyMerchant) => void;
  /** When the user has already typed an amount, exact replays are less useful;
   *  prefer fuzzy chips. Caller passes the current amount string. */
  amountEntered?: boolean;
  /** Highlights chips whose category id matches. */
  activeCategoryId?: string | null;
  /** Tail "More…" chip — opens the full category grid. */
  onMore?: () => void;
}

export function SmartSuggestionRow({
  currency = 'USD',
  onPickExact,
  onPickFuzzy,
  amountEntered = false,
  activeCategoryId,
  onMore,
}: SmartSuggestionRowProps) {
  const exact = useExactReplays(amountEntered ? 0 : 3);
  void onPickFuzzy;

  // Render the strip even when there are zero exact replays, as long as
  // a More chip is wanted — otherwise users with no history would see
  // nothing here.
  if (exact.length === 0 && !onMore) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {exact.map((t, i) => {
        const cat = catInfo(t.category);
        const label = t.note || cat.name;
        const active = !!activeCategoryId && t.category === activeCategoryId;
        return (
          <Pressable
            key={`e-${i}`}
            onPress={() => onPickExact(t)}
            style={[
              styles.chip,
              { borderColor: cat.color },
              active && { backgroundColor: `${cat.color}26` },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Repeat ${label} for ${formatMoney(t.amount, currency)}${active ? ', selected' : ''}`}
          >
            <Icon name={cat.icon} size={14} color={cat.color} />
            <Text style={[styles.chipText, active && { color: cat.color, fontFamily: font.bodySemi }]}>
              {label} · {formatMoney(t.amount, currency)}
            </Text>
            {active && (
              <MaterialCommunityIcons name="check" size={12} color={cat.color} />
            )}
          </Pressable>
        );
      })}
      {onMore && (
        <Pressable
          onPress={onMore}
          style={[styles.chip, styles.moreChip]}
          accessibilityRole="button"
          accessibilityLabel="More categories"
        >
          <Text style={[styles.chipText, { color: theme.text2 }]}>More…</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    backgroundColor: theme.bg2,
  },
  moreChip: { borderStyle: 'dashed', borderColor: theme.border, borderWidth: 1 },
  chipText: { color: theme.text1, fontSize: sizes.xs, fontFamily: font.body },
});
