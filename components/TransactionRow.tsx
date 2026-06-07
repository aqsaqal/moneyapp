// TransactionRow — ports v4 TxRow (lines 276-310) with long-press action sheet.

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from './Icon';
import { theme, radii, font, sizes } from '@/constants/theme';
import { catInfo } from '@/constants/categories';
import { FeatureSlots } from '@/features';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { deleteTransaction } from '@/hooks/useAppData';
import { dayStr } from '@/utils/format';
import { t as i18nT } from '@/utils/i18n';
import type { Transaction } from '@/utils/db/schema';

export interface TransactionRowProps {
  t: Transaction;
  currency?: CurrencyCode;
  onPressMore?: () => void;
  /** Optional inline tag — used for "scheduled" on future-dated rows
   *  in the Upcoming section. Renders as a small colored pill next to
   *  the name. */
  tag?: { text: string; color: string };
  /** Account context for the row. Caller resolves account ids → names
   *  (cheap once per render) so this component doesn't have to fan out
   *  N SQLite queries from N rows. For transfers, format the label as
   *  "From → To". */
  accountLabel?: string;
  /** Per-side currency, only used by cross-currency transfer rows to
   *  render "100 USD" main + "50,000 KZT" sub. Same lookup-once policy
   *  as accountLabel — caller passes them so the row doesn't query. */
  fromCurrency?: CurrencyCode;
  toCurrency?: CurrencyCode;
  /** Small account icon shown next to accountLabel — caller passes the
   *  account's stored MCI name + brand color. For transfers this is
   *  the FROM-side account (the debit, the "where the money came from"). */
  accountIcon?: string;
  accountColor?: string;
}

export function TransactionRow({ t, currency = 'USD', onPressMore, tag, accountLabel, fromCurrency, toCurrency, accountIcon, accountColor }: TransactionRowProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Title = category (or "Transfer"); subtitle = user-typed note when set.
  // Previous behavior collapsed both into one line, which made it
  // impossible to tell what a "Coffee" entry actually was categorized as.
  let icon = 'MoreHorizontal';
  let color: string = theme.text2;
  let name = '';
  let sign = '';
  let amountColor: string = theme.text1;

  if (t.type === 'transfer') {
    icon = 'ArrowRightLeft';
    color = theme.transfer;
    name = 'Transfer';
    amountColor = theme.transfer;
  } else if (t.type === 'income') {
    const cat = catInfo(t.category, 'income');
    icon = cat.icon;
    color = cat.color;
    name = cat.name;
    sign = '+';
    amountColor = theme.accent;
  } else {
    const cat = catInfo(t.category);
    icon = cat.icon;
    color = cat.color;
    name = cat.name;
    sign = '-';
    amountColor = theme.text1;
  }
  const note = t.note?.trim() || null;

  const confirmDelete = () => {
    Alert.alert(
      i18nT('tx.deleteConfirm.title'),
      i18nT('tx.deleteConfirm.body', { undone: i18nT('common.cannotBeUndone') }),
      [
        { text: i18nT('common.cancel'), style: 'cancel' },
        {
          text: i18nT('common.delete'),
          style: 'destructive',
          onPress: () => deleteTransaction(t.id),
        },
      ],
    );
  };

  const renderRightActions = () => (
    <Pressable
      style={styles.swipeAction}
      onPress={confirmDelete}
      accessibilityRole="button"
      accessibilityLabel={i18nT('common.delete')}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {tag && (
                <Text style={[styles.tag, { color: tag.color, borderColor: `${tag.color}55` }]}>
                  {tag.text}
                </Text>
              )}
            </View>
            {accountLabel && (
              <View style={styles.accountRow}>
                {accountIcon && (
                  <Icon
                    name={accountIcon}
                    size={12}
                    color={accountColor ?? theme.text3}
                  />
                )}
                <Text style={styles.account} numberOfLines={1}>{accountLabel}</Text>
              </View>
            )}
            {note && (
              <Text style={styles.note} numberOfLines={1}>{note}</Text>
            )}
            {/* Halal badge — islamic only. The require() and the file
                it loads both live behind APP_FLAVOR so the badge's
                literal status names ('halal'/'haram'/'mushbooh') are
                physically absent from the generic bundle. */}
            {process.env.APP_FLAVOR === 'islamic' && t.halalStatus && t.halalStatus !== 'unspecified' && (() => {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { HalalBadge } = require('@/features/islamic/halal/HalalBadge');
              return <HalalBadge status={t.halalStatus} />;
            })()}
          </View>
          <View style={styles.amountStack}>
            {/* Four display modes:
                  1. Triple-currency TRANSFER: entry currency differs
                     from both account currencies. Large = entered
                     amount in entry currency; sub = debit · credit on
                     one line with a raised middle dot.
                  2. Cross-currency TRANSFER: entry currency matches
                     one of the account currencies. Large = From-side
                     debit, sub = To-side credit.
                  3. Mixed-currency expense/income (originalCurrency set
                     and ≠ display): original entry LARGE, account-side
                     withdrawal SMALL beneath.
                  4. Otherwise: single amount in display currency. */}
            {(() => {
              const isCrossXfer =
                t.type === 'transfer' &&
                t.toAmount != null &&
                fromCurrency && toCurrency &&
                fromCurrency !== toCurrency;
              const tripleXfer =
                isCrossXfer &&
                t.originalAmount != null &&
                t.originalCurrency &&
                t.originalCurrency !== fromCurrency &&
                t.originalCurrency !== toCurrency;
              if (tripleXfer) {
                return (
                  <>
                    <Text style={[styles.amount, { color: amountColor }]}>
                      {sign}
                      {formatMoney(t.originalAmount!, t.originalCurrency as CurrencyCode)}
                    </Text>
                    <Text style={styles.amountSub}>
                      {formatMoney(t.amount, fromCurrency!)} · {formatMoney(t.toAmount!, toCurrency!)}
                    </Text>
                  </>
                );
              }
              if (isCrossXfer) {
                return (
                  <>
                    <Text style={[styles.amount, { color: amountColor }]}>
                      {sign}
                      {formatMoney(t.amount, fromCurrency!)}
                    </Text>
                    <Text style={styles.amountSub}>
                      {formatMoney(t.toAmount!, toCurrency!)}
                    </Text>
                  </>
                );
              }
              if (t.originalAmount != null && t.originalCurrency && t.originalCurrency !== currency) {
                return (
                  <>
                    <Text style={[styles.amount, { color: amountColor }]}>
                      {sign}
                      {formatMoney(t.originalAmount, t.originalCurrency as CurrencyCode)}
                    </Text>
                    <Text style={styles.amountSub}>
                      {formatMoney(t.amount, currency)}
                    </Text>
                  </>
                );
              }
              return (
                <Text style={[styles.amount, { color: amountColor }]}>
                  {sign}
                  {formatMoney(t.amount, currency)}
                </Text>
              );
            })()}
          </View>
        </Pressable>
      </Swipeable>
      {sheetOpen && (
        <View style={styles.sheet}>
          <Pressable style={styles.sheetItem} onPress={() => { setSheetOpen(false); confirmDelete(); }}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
            <Text style={[styles.sheetText, { color: theme.expense }]}>{i18nT('common.delete')}</Text>
          </Pressable>
          <FeatureSlots.TxActionSheetExtras txId={t.id} />
          <Pressable style={styles.sheetItem} onPress={() => setSheetOpen(false)}>
            <MaterialCommunityIcons name="close" size={18} color={theme.text2} />
            <Text style={styles.sheetText}>{i18nT('common.cancel')}</Text>
          </Pressable>
        </View>
      )}
    </>
  );
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
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  account: {
    color: theme.text2,
    fontSize: sizes.xs,
    fontFamily: font.body,
    flexShrink: 1,
  },
  note: {
    color: theme.text3,
    fontSize: sizes.xs,
    fontFamily: font.body,
    marginTop: 2,
  },
  tag: {
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
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
