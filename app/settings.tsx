// Settings — modal screen reachable from the header cog on every tab.
//
// Lifted out of (tabs)/me.tsx in Phase 10g. Me now owns Profiles + Accounts
// (identity / day-to-day data); this screen owns configuration:
//   - Preferences (Language, Currency, Appearance, Arabic numerals)
//   - Security (Biometric Unlock)
//   - Islamic (mazhab + prayer-method, via FeatureSlots.MeTabExtras)
//   - Data (Export JSON / CSV)
//   - About (Privacy Policy / Terms / Support / version + disclaimer)
//
// The PickerSheets, locale-change-and-reload flow, and theme-change-and-reload
// flow are unchanged from where they used to live on Me — pure relocation.

import React, { useState } from 'react';
import {
  Alert,
  DevSettings,
  I18nManager,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes } from '@/constants/theme';
import {
  SectionHeader,
  SettingRow,
  sectionStyles,
} from '@/components/Sections';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { FeatureSlots } from '@/features';
import {
  isBiometricEnabled,
  setBiometricEnabled,
  useBiometricSupported,
} from '@/hooks/useBiometricLock';
import { CURRENCIES, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { exportData } from '@/utils/dataExport';
import { exportMonthlyPdf, exportYearlyPdf } from '@/utils/pdfReport';
import { monthKey as monthKeyOf } from '@/utils/format';
import { useFxRates } from '@/hooks/useFxRates';
import { useCustomCategories } from '@/hooks/useAppData';
import { CustomCategorySheet } from '@/components/CustomCategorySheet';
import type { CustomCategory } from '@/utils/db/schema';
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

export default function SettingsScreen() {
  const router = useRouter();
  const t = useT();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t('common.close')}
        >
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PreferencesSection />
        <CategoriesSection />
        <SecuritySection />
        {/* Islamic flavor: mazhab + prayer-method rows. Generic: nothing. */}
        <FeatureSlots.MeTabExtras onNavigate={(p) => router.push(p as never)} />
        <DataSection />
        <AboutSection />
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Preferences ----

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
            if (__DEV__ && DevSettings?.reload) {
              DevSettings.reload();
              return;
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

function PreferencesSection() {
  const t = useT();
  const [currency, setCurrency] = useState<CurrencyCode>((kv.get('currency') ?? 'USD') as CurrencyCode);
  const [locale, setLocale] = useState<string>(kv.get('locale') ?? 'en-US');
  const [arabicNum, setArabicNum] = useState<boolean>(kv.getBool('arabicNumerals', true));
  const [themeMode, setThemeModeState] = useState<string>(kv.get('themeMode') ?? 'system');
  const [picker, setPicker] = useState<null | 'lang' | 'currency' | 'theme'>(null);

  const themeModeLabel = (() => {
    switch (themeMode) {
      case 'dark': return t('me.appearance.dark');
      case 'light': return t('me.appearance.light');
      default: return t('me.appearance.system');
    }
  })();

  const localeLabel = LOCALES.find((l) => l.code === locale)?.name ?? locale;
  const currencyLabel = `${currency} · ${CURRENCIES[currency].symbolNative} ${CURRENCIES[currency].name}`;

  return (
    <View style={{ gap: spacing.md }}>
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
      <SettingRow
        label={t('me.appearance')}
        hint={themeModeLabel}
        icon="palette-outline"
        onPress={() => setPicker('theme')}
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
        visible={picker === 'theme'}
        title={t('me.appearance')}
        options={[
          { value: 'system', label: t('me.appearance.system'), icon: 'theme-light-dark' },
          { value: 'dark', label: t('me.appearance.dark'), icon: 'weather-night' },
          { value: 'light', label: t('me.appearance.light'), icon: 'white-balance-sunny' },
        ]}
        selected={themeMode}
        onPick={(mode) => {
          if (mode === themeMode) return;
          kv.set('themeMode', mode);
          setThemeModeState(mode);
          Alert.alert(
            t('me.lang.changeTitle'),
            t('me.lang.changeBody'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('me.lang.restart'),
                style: 'default',
                onPress: async () => {
                  if (__DEV__ && DevSettings?.reload) {
                    DevSettings.reload();
                    return;
                  }
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const Updates = require('expo-updates');
                    await Updates.reloadAsync();
                  } catch {
                    Alert.alert(t('me.lang.changeTitle'), t('me.lang.restartManual'));
                  }
                },
              },
            ],
          );
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

// ---- FX auto-refresh (Phase 10k) ----

function FxRefreshRow() {
  const t = useT();
  const [on, setOn] = useState(kv.getBool('fxAutoRefresh', false));
  const fx = useFxRates();
  const fmtAge = (() => {
    if (!fx.lastFetched) return t('settings.fx.never');
    const diffH = Math.floor((Date.now() - fx.lastFetched) / 3_600_000);
    if (diffH < 1) return t('settings.fx.justNow');
    if (diffH < 24) return t('settings.fx.hoursAgo', { n: diffH });
    return t('settings.fx.daysAgo', { n: Math.floor(diffH / 24) });
  })();
  return (
    <SettingRow
      label={t('settings.fx.label')}
      hint={fx.refreshing ? t('settings.fx.refreshing') : on ? fmtAge : t('settings.fx.bodyOff')}
      icon="cached"
      trailing={
        <Pressable
          onPress={() => {
            const next = !on;
            kv.setBool('fxAutoRefresh', next);
            setOn(next);
            if (next) void fx.refresh();
          }}
          style={[sectionStyles.toggle, on && { backgroundColor: theme.accent }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
        >
          <View style={[sectionStyles.toggleKnob, on && { transform: [{ translateX: 18 }] }]} />
        </Pressable>
      }
    />
  );
}

// ---- Custom categories (Phase 10s) ----

function CategoriesSection() {
  const t = useT();
  const customs = useCustomCategories();
  const [editing, setEditing] = useState<CustomCategory | null | undefined>(undefined);

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader
        title={t('settings.categories.title')}
        onAdd={() => setEditing(null)}
        addLabel={t('common.add')}
      />
      {customs.length === 0 && (
        <Text style={{ color: theme.text3, fontSize: sizes.sm, paddingHorizontal: 4, lineHeight: 20 }}>
          {t('settings.categories.empty')}
        </Text>
      )}
      {customs.map((c) => (
        <SettingRow
          key={c.id}
          label={c.name}
          hint={c.type === 'expense' ? 'Expense' : 'Income'}
          icon={c.icon as never}
          iconColor={c.color}
          onPress={() => setEditing(c)}
        />
      ))}
      <CustomCategorySheet
        visible={editing !== undefined}
        category={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </View>
  );
}

// ---- Security ----

function SecuritySection() {
  const t = useT();
  const supported = useBiometricSupported();
  const [bio, setBio] = useState(isBiometricEnabled());
  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <FxRefreshRow />

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
    </View>
  );
}

// ---- Data ----

function DataSection() {
  const t = useT();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const now = new Date();
  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
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
      <SettingRow
        label={t('me.export.pdfMonth')}
        hint={now.toLocaleString('en', { month: 'long', year: 'numeric' })}
        icon="file-pdf-box"
        onPress={() => {
          void exportMonthlyPdf(monthKeyOf(now), currency);
        }}
      />
      <SettingRow
        label={t('me.export.pdfYear')}
        hint={String(now.getFullYear())}
        icon="file-document-multiple-outline"
        onPress={() => {
          void exportYearlyPdf(now.getFullYear(), currency);
        }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  disclaimer: {
    color: theme.text3,
    fontSize: sizes.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    lineHeight: 16,
  },
});
