// Me — identity tab. Owns Profiles + Accounts only.
//
// v2 Phase 10g: settings/preferences/security/data/about + islamic mazhab+
// method rows moved to a dedicated /settings modal screen, reachable via
// the cog button in every tab's header. Me is now a 2-section identity
// view: switch profiles, manage accounts.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import {
  SectionHeader,
  SummaryCard,
  sectionStyles,
} from '@/components/Sections';
import { AccountSheet } from '@/components/AccountSheet';
import { ProfileSheet } from '@/components/ProfileSheet';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { useAccounts } from '@/hooks/useAppData';
import type { Account } from '@/utils/db/schema';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { formatMoney } from '@/utils/format';
import { useT } from '@/hooks/useT';
import { useActiveProfile, useProfiles } from '@/hooks/useProfile';
import type { Profile } from '@/utils/profiles';

export default function MeScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>{t('me.title')}</Text>
        <HeaderSettingsButton />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ProfilesSection />
        <AccountsSection />
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Profiles ----

type ProfileSheetMode =
  | { kind: 'closed' }
  | { kind: 'switch'; profiles: Profile[]; activeId: string }
  | { kind: 'edit'; profile: Profile }
  | { kind: 'create' };

function ProfilesSection() {
  const t = useT();
  const profiles = useProfiles();
  const active = useActiveProfile();
  const [sheet, setSheet] = useState<ProfileSheetMode>({ kind: 'closed' });

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader
        title="Profiles"
        onAdd={() => setSheet({ kind: 'create' })}
        addLabel={t('common.add')}
      />
      <View style={{ gap: spacing.sm }}>
        {profiles.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setSheet({ kind: 'edit', profile: p })}
            style={[
              styles.profileRow,
              p.id === active.id && { borderColor: p.color },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}${p.id === active.id ? ', active' : ''}`}
          >
            <View style={[styles.iconBox, { backgroundColor: `${p.color}22` }]}>
              <MaterialCommunityIcons name={p.icon as never} size={20} color={p.color} />
            </View>
            <Text style={styles.acctName}>{p.name}</Text>
            {p.id === active.id ? (
              <Text style={[styles.acctType, { color: p.color }]}>active</Text>
            ) : (
              <Pressable
                hitSlop={10}
                onPress={(e) => {
                  e.stopPropagation();
                  setSheet({ kind: 'switch', profiles, activeId: active.id });
                }}
                accessibilityLabel="Switch"
              >
                <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.text2} />
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>

      <ProfileSheet
        visible={sheet.kind !== 'closed'}
        mode={sheet.kind === 'closed' ? null : sheet}
        onClose={() => setSheet({ kind: 'closed' })}
      />
    </View>
  );
}

// ---- Accounts ----

function AccountsSection() {
  const t = useT();
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const assets = accounts.filter((a) => a.balance >= 0).reduce((s, a) => s + a.balance, 0);
  const debt = accounts.filter((a) => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const net = assets - debt;

  // null = creating new; Account = editing; undefined = sheet closed
  const [editing, setEditing] = useState<Account | null | undefined>(undefined);

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader
        title={t('me.section.accounts')}
        onAdd={() => setEditing(null)}
        addLabel={t('common.add')}
      />

      <View style={styles.netCard}>
        <Text style={styles.netLabel}>{t('me.netBalance')}</Text>
        <Text style={[styles.netValue, { color: net >= 0 ? theme.accent : theme.expense }]}>
          {formatMoney(net, currency)}
        </Text>
      </View>

      <View style={sectionStyles.summaryRow}>
        <SummaryCard label={t('me.assets')} value={assets} color={theme.accent} currency={currency} />
        <SummaryCard label={t('me.debt')} value={debt} color={theme.expense} currency={currency} />
      </View>

      {accounts.map((a) => (
        <Pressable
          key={a.id}
          style={styles.acctCard}
          onPress={() => setEditing(a)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${a.name}, ${formatMoney(a.balance, currency)}`}
        >
          <View style={[styles.iconBox, { backgroundColor: `${a.color}22` }]}>
            <MaterialCommunityIcons name="wallet-outline" size={20} color={a.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.acctName}>{a.name}</Text>
            <Text style={styles.acctType}>{a.type}</Text>
            {a.creditLimit && (
              <View style={[styles.barBg, { marginTop: 6 }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.min(Math.abs(a.balance) / a.creditLimit, 1) * 100}%`,
                      backgroundColor: theme.expense,
                    },
                  ]}
                />
              </View>
            )}
          </View>
          <Text style={[styles.acctBal, { color: a.balance >= 0 ? theme.accent : theme.expense }]}>
            {formatMoney(a.balance, currency)}
          </Text>
        </Pressable>
      ))}

      <AccountSheet
        visible={editing !== undefined}
        account={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  netCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: { color: theme.text2, fontSize: sizes.sm },
  netValue: { fontSize: sizes.xxl, fontFamily: font.displayBold },
  acctCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acctName: { color: theme.text1, fontSize: sizes.md },
  acctType: { color: theme.text3, fontSize: sizes.xs, textTransform: 'capitalize' },
  acctBal: { fontSize: sizes.lg, fontFamily: font.display, fontWeight: '700' },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
