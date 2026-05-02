// PredictedStrip — single line above the CTA in the v2 Add modal showing
// what category + account the predictor inferred.
//
//   Predicted: 🍴 Food · 💳 Bank   tap to override ▾
//
// Tap toggles an "override" expansion below — the classic v1 cat grid +
// account picker. Caller owns the open/closed state; this component is
// presentation-only.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { catInfo } from '@/constants/categories';
import type { Account } from '@/utils/db/schema';

export interface PredictedStripProps {
  category: string | null;
  accountId: string | null;
  accounts: Account[];
  source?: string | null; // 'l1-keyword' | 'l2-memory' | 'l3-time' | 'l4-default' | null
  expanded: boolean;
  onToggle: () => void;
}

export function PredictedStrip({
  category,
  accountId,
  accounts,
  source,
  expanded,
  onToggle,
}: PredictedStripProps) {
  if (!category && !accountId) return null;

  const cat = category ? catInfo(category) : null;
  const acct = accountId ? accounts.find((a) => a.id === accountId) : null;

  return (
    <Pressable
      onPress={onToggle}
      style={styles.strip}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={
        `Predicted${cat ? ` category ${cat.name}` : ''}${acct ? ` account ${acct.name}` : ''}.` +
        ' Tap to override.'
      }
    >
      <Text style={styles.lead}>Predicted:</Text>
      {cat && (
        <View style={styles.tagRow}>
          <Icon name={cat.icon} size={14} color={cat.color} />
          <Text style={[styles.tagText, { color: cat.color }]}>{cat.name}</Text>
        </View>
      )}
      {cat && acct && <Text style={styles.dot}>·</Text>}
      {acct && (
        <View style={styles.tagRow}>
          <MaterialCommunityIcons
            name="wallet-outline"
            size={14}
            color={acct.color}
          />
          <Text style={[styles.tagText, { color: acct.color }]}>{acct.name}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      <Text style={styles.hint}>tap to override</Text>
      <MaterialCommunityIcons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={theme.text3}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  lead: { color: theme.text3, fontSize: sizes.xs, fontFamily: font.body },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  dot: { color: theme.text3, fontSize: sizes.sm },
  hint: { color: theme.text3, fontSize: sizes.xs, fontStyle: 'italic' },
});
