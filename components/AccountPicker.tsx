// AccountPicker — rich bottom-sheet account selector.
//
// Each row shows: name, type+currency caption, balance (or available
// credit for credit accounts), and a subtle "may go negative" tag when
// the projected transaction would push a cash/bank account below zero.
//
// Archived accounts are never offered. Selected account gets a check
// badge.

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon } from '@/components/Icon';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { convert } from '@/utils/fx';
import { kv } from '@/utils/kv';
import { t as i18nT } from '@/utils/i18n';
import type { Account } from '@/utils/db/schema';

export interface AccountPickerProps {
  visible: boolean;
  /** All eligible accounts. Caller filters archived if desired; we
   *  also drop archived defensively. */
  accounts: Account[];
  /** Currently selected id. Renders the check badge + colored border. */
  value: string;
  /** Optional transaction context — when set, we compute the projected
   *  balance after this debit and surface a "would go negative" tag on
   *  cash / bank accounts. */
  debit?: {
    amount: number;
    /** Amount currency. Converted into each account's currency before
     *  the negative check. */
    currency: CurrencyCode;
  };
  headerText?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function AccountPicker({
  visible,
  accounts,
  value,
  debit,
  headerText,
  onSelect,
  onClose,
}: AccountPickerProps) {
  const defaultCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // Strip archived accounts as a defensive safety net, but keep the
  // currently-selected one even if archived — needed when editing an
  // old entry whose account was archived after creation. Without this
  // clause the user can't see what's set on the row.
  const active = accounts.filter((a) => a.archived !== 1 || a.id === value);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={i18nT('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{headerText ?? i18nT('picker.pickAccount')}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
          {active.map((a) => {
            const ac = (a.currency as CurrencyCode | null) ?? defaultCurrency;
            const isSelected = a.id === value;
            // Credit accounts: display "available credit" (limit - |balance|).
            // Other types: display balance.
            const isCredit = a.type === 'credit';
            const available =
              isCredit && a.creditLimit ? Math.max(a.creditLimit - Math.abs(a.balance), 0) : null;
            // Negative-projection tag (cash/bank only; credit and debt
            // accounts can legitimately carry a negative balance).
            const wouldGoNegative = (() => {
              if (!debit || debit.amount <= 0) return false;
              if (a.type === 'credit' || a.type === 'debt') return false;
              const amtInAcc = debit.currency === ac ? debit.amount : convert(debit.amount, debit.currency, ac);
              return a.balance - amtInAcc < 0;
            })();
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  onSelect(a.id);
                  onClose();
                }}
                style={[
                  styles.row,
                  isSelected && { borderColor: a.color, backgroundColor: `${a.color}11` },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${a.name}, ${a.type}, ${formatMoney(a.balance, ac)}${isSelected ? ', selected' : ''}`}
              >
                <View style={[styles.iconBox, { backgroundColor: `${a.color}22` }]}>
                  <Icon name={a.icon} size={20} color={a.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, a.archived === 1 && { opacity: 0.6 }]}>{a.name}</Text>
                    {a.archived === 1 && (
                      <Text style={styles.archivedTag}>{i18nT('accounts.archived')}</Text>
                    )}
                    {wouldGoNegative && (
                      <Text style={styles.negTag}>may go negative</Text>
                    )}
                  </View>
                  <Text style={styles.caption}>
                    {labelForType(a.type)} · {ac}
                  </Text>
                </View>
                <View style={styles.amtCol}>
                  {isCredit && available !== null ? (
                    <>
                      <Text style={styles.amt}>{formatMoney(available, ac)}</Text>
                      <Text style={styles.amtCaption}>available</Text>
                    </>
                  ) : (
                    <Text style={[styles.amt, a.balance < 0 && { color: theme.expense }]}>
                      {formatMoney(a.balance, ac)}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: a.color }]}>
                    <MaterialCommunityIcons name="check" size={12} color={theme.bg} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function labelForType(t: Account['type']): string {
  return i18nT(`accountType.${t}`);
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: theme.text1, fontSize: sizes.md },
  caption: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  amtCol: { alignItems: 'flex-end' },
  amt: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  amtCaption: { color: theme.text3, fontSize: 10, marginTop: 2 },
  negTag: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B55',
    overflow: 'hidden',
  },
  archivedTag: {
    color: theme.text3,
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
