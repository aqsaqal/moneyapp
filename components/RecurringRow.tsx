// RecurringRow — v4 RecRow (lines 312-324). Pay/unpay toggle + edit/delete actions.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { theme, radii, font, sizes } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import type { Recurring } from '@/utils/db/schema';

export interface RecurringRowProps {
  rec: Recurring;
  paid: boolean;
  onTogglePaid: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  currency?: CurrencyCode;
}

export function RecurringRow({ rec, paid, onTogglePaid, onEdit, onDelete, currency = 'USD' }: RecurringRowProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onTogglePaid} style={styles.check} accessibilityRole="button">
        <MaterialCommunityIcons
          name={paid ? 'check-circle' : 'circle-outline'}
          size={24}
          color={paid ? theme.accent : theme.text3}
        />
      </Pressable>
      <View style={[styles.iconBox, { backgroundColor: `${rec.color}22` }]}>
        <Icon name={rec.icon} size={16} color={rec.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, paid && { textDecorationLine: 'line-through', color: theme.text3 }]} numberOfLines={1}>
          {rec.name}
        </Text>
        <Text style={styles.sub}>Day {rec.dayOfMonth}</Text>
      </View>
      <Text style={[styles.amount, { color: rec.type === 'income' ? theme.accent : theme.text1 }]}>
        {formatMoney(rec.amount, currency)}
      </Text>
      {onEdit && (
        <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Edit">
          <MaterialCommunityIcons name="pencil" size={16} color={theme.text3} />
        </Pressable>
      )}
      {onDelete && (
        <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="Delete">
          <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.text3} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: theme.bg2,
    borderRadius: radii.md,
  },
  check: { padding: 2 },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  sub: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  amount: { fontSize: sizes.md, fontFamily: font.display, fontWeight: '700', marginHorizontal: 4 },
});
