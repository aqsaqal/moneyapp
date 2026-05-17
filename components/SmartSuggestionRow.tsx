// SmartSuggestionRow — horizontal merchant chips above the numpad.
//
// Phase 10z behavior:
//   • Chips are always visible — they're suggestions, not selections.
//   • Layout never shifts: fixed chip dimensions, horizontal scroll.
//   • Tapping a chip overrides the amount + note + category + account
//     in one go (caller handles the writes via onPickExact).
//
// Visual state — three tiers derived from current amount + last tap:
//   • Neutral (outlined)            — chip's amount doesn't match
//   • Subtle match (bright border)  — chip's amount equals current
//                                     typed amount AND user didn't
//                                     just tap a chip
//   • Active (filled + ✓)           — user tapped this chip AND its
//                                     amount still equals current
//                                     amount. Clears the moment the
//                                     user types a different amount.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { theme, font, sizes, radii } from '@/constants/theme';
import { catInfo } from '@/constants/categories';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { useExactReplays, type FrequentTxn, type FuzzyMerchant } from '@/hooks/useFrequentTxns';

export interface SmartSuggestionRowProps {
  currency?: CurrencyCode;
  /** Current typed amount string from the parent. Drives the
   *  match-highlight + active-state logic. */
  amount: string;
  onPickExact: (txn: FrequentTxn) => void;
  onPickFuzzy: (merchant: FuzzyMerchant) => void;
  /** Tail "More…" chip — opens the full category grid. */
  onMore?: () => void;
}

const AMOUNT_EPSILON = 0.001;

export function SmartSuggestionRow({
  currency = 'USD',
  amount,
  onPickExact,
  onPickFuzzy,
  onMore,
}: SmartSuggestionRowProps) {
  const exact = useExactReplays(3);
  void onPickFuzzy;

  const currentNum = parseFloat(amount) || 0;
  const [tappedIdx, setTappedIdx] = useState<number | null>(null);

  // The tapped state stays only while the amount still matches that
  // chip's value. Once the user types a different amount, the tap
  // anchor clears. This is a single useEffect rather than a derived
  // value so re-renders are consistent.
  useEffect(() => {
    if (tappedIdx == null) return;
    const t = exact[tappedIdx];
    if (!t) { setTappedIdx(null); return; }
    if (Math.abs(t.amount - currentNum) > AMOUNT_EPSILON) setTappedIdx(null);
  }, [exact, tappedIdx, currentNum]);

  // If no tap is currently active, find a chip whose amount happens to
  // match what's been typed — that gets the subtle highlight.
  const matchIdx = tappedIdx != null || currentNum <= 0
    ? -1
    : exact.findIndex((t) => Math.abs(t.amount - currentNum) < AMOUNT_EPSILON);

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
        const isActive = i === tappedIdx;
        const isMatch = i === matchIdx;
        return (
          <Pressable
            key={`e-${i}`}
            onPress={() => {
              setTappedIdx(i);
              onPickExact(t);
            }}
            style={[
              styles.chip,
              // Default outline = soft border in the cat's color.
              { borderColor: isActive ? cat.color : isMatch ? cat.color : `${cat.color}55` },
              isMatch && { borderWidth: 2 },
              isActive && { backgroundColor: `${cat.color}26`, borderWidth: 2 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={
              `${label} ${formatMoney(t.amount, currency)}` +
              (isActive ? ', selected' : isMatch ? ', matches current amount' : '')
            }
          >
            <Icon name={cat.icon} size={14} color={cat.color} />
            <Text style={[styles.chipText, (isActive || isMatch) && { color: cat.color, fontFamily: font.bodySemi }]}>
              {label} · {formatMoney(t.amount, currency)}
            </Text>
            {isActive && (
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
    borderWidth: 1,
    backgroundColor: theme.bg2,
  },
  moreChip: { borderStyle: 'dashed', borderColor: theme.border, borderWidth: 1 },
  chipText: { color: theme.text1, fontSize: sizes.xs, fontFamily: font.body },
});
