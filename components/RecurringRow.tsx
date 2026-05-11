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
  /** When the user toggles the checkbox of an *unpaid* row — open the
   *  Smart Add modal prefilled. The actual paid_items row is only
   *  inserted after the user submits a transaction in Smart Add. */
  onTapCheckbox: () => void;
  /** Unmark a paid row (deletes the linked transaction + paid_items). */
  onUnmark: () => void;
  /** Tap the row body to edit the recurring template. */
  onEdit?: () => void;
  onDelete?: () => void;
  currency?: CurrencyCode;
}

export function RecurringRow({ rec, paid, onTapCheckbox, onUnmark, onEdit, onDelete, currency = 'USD' }: RecurringRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={paid ? onUnmark : onTapCheckbox}
        style={styles.check}
        accessibilityRole="button"
        accessibilityLabel={paid ? `${rec.name}, paid, tap to unmark` : `${rec.name}, tap to log payment`}
      >
        <MaterialCommunityIcons
          name={paid ? 'check-circle' : 'circle-outline'}
          size={24}
          color={paid ? theme.accent : theme.text3}
        />
      </Pressable>
      <Pressable
        style={styles.body}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${rec.name}, ${formatMoney(rec.amount, currency)}, due day ${rec.dayOfMonth}, tap to edit`}
      >
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
      </Pressable>
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
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
