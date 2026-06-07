// RecurringRow — v4 RecRow (lines 312-324). Pay/unpay toggle + edit/delete actions.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { theme, radii, font, sizes } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import type { Recurring } from '@/utils/db/schema';
import { useT } from '@/hooks/useT';

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
  /** Long-press the row body to surface the quick-actions menu (edit,
   *  pause, skip month, delete). The tap-target trash icon was removed
   *  in favour of this — too easy to mis-tap. */
  onLongPress?: () => void;
  /** Unskip — drops the paid_items row silently (no transaction was
   *  ever created for a skip, so no Alert is needed). Fired when the
   *  user taps the minus-circle on a skipped row. */
  onUnskip?: () => void;
  /** True when the user chose "Skip this month" — drawn distinctly from
   *  a real paid row (different checkbox icon, no strike-through) so the
   *  state is unambiguous at a glance. */
  skipped?: boolean;
  currency?: CurrencyCode;
}

export function RecurringRow({ rec, paid, onTapCheckbox, onUnmark, onUnskip, onEdit, onLongPress, skipped, currency = 'USD' }: RecurringRowProps) {
  const t = useT();
  const checkIcon = skipped ? 'minus-circle-outline' : paid ? 'check-circle' : 'circle-outline';
  const checkColor = skipped ? theme.text2 : paid ? theme.accent : theme.text3;
  const subText = t('recurring.dayOfMonth', { n: rec.dayOfMonth }) +
    (skipped ? ` · ${t('recurring.skipped')}` : '');
  return (
    <View style={styles.row}>
      <Pressable
        onPress={skipped ? onUnskip : paid ? onUnmark : onTapCheckbox}
        style={styles.check}
        accessibilityRole="button"
        accessibilityLabel={
          skipped
            ? `${rec.name}, skipped this month, tap to unskip`
            : paid
              ? `${rec.name}, paid, tap to unmark`
              : `${rec.name}, tap to log payment`
        }
      >
        <MaterialCommunityIcons
          name={checkIcon}
          size={24}
          color={checkColor}
        />
      </Pressable>
      <Pressable
        style={styles.body}
        onPress={onEdit}
        onLongPress={onLongPress}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={`${rec.name}, ${formatMoney(rec.amount, currency)}, due day ${rec.dayOfMonth}, tap to edit, long-press for more`}
      >
        <View style={[styles.iconBox, { backgroundColor: `${rec.color}22` }]}>
          <Icon name={rec.icon} size={16} color={rec.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, paid && !skipped && { textDecorationLine: 'line-through', color: theme.text3 }]} numberOfLines={1}>
            {rec.name}
          </Text>
          <Text style={styles.sub}>{subText}</Text>
        </View>
        <Text style={[styles.amount, { color: rec.type === 'income' ? theme.accent : theme.text1 }]}>
          {formatMoney(rec.amount, currency)}
        </Text>
      </Pressable>
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
