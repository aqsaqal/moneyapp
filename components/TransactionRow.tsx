// TransactionRow — ports v4 TxRow (lines 276-310) with long-press action sheet.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { theme, radii, font, sizes } from '@/constants/theme';
import { catInfo } from '@/constants/categories';
import { FeatureSlots } from '@/features';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { deleteTransaction } from '@/hooks/useAppData';
import { dayStr } from '@/utils/format';
import type { Transaction } from '@/utils/db/schema';

export interface TransactionRowProps {
  t: Transaction;
  currency?: CurrencyCode;
  onPressMore?: () => void;
}

export function TransactionRow({ t, currency = 'USD', onPressMore }: TransactionRowProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  let icon = 'MoreHorizontal';
  let color: string = theme.text2;
  let name = t.note ?? '';
  let sign = '';
  let amountColor: string = theme.text1;

  if (t.type === 'transfer') {
    icon = 'ArrowRightLeft';
    color = theme.transfer;
    name = t.note ?? 'Transfer';
    amountColor = theme.transfer;
  } else if (t.type === 'income') {
    const cat = catInfo(t.category, 'income');
    icon = cat.icon;
    color = cat.color;
    name = t.note || cat.name;
    sign = '+';
    amountColor = theme.accent;
  } else {
    const cat = catInfo(t.category);
    icon = cat.icon;
    color = cat.color;
    name = t.note || cat.name;
    sign = '-';
    amountColor = theme.text1;
  }

  const renderRightActions = () => (
    <Pressable
      style={styles.swipeAction}
      onPress={() => deleteTransaction(t.id)}
      accessibilityRole="button"
      accessibilityLabel="Delete"
    >
      <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
    </Pressable>
  );

  // Aggregated screen-reader label: name, sign + amount, day, halal if set.
  const a11yLabel = [
    name,
    t.type === 'transfer'
      ? `transfer ${formatMoney(t.amount, currency)}`
      : `${t.type === 'income' ? 'received' : 'spent'} ${formatMoney(t.amount, currency)}`,
    dayStr(t.date),
    t.halalStatus && t.halalStatus !== 'unspecified' ? `marked ${t.halalStatus}` : '',
  ].filter(Boolean).join(', ');

  return (
    <>
      <Swipeable renderRightActions={renderRightActions}>
        <Pressable
          onLongPress={() => setSheetOpen(true)}
          onPress={onPressMore}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.bg3 }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint="Long press for options. Swipe to delete."
        >
          <View style={[styles.iconBox, { backgroundColor: `${color}22` }]}>
            <Icon name={icon} size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {/* Halal badge only rendered in islamic builds — string literals
                ('halal'/'haram'/'mushbooh') get DCE'd from generic via babel
                process.env inlining. */}
            {process.env.APP_FLAVOR === 'islamic' && t.halalStatus && t.halalStatus !== 'unspecified' && (
              <Text style={[styles.halal, { color: halalColor(t.halalStatus) }]}>
                {t.halalStatus}
              </Text>
            )}
          </View>
          <View style={styles.amountStack}>
            {/* Multi-currency: when the user spent in a different currency
                than the account, show the original amount LARGE and the
                account-currency withdrawal SMALL beneath — matches the
                1money pattern. Same-currency txns just show one number. */}
            {t.originalAmount != null && t.originalCurrency && t.originalCurrency !== currency ? (
              <>
                <Text style={[styles.amount, { color: amountColor }]}>
                  {sign}
                  {formatMoney(t.originalAmount, t.originalCurrency as CurrencyCode)}
                </Text>
                <Text style={styles.amountSub}>
                  {formatMoney(t.amount, currency)}
                </Text>
              </>
            ) : (
              <Text style={[styles.amount, { color: amountColor }]}>
                {sign}
                {formatMoney(t.amount, currency)}
              </Text>
            )}
          </View>
        </Pressable>
      </Swipeable>
      {sheetOpen && (
        <View style={styles.sheet}>
          <Pressable style={styles.sheetItem} onPress={() => { deleteTransaction(t.id); setSheetOpen(false); }}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
            <Text style={[styles.sheetText, { color: theme.expense }]}>Delete</Text>
          </Pressable>
          <FeatureSlots.TxActionSheetExtras txId={t.id} />
          <Pressable style={styles.sheetItem} onPress={() => setSheetOpen(false)}>
            <MaterialCommunityIcons name="close" size={18} color={theme.text2} />
            <Text style={styles.sheetText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

function halalColor(status: string | null | undefined): string {
  switch (status) {
    case 'halal': return theme.accent;
    case 'haram': return theme.expense;
    case 'mushbooh': return theme.warning;
    default: return theme.text2;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.bg1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: theme.text1,
    fontSize: sizes.md,
    fontFamily: font.body,
  },
  halal: {
    fontSize: sizes.xs,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  amount: {
    fontSize: sizes.md,
    fontFamily: font.display,
    fontWeight: '700',
  },
  amountStack: { alignItems: 'flex-end' },
  amountSub: {
    color: theme.text3,
    fontSize: sizes.xs,
    fontFamily: font.body,
    marginTop: 2,
  },
  swipeAction: {
    backgroundColor: theme.expense,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
  },
  sheet: {
    backgroundColor: theme.bg2,
    borderRadius: radii.md,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 6,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  sheetText: {
    color: theme.text1,
    fontSize: sizes.sm,
  },
});
