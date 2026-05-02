// SmartSuggestionRow — top horizontal row of merchant chips above the numpad
// in the v2 Add modal. Two kinds of suggestions, merged:
//
//   Exact replay  (one-tap submit identical txn)
//   Fuzzy merchant (fill note + cat + account, leave amount editable)
//
// Tap behavior:
//   - Exact chip: calls onPickExact(replay) — caller submits immediately.
//   - Fuzzy chip: calls onPickFuzzy(merchant) — caller fills the form,
//     focuses the amount input.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { theme, font, sizes, radii } from '@/constants/theme';
import { catInfo } from '@/constants/categories';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { useExactReplays, useFuzzyMerchants, type FrequentTxn, type FuzzyMerchant } from '@/hooks/useFrequentTxns';

export interface SmartSuggestionRowProps {
  currency?: CurrencyCode;
  onPickExact: (txn: FrequentTxn) => void;
  onPickFuzzy: (merchant: FuzzyMerchant) => void;
  /** When the user has already typed an amount, exact replays are less useful;
   *  prefer fuzzy chips. Caller passes the current amount string. */
  amountEntered?: boolean;
}

export function SmartSuggestionRow({
  currency = 'USD',
  onPickExact,
  onPickFuzzy,
  amountEntered = false,
}: SmartSuggestionRowProps) {
  const exact = useExactReplays(amountEntered ? 0 : 4);
  const fuzzy = useFuzzyMerchants(4);

  if (exact.length === 0 && fuzzy.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {exact.map((t, i) => {
        const cat = catInfo(t.category);
        const label = t.note || cat.name;
        return (
          <Pressable
            key={`e-${i}`}
            onPress={() => onPickExact(t)}
            style={[styles.chip, styles.exactChip, { borderColor: cat.color }]}
            accessibilityRole="button"
            accessibilityLabel={`Repeat ${label} for ${formatMoney(t.amount, currency)}`}
          >
            <Icon name={cat.icon} size={14} color={cat.color} />
            <Text style={styles.chipText}>
              {label} · {formatMoney(t.amount, currency)}
            </Text>
          </Pressable>
        );
      })}
      {fuzzy.map((m, i) => {
        const cat = catInfo(m.category);
        return (
          <Pressable
            key={`f-${i}`}
            onPress={() => onPickFuzzy(m)}
            style={[styles.chip, { borderColor: theme.border }]}
            accessibilityRole="button"
            accessibilityLabel={`Fill in ${m.note}, category ${cat.name}`}
          >
            <Icon name={cat.icon} size={14} color={cat.color} />
            <Text style={styles.chipText}>{m.note}</Text>
          </Pressable>
        );
      })}
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
  exactChip: {
    // Exact replays have a tinted border so they read as "1-tap submit"
    borderWidth: 1.5,
  },
  chipText: { color: theme.text1, fontSize: sizes.xs, fontFamily: font.body },
});
