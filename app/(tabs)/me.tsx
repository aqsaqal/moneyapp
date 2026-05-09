// Me — identity / setup. Accounts up top (frequent), then Settings, then
// (islamic) MeTabExtras (mazhab + prayer-method rows), then About.
//
// v2 IA: extracted from v1 app/(tabs)/more.tsx (AccountsTab + SettingsTab).
// Net Balance moves here from Home (it's a "see all my money" answer, not a
// daily-glance answer).

import React, { useState } from 'react';
import { Alert, I18nManager, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import {
  SectionHeader,
  SummaryCard,
  SettingRow,
  AddRow,
  sectionStyles,
} from '@/components/Sections';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { AccountSheet } from '@/components/AccountSheet';
import { FeatureSlots } from '@/features';
import { useAccounts } from '@/hooks/useAppData';
import type { Account } from '@/utils/db/schema';
import {
  isBiometricEnabled,
  setBiometricEnabled,
  useBiometricSupported,
} from '@/hooks/useBiometricLock';
import { CURRENCIES, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { formatMoney } from '@/utils/format';
import { exportData } from '@/utils/dataExport';
import { APP_NAME } from '@/constants/flavor';
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL } from '@/constants/legal';
import { useT } from '@/hooks/useT';
import { setLocale as setI18nLocale, type LocaleCode } from '@/utils/i18n';

const LOCALES = [
  { code: 'en-US', name: 'English', rtl: false },
  { code: 'ar-SA', name: 'العربية', rtl: true },
  { code: 'tr-TR', name: 'Türkçe', rtl: false },
  { code: 'id-ID', name: 'Bahasa Indonesia', rtl: false },
  { code: 'ms-MY', name: 'Bahasa Melayu', rtl: false },
];

export default function MeScreen() {
  const router = useRouter();
  const t = useT();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>{t('me.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AccountsSection />
        <SettingsSection />
        {/* Islamic: mazhab + prayer-method visible rows. Generic: nothing. */}
        <FeatureSlots.MeTabExtras onNavigate={(p) => router.push(p as never)} />
        <AboutSection />
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
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
    <View style={{ gap: spacing.md }}>
      <SectionHeader
        title={t('me.section.accounts')}
        onAdd={() => setEditing(null)}
        addLabel={t('common.add')}
      />

      {/* Net balance moved from Home → here in v2. */}
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

// ---- Settings ----

// Translate-and-restart flow. Uses i18n.t() so the dialog itself is in the
// CURRENT language, not the new one. Saves locale + flips i18n active locale
// + RTL direction + reloads via expo-updates.
function changeLocale(next: string, tFn: (k: string) => string) {
  const cur = kv.get('locale');
  if (cur === next) return;
  Alert.alert(
    tFn('me.lang.changeTitle'),
    tFn('me.lang.changeBody'),
    [
      { text: tFn('common.cancel'), style: 'cancel' },
      {
        text: tFn('me.lang.restart'),
        style: 'default',
        onPress: async () => {
          kv.set('locale', next);
          setI18nLocale(next as LocaleCode);
          if (Platform.OS !== 'web') {
            const shouldBeRTL = next.startsWith('ar');
            if (shouldBeRTL !== I18nManager.isRTL) {
              I18nManager.forceRTL(shouldBeRTL);
              kv.set('rtlSetForLocale', next);
            }
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const Updates = require('expo-updates');
              await Updates.reloadAsync();
            } catch {
              Alert.alert(tFn('me.lang.changeTitle'), tFn('me.lang.restartManual'));
            }
          }
        },
      },
    ],
  );
}

function SettingsSection() {
  const t = useT();
  const supported = useBiometricSupported();
  const [bio, setBio] = useState(isBiometricEnabled());
  const [currency, setCurrency] = useState<CurrencyCode>((kv.get('currency') ?? 'USD') as CurrencyCode);
  const [locale, setLocale] = useState<string>(kv.get('locale') ?? 'en-US');
  const [arabicNum, setArabicNum] = useState<boolean>(kv.getBool('arabicNumerals', true));

  // Picker sheet open state — single shared pattern for Language & Currency.
  const [picker, setPicker] = useState<null | 'lang' | 'currency'>(null);

  const localeLabel = LOCALES.find((l) => l.code === locale)?.name ?? locale;
  const currencyLabel = `${currency} · ${CURRENCIES[currency].symbolNative} ${CURRENCIES[currency].name}`;

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader title={t('me.section.preferences')} />

      <SettingRow
        label={t('me.language')}
        hint={localeLabel}
        icon="translate"
        onPress={() => setPicker('lang')}
      />

      {locale.startsWith('ar') && (
        <SettingRow
          label={t('me.arabicNumerals')}
          hint={t('me.arabicNumerals.hint')}
          trailing={
            <Pressable
              onPress={() => {
                const next = !arabicNum;
                setArabicNum(next);
                kv.setBool('arabicNumerals', next);
              }}
              style={[sectionStyles.toggle, arabicNum && { backgroundColor: theme.accent }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: arabicNum }}
            >
              <View style={[sectionStyles.toggleKnob, arabicNum && { transform: [{ translateX: 18 }] }]} />
            </Pressable>
          }
        />
      )}

      <SettingRow
        label={t('me.currency')}
        hint={currencyLabel}
        icon="currency-usd"
        onPress={() => setPicker('currency')}
      />

      <SectionHeader title={t('me.section.security')} />
      <SettingRow
        label={t('me.biometric')}
        hint={
          supported
            ? t('me.biometric.hintSupported')
            : t('me.biometric.hintUnsupported')
        }
        trailing={
          <Pressable
            onPress={() => {
              if (supported) {
                setBiometricEnabled(!bio);
                setBio(!bio);
              }
            }}
            style={[sectionStyles.toggle, bio && { backgroundColor: theme.accent }]}
            accessibilityRole="switch"
            accessibilityState={{ checked: bio, disabled: !supported }}
          >
            <View style={[sectionStyles.toggleKnob, bio && { transform: [{ translateX: 18 }] }]} />
          </Pressable>
        }
      />

      <SectionHeader title={t('me.section.data')} />
      <SettingRow
        label={t('me.export.json')}
        icon="export"
        onPress={() => exportData('json')}
      />
      <SettingRow
        label={t('me.export.csv')}
        icon="export"
        onPress={() => exportData('csv')}
      />

      <PickerSheet
        visible={picker === 'lang'}
        title={t('me.language')}
        options={LOCALES.map<PickerOption<string>>((l) => ({
          value: l.code,
          label: l.name,
          hint: l.rtl ? '←' : undefined,
        }))}
        selected={locale}
        onPick={(code) => {
          setLocale(code);
          changeLocale(code, t);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'currency'}
        title={t('me.currency')}
        options={(Object.keys(CURRENCIES) as CurrencyCode[]).map<PickerOption<CurrencyCode>>((c) => ({
          value: c,
          label: `${c} · ${CURRENCIES[c].symbolNative}`,
          hint: CURRENCIES[c].name,
        }))}
        selected={currency}
        onPick={(c) => {
          kv.set('currency', c);
          setCurrency(c);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

// ---- About ----

function AboutSection() {
  const t = useT();
  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader title={t('me.section.about')} />
      <SettingRow label={APP_NAME} hint="Version 1.0.0" />
      <SettingRow
        label={t('me.privacyPolicy')}
        icon="shield-lock-outline"
        onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
      />
      <SettingRow
        label={t('me.terms')}
        icon="file-document-outline"
        onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
      />
      <SettingRow
        label={t('me.support')}
        hint={SUPPORT_EMAIL}
        icon="email-outline"
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
      />
      <Text style={styles.disclaimer}>{t('me.disclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: { padding: spacing.lg, gap: spacing.md },
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
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  disclaimer: {
    color: theme.text3,
    fontSize: sizes.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    lineHeight: 16,
  },
});
