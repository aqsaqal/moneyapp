// Category tile — small square with icon + name + amount + MoM delta.
// Used in HomeView category grid (v4 lines 412-464) and category picker.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { theme, radii, font, sizes } from '@/constants/theme';
import type { CategoryDef } from '@/constants/categories';
import { formatMoneyShort, type CurrencyCode } from '@/constants/currency';

export interface CategoryTileProps {
  cat: CategoryDef;
  amount?: number;
  change?: number | null;
  selected?: boolean;
  onPress?: () => void;
  currency?: CurrencyCode;
}

export function CategoryTile({ cat, amount, change, selected, onPress, currency = 'USD' }: CategoryTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected && { borderColor: theme.accent, borderWidth: 1.5 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: `${cat.color}22` }]}>
        <Icon name={cat.icon} size={18} color={cat.color} />
      </View>
      {cat.isIslamic && <Text style={styles.crescent}>☪</Text>}
      <Text style={styles.name} numberOfLines={1}>{cat.name}</Text>
      {amount !== undefined && (
        <Text style={styles.amount}>{formatMoneyShort(amount, currency)}</Text>
      )}
      {change != null && Number.isFinite(change) && (
        <Text style={[styles.delta, { color: change > 0 ? theme.expense : theme.accent }]}>
          {change > 0 ? '+' : ''}{change.toFixed(0)}%
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.border,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crescent: {
    position: 'absolute',
    top: 6,
    right: 6,
    fontSize: 11,
    color: theme.accent,
  },
  name: {
    color: theme.text1,
    fontSize: sizes.sm,
    fontFamily: font.body,
  },
  amount: {
    color: theme.text1,
    fontSize: sizes.md,
    fontFamily: font.display,
    fontWeight: '700',
  },
  delta: {
    fontSize: sizes.xs,
    fontFamily: font.body,
  },
});
