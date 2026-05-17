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
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import {
  SectionHeader,
  SettingRow,
  sectionStyles,
} from '@/components/Sections';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { FeatureSlots } from '@/features';
import {
  isBiometricEnabled,
  setBiometricEnabled,
  useBiometricSupported,
} from '@/hooks/useBiometricLock';
import {
  CURRENCIES,
  type CurrencyCode,
  CURRENCY_FORMAT_PRESETS,
  previewWithPreset,
} from '@/constants/currency';
import { kv } from '@/utils/kv';
import { exportData } from '@/utils/dataExport';
import { exportMonthlyPdf, exportYearlyPdf } from '@/utils/pdfReport';
import { monthKey as monthKeyOf } from '@/utils/format';
import { useFxRates } from '@/hooks/useFxRates';
import { useCategoriesWithMeta, setCategoryMeta, type CategoryWithMeta } from '@/hooks/useAppData';
import { convert } from '@/utils/fx';
import { getRawDB } from '@/utils/db/client';
import { APP_NAME } from '@/constants/flavor';
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL } from '@/constants/legal';
import { useT } from '@/hooks/useT';
import { setLocale as setI18nLocale, type LocaleCode } from '@/utils/i18n';
import { useActiveProfile, useProfiles } from '@/hooks/useProfile';
import { ProfileSheet } from '@/components/ProfileSheet';
import type { Profile } from '@/utils/profiles';

// LOCALES is shared with onboarding/locale search; defined centrally in
// constants/locales.ts so the two surfaces never drift.
import { LOCALES } from '@/constants/locales';

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
        {/* ───── PROFILE SETTINGS ───── */}
        <Text style={settingsTopStyles.groupTitle}>PROFILE SETTINGS</Text>
        <ActiveProfileRow />
        <CurrencyRow />
        <CurrencyFormatRow />
        <CategoriesSection />
        <SmartSuggestionsRow />
        {/* Islamic flavor: mazhab + prayer-method rows. Generic: nothing. */}
        <FeatureSlots.MeTabExtras onNavigate={(p) => router.push(p as never)} />

        {/* ───── APP SETTINGS ───── */}
        <Text style={[settingsTopStyles.groupTitle, { marginTop: spacing.xl }]}>APP SETTINGS</Text>
        <LanguageRow />
        <ArabicNumeralsRow />
        <AppearanceRow />
        <SecuritySection />
        <NotificationsRow />
        <DataSection />
        <ProfileManagementSection />

        {/* ───── ABOUT (sits below both groups) ───── */}
        <View style={{ marginTop: spacing.xl }}>
          <AboutSection />
        </View>
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

// ---- Profiles ----
// Moved from Me/Accounts (Phase 10v): profiles are configuration, not
// identity data the user manages daily. They live above Preferences here.

type ProfileSheetMode =
  | { kind: 'closed' }
  | { kind: 'switch'; profiles: Profile[]; activeId: string }
  | { kind: 'edit'; profile: Profile }
  | { kind: 'create' };

function ProfileManagementSection() {
  const t = useT();
  const profiles = useProfiles();
  const active = useActiveProfile();
  const [sheet, setSheet] = useState<ProfileSheetMode>({ kind: 'closed' });

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg }}>
      <SectionHeader
        title={t('me.section.profiles')}
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
            <View style={[styles.profileIcon, { backgroundColor: `${p.color}22` }]}>
              <MaterialCommunityIcons name={p.icon as never} size={20} color={p.color} />
            </View>
            <Text style={styles.profileName}>{p.name}</Text>
            {p.id === active.id ? (
              <Text style={[styles.profileActive, { color: p.color }]}>active</Text>
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

/** Phase 10w settings split:
 *  Profile settings (per active profile):
 *    - Active profile row (edit / delete)
 *    - Default currency
 *    - Categories link
 *    - Frequent merchant chips toggle
 *    - Islamic mazhab / prayer method (via FeatureSlots.MeTabExtras)
 *  App settings (global):
 *    - Language (+ Arabic-Indic numerals when locale starts with ar)
 *    - Appearance
 *    - Biometric lock
 *    - Notifications (placeholder)
 *    - Export data
 *    - Profile management (switch / add list)
 *    - About
 *
 *  Currency, smart-suggestions, categories, islamic prefs live under
 *  Profile settings because they're conceptually scoped to the active
 *  profile (kv storage is profile-keyed via the profile-scoped SQLite
 *  DB; multi-profile users can have a personal-profile USD + business-
 *  profile EUR setup, for example).
 */

function ActiveProfileRow() {
  const t = useT();
  const active = useActiveProfile();
  const profiles = useProfiles();
  const [sheet, setSheet] = useState<ProfileSheetMode>({ kind: 'closed' });
  const hint =
    profiles.length === 1
      ? t('profile.active')
      : t('profile.activeAmong', { count: profiles.length });
  return (
    <>
      <SettingRow
        label={active.name}
        hint={hint}
        icon={(active.icon as never) || 'account-circle-outline'}
        iconColor={active.color}
        onPress={() => setSheet({ kind: 'edit', profile: active })}
      />
      <ProfileSheet
        visible={sheet.kind !== 'closed'}
        mode={sheet.kind === 'closed' ? null : sheet}
        onClose={() => setSheet({ kind: 'closed' })}
      />
      {/* unused locally, but keep the import alive for t() */}
      {false && <Text>{t('common.edit')}</Text>}
    </>
  );
}

function CurrencyRow() {
  const t = useT();
  const [currency, setCurrency] = useState<CurrencyCode>((kv.get('currency') ?? 'USD') as CurrencyCode);
  const [open, setOpen] = useState(false);
  const label = `${currency} · ${CURRENCIES[currency].symbolNative} ${CURRENCIES[currency].name}`;
  return (
    <>
      <SettingRow
        label={t('me.currency')}
        hint={label}
        icon="currency-usd"
        onPress={() => setOpen(true)}
      />
      <CurrencyPickerSheet
        visible={open}
        title={t('me.currency')}
        selected={currency}
        onPick={(c) => {
          const prev = currency;
          kv.set('currency', c);
          setCurrency(c);
          if (prev !== c) maybeOfferBudgetConversion(prev, c);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function CurrencyFormatRow() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<string>(kv.get('currencyFormat') ?? '');
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const def = CURRENCIES[currency];
  // The sample amount that produces a visible difference across all formats.
  const sample = -1234567.9;
  const hint = presetId
    ? previewWithPreset(sample, CURRENCY_FORMAT_PRESETS.find((p) => p.id === presetId)!, def.symbolNative, 2)
    : t('me.currencyFormat.hint');
  return (
    <>
      <SettingRow
        label={t('me.currencyFormat')}
        hint={hint}
        icon="numeric"
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title={t('me.currencyFormat')}
        options={CURRENCY_FORMAT_PRESETS.map<PickerOption<string>>((p) => ({
          value: p.id,
          label: previewWithPreset(sample, p, def.symbolNative, 2),
        }))}
        selected={presetId}
        onPick={(id) => {
          setPresetId(id);
          kv.set('currencyFormat', id);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function LanguageRow() {
  const t = useT();
  const [locale, setLocale] = useState<string>(kv.get('locale') ?? 'en-US');
  const [open, setOpen] = useState(false);
  const localeLabel = LOCALES.find((l) => l.code === locale)?.name ?? locale;
  return (
    <>
      <SettingRow
        label={t('me.language')}
        hint={localeLabel}
        icon="translate"
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
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
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function ArabicNumeralsRow() {
  const t = useT();
  const [on, setOn] = useState<boolean>(kv.getBool('arabicNumerals', true));
  const locale = kv.get('locale') ?? 'en-US';
  if (!locale.startsWith('ar')) return null;
  return (
    <SettingRow
      label={t('me.arabicNumerals')}
      hint={t('me.arabicNumerals.hint')}
      trailing={
        <Pressable
          onPress={() => {
            const next = !on;
            setOn(next);
            kv.setBool('arabicNumerals', next);
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

function AppearanceRow() {
  const t = useT();
  const [themeMode, setThemeModeState] = useState<string>(kv.get('themeMode') ?? 'system');
  const [open, setOpen] = useState(false);
  const themeModeLabel = (() => {
    switch (themeMode) {
      case 'dark': return t('me.appearance.dark');
      case 'light': return t('me.appearance.light');
      default: return t('me.appearance.system');
    }
  })();
  return (
    <>
      <SettingRow
        label={t('me.appearance')}
        hint={themeModeLabel}
        icon="palette-outline"
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
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
        onClose={() => setOpen(false)}
      />
    </>
  );
}


function NotificationsRow() {
  // Placeholder until expo-notifications wiring lands (Round 2 follow-up).
  // Toggle does nothing yet but the row reserves its place in the
  // App settings flow so muscle memory doesn't shift later.
  const t = useT();
  void t;
  return (
    <SettingRow
      label="Notifications"
      hint="Bill reminders, budget alerts (coming soon)"
      icon="bell-outline"
      iconColor={theme.text2}
    />
  );
}

const settingsTopStyles = StyleSheet.create({
  groupTitle: {
    color: theme.text3,
    fontSize: 11,
    fontFamily: font.bodySemi,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
});

function SmartSuggestionsRow() {
  const t = useT();
  const [on, setOn] = useState(kv.getBool('smartSuggestions', true));
  return (
    <SettingRow
      label={t('settings.smartSuggestions.label')}
      hint={on ? t('settings.smartSuggestions.bodyOn') : t('settings.smartSuggestions.bodyOff')}
      icon="lightbulb-on-outline"
      trailing={
        <Pressable
          onPress={() => {
            const next = !on;
            kv.setBool('smartSuggestions', next);
            setOn(next);
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

// ---- FX auto-refresh (Phase 10k) ----

function FxRefreshRow() {
  const t = useT();
  const fx = useFxRates();
  const fmtAge = (() => {
    if (!fx.lastFetched) return t('settings.fx.never');
    const diffH = Math.floor((Date.now() - fx.lastFetched) / 3_600_000);
    if (diffH < 1) return t('settings.fx.justNow');
    if (diffH < 24) return t('settings.fx.hoursAgo', { n: diffH });
    return t('settings.fx.daysAgo', { n: Math.floor(diffH / 24) });
  })();
  // FX is always-on now (multi-source fallback). This row exposes the
  // cache age + manual refresh — useful when a user just enabled a
  // foreign-currency account and doesn't want to wait for the daily
  // window.
  return (
    <SettingRow
      label={t('settings.fx.label')}
      hint={fx.refreshing ? t('settings.fx.refreshing') : fmtAge}
      icon="cached"
      onPress={() => void fx.refresh()}
    />
  );
}

/** Phase 10w currency-change side effect: every budget remembers the
 *  currency it was created in. Switching the default currency must NOT
 *  rewrite that — the data is per-budget, locked at creation. Offer a
 *  one-shot opt-in conversion at today's FX rate. */
function maybeOfferBudgetConversion(prev: string, next: string) {
  if (prev === next) return;
  const raw = getRawDB();
  type Row = { id: string; monthly_budget: number; budget_currency: string | null };
  let rows: Row[] = [];
  try {
    rows = raw.getAllSync(
      `SELECT id, monthly_budget, budget_currency FROM custom_categories
        WHERE monthly_budget IS NOT NULL`,
    ) as Row[];
  } catch {
    return;
  }
  const inPrev = rows.filter((r) => (r.budget_currency ?? prev) === prev);
  if (inPrev.length === 0) return;
  Alert.alert(
    'Convert budgets?',
    `You have ${inPrev.length} budget${inPrev.length === 1 ? '' : 's'} in ${prev}. Keep them as-is, or convert all to ${next} at today's rate?`,
    [
      { text: `Keep in ${prev}`, style: 'cancel' },
      {
        text: `Convert to ${next}`,
        onPress: () => {
          for (const r of inPrev) {
            const converted = convert(r.monthly_budget, prev, next);
            setCategoryMeta(r.id, {
              monthlyBudget: Math.round(converted * 100) / 100,
              budgetCurrency: next,
            });
          }
        },
      },
    ],
  );
}

// ---- Categories (Phase 10w: now a single link row → /categories-manage) ----

function CategoriesSection() {
  const t = useT();
  const router = useRouter();
  const categories = useCategoriesWithMeta();
  const active = categories.filter((c) => !c.archived && c.id !== 'adjustment');
  const budgetCount = categories.filter((c) => c.monthlyBudget != null && !c.archived).length;
  const hint =
    t('categories.count', { n: active.length }) +
    (budgetCount > 0 ? ` · ${t('categories.withBudget', { n: budgetCount })}` : '');
  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SettingRow
        label={t('settings.categories.title')}
        hint={hint}
        icon="tag-multiple-outline"
        iconColor={theme.accent}
        onPress={() => router.push('/categories-manage' as never)}
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
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { color: theme.text1, fontSize: sizes.md, flex: 1 },
  profileActive: { fontSize: sizes.xs, fontFamily: font.bodySemi, textTransform: 'lowercase' },
  disclaimer: {
    color: theme.text3,
    fontSize: sizes.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    lineHeight: 16,
  },
});
