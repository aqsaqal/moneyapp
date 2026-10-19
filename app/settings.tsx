// Settings — modal screen reachable from the header cog on every tab.
//
// Layout:
//   Profile card      active profile (icon · name · currency · language),
//                     visible Edit button, horizontal profile chips to
//                     switch, "+" to create.
//   Money             currency, number format, exchange rates (age +
//                     inline refresh), islamic mazhab / method rows.
//   Look & language   language, Arabic numerals (ar-* only), appearance
//                     as an inline System / Light / Dark control.
//   Smart Add         merchant chips, FAB tap ↔ long-press swap.
//   Categories        one row → /categories-manage.
//   Security & data   biometric lock, bill reminders, Export (one row →
//                     sheet with 4 formats, shows last backup).
//   Advanced          import backup, recreate demo profile.
//   About             version, privacy, terms, support, disclaimer.
//
// Every row shows its current value on the right so the screen answers
// "what is it set to?" without a tap. Profile-scoped rows are re-keyed
// by profile id so their kv-seeded state re-reads on a switch.

import React, { useEffect, useState } from 'react';
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
import Constants from 'expo-constants';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { SectionHeader, SettingRow, sectionStyles } from '@/components/Sections';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { rebuildDemoProfile } from '@/utils/db/demoSeed';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { FeatureSlots } from '@/features';
import {
  isBiometricEnabled,
  setBiometricEnabled,
  useBiometricSupported,
  useBiometricKind,
} from '@/hooks/useBiometricLock';
import {
  CURRENCIES,
  type CurrencyCode,
  CURRENCY_FORMAT_PRESETS,
  previewWithPreset,
} from '@/constants/currency';
import { kv } from '@/utils/kv';
import { exportData, importData } from '@/utils/dataExport';
import { exportMonthlyPdf, exportYearlyPdf } from '@/utils/pdfReport';
import { monthKey as monthKeyOf, formatMonthYear } from '@/utils/format';
import { useFxRates } from '@/hooks/useFxRates';
import { useCategoriesWithMeta, setCategoryMeta, useRecurring, bumpVersion, backfillAmountMain } from '@/hooks/useAppData';
import { DEFAULT_LEAD_DAYS } from '@/utils/notifications';
import { convert } from '@/utils/fx';
import { getRawDB } from '@/utils/db/client';
import { APP_NAME } from '@/constants/flavor';
import { PRIVACY_POLICY_URL, TERMS_URL, SUPPORT_EMAIL } from '@/constants/legal';
import { useT } from '@/hooks/useT';
import { setLocale as setI18nLocale, type LocaleCode } from '@/utils/i18n';
import { useActiveProfile, useProfiles } from '@/hooks/useProfile';
import { ProfileSheet } from '@/components/ProfileSheet';
import { switchActiveProfile, type Profile } from '@/utils/profiles';
import { useHaptics } from '@/hooks/useHaptics';
import { LOCALES } from '@/constants/locales';

export default function SettingsScreen() {
  const router = useRouter();
  const t = useT();
  const activeProfile = useActiveProfile();
  const k = activeProfile.id;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ProfileCard key={`profile-${k}`} />

        <Group title={t('settings.groups.money')}>
          <CurrencyRow key={`currency-${k}`} />
          <CurrencyFormatRow key={`fmt-${k}`} />
          <FxRow />
          <FeatureSlots.MeTabExtras onNavigate={(p) => router.push(p as never)} />
        </Group>

        <Group title={t('settings.groups.look')}>
          <LanguageRow />
          <ArabicNumeralsRow />
          <AppearanceRow />
        </Group>

        <Group title={t('settings.groups.smartAdd')}>
          <SmartSuggestionsRow key={`smart-${k}`} />
          <FabActionRow key={`fab-${k}`} />
        </Group>

        <Group title={t('settings.categories.title')}>
          <CategoriesRow key={`cats-${k}`} />
        </Group>

        <Group title={t('settings.groups.securityData')}>
          <BiometricRow />
          <NotificationsRow />
          <ExportRow key={`export-${k}`} />
        </Group>

        <Group title={t('settings.groups.advanced')}>
          <ImportRow />
          <DemoProfileRow />
        </Group>

        <AboutSection />
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      style={[sectionStyles.toggle, on && { backgroundColor: theme.accent }, disabled && { opacity: 0.4 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
    >
      <View style={[sectionStyles.toggleKnob, on && { transform: [{ translateX: 18 }] }]} />
    </Pressable>
  );
}

async function reloadApp(t: (k: string) => string) {
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
}

// ─────────────────────────── Profile card ───────────────────────────

type ProfileSheetMode =
  | { kind: 'closed' }
  | { kind: 'edit'; profile: Profile }
  | { kind: 'create' };

function ProfileCard() {
  const t = useT();
  const haptics = useHaptics();
  const active = useActiveProfile();
  const profiles = useProfiles();
  const [sheet, setSheet] = useState<ProfileSheetMode>({ kind: 'closed' });
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const locale = kv.get('locale') ?? 'en-US';
  const localeName = LOCALES.find((l) => l.code === locale)?.name ?? locale;

  return (
    <View style={[styles.profileCard, { borderColor: `${active.color}66` }]}>
      <View style={styles.profileHead}>
        <View style={[styles.profileIcon, { backgroundColor: `${active.color}22` }]}>
          <MaterialCommunityIcons name={(active.icon as never) || 'account-circle-outline'} size={24} color={active.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.profileName} numberOfLines={1}>{active.name}</Text>
          <Text style={styles.profileSub} numberOfLines={1}>
            {CURRENCIES[currency]?.symbolNative ?? ''} {currency} · {localeName}
          </Text>
        </View>
        <Pressable
          onPress={() => setSheet({ kind: 'edit', profile: active })}
          style={[styles.editBtn, { borderColor: `${active.color}88` }]}
          accessibilityRole="button"
          accessibilityLabel={`${t('common.edit')} ${active.name}`}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="pencil-outline" size={14} color={active.color} />
          <Text style={[styles.editBtnText, { color: active.color }]}>{t('common.edit')}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {profiles.map((p) => {
          const isActive = p.id === active.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                if (isActive) return;
                haptics.press();
                switchActiveProfile(p.id);
              }}
              style={[styles.chip, isActive && { backgroundColor: `${p.color}22`, borderColor: p.color }]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={isActive ? `${p.name}, ${t('profile.active')}` : `${t('profile.switch')}: ${p.name}`}
            >
              <MaterialCommunityIcons name={p.icon as never} size={14} color={isActive ? p.color : theme.text2} />
              <Text style={[styles.chipText, isActive && { color: p.color }]} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setSheet({ kind: 'create' })}
          style={[styles.chip, styles.chipAdd]}
          accessibilityRole="button"
          accessibilityLabel={t('settings.profile.new')}
        >
          <MaterialCommunityIcons name="plus" size={14} color={theme.accent} />
          <Text style={[styles.chipText, { color: theme.accent }]}>{t('settings.profile.new')}</Text>
        </Pressable>
      </ScrollView>
      <ProfileSheet
        visible={sheet.kind !== 'closed'}
        mode={sheet.kind === 'closed' ? null : sheet}
        onClose={() => setSheet({ kind: 'closed' })}
      />
    </View>
  );
}

// ─────────────────────────── Money ───────────────────────────

function CurrencyRow() {
  const t = useT();
  const [currency, setCurrency] = useState<CurrencyCode>((kv.get('currency') ?? 'USD') as CurrencyCode);
  const [open, setOpen] = useState(false);
  const def = CURRENCIES[currency];
  return (
    <>
      <SettingRow
        label={t('me.currency')}
        hint={def?.name}
        value={`${def?.symbolNative ?? ''} ${currency}`}
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
          // Every stored main-currency amount is in the old unit.
          if (prev !== c) backfillAmountMain({ force: true });
          bumpVersion();
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
  const sample = -1234567.9;
  const preview = presetId
    ? previewWithPreset(sample, CURRENCY_FORMAT_PRESETS.find((p) => p.id === presetId)!, def.symbolNative, 2)
    : null;
  return (
    <>
      <SettingRow
        label={t('me.currencyFormat')}
        hint={preview ? undefined : t('me.currencyFormat.hint')}
        value={preview ?? undefined}
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
          bumpVersion();
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function FxRow() {
  const t = useT();
  const fx = useFxRates();
  const age = (() => {
    if (!fx.lastFetched) return t('settings.fx.never');
    const diffH = Math.floor((Date.now() - fx.lastFetched) / 3_600_000);
    if (diffH < 1) return t('settings.fx.justNow');
    if (diffH < 24) return t('settings.fx.hoursAgo', { n: diffH });
    return t('settings.fx.daysAgo', { n: Math.floor(diffH / 24) });
  })();
  return (
    <SettingRow
      label={t('settings.fx.label')}
      hint={fx.refreshing ? t('settings.fx.refreshing') : age}
      icon="cached"
      trailing={
        <Pressable
          onPress={() => void fx.refresh()}
          disabled={fx.refreshing}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('settings.fx.refresh')}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={18}
            color={fx.refreshing ? theme.text3 : theme.accent}
          />
        </Pressable>
      }
    />
  );
}

/** Switching the default currency must not rewrite per-budget
 *  currencies (locked at creation). Offer a one-shot conversion. */
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

// ─────────────────────────── Look & language ───────────────────────────

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
            await reloadApp(tFn);
          }
        },
      },
    ],
  );
}

function LanguageRow() {
  const t = useT();
  const [locale, setLocale] = useState<string>(kv.get('locale') ?? 'en-US');
  const [open, setOpen] = useState(false);
  const localeLabel = LOCALES.find((l) => l.code === locale)?.name ?? locale;
  return (
    <>
      <SettingRow label={t('me.language')} value={localeLabel} icon="translate" onPress={() => setOpen(true)} />
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
      icon="numeric-9-plus-box-multiple-outline"
      trailing={
        <Toggle
          on={on}
          onToggle={() => {
            const next = !on;
            setOn(next);
            kv.setBool('arabicNumerals', next);
          }}
        />
      }
    />
  );
}

function AppearanceRow() {
  const t = useT();
  const [mode, setMode] = useState<string>(kv.get('themeMode') ?? 'system');
  const options: { value: string; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
    { value: 'system', label: t('me.appearance.system'), icon: 'theme-light-dark' },
    { value: 'light', label: t('me.appearance.light'), icon: 'white-balance-sunny' },
    { value: 'dark', label: t('me.appearance.dark'), icon: 'weather-night' },
  ];
  const pick = (next: string) => {
    if (next === mode) return;
    const prev = mode;
    kv.set('themeMode', next);
    setMode(next);
    Alert.alert(t('me.lang.changeTitle'), t('me.lang.changeBody'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
        onPress: () => {
          kv.set('themeMode', prev);
          setMode(prev);
        },
      },
      { text: t('me.lang.restart'), style: 'default', onPress: () => void reloadApp(t) },
    ]);
  };
  return (
    <View style={sectionStyles.settingRow}>
      <MaterialCommunityIcons name="palette-outline" size={20} color={theme.accent} />
      <Text style={[sectionStyles.settingLabel, { flex: 1 }]}>{t('me.appearance')}</Text>
      <View style={styles.segment}>
        {options.map((o) => {
          const active = o.value === mode;
          return (
            <Pressable
              key={o.value}
              onPress={() => pick(o.value)}
              style={[styles.segBtn, active && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={o.label}
            >
              <MaterialCommunityIcons name={o.icon} size={16} color={active ? theme.bg : theme.text2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────── Smart Add ───────────────────────────

function SmartSuggestionsRow() {
  const t = useT();
  const [on, setOn] = useState(kv.getBool('smartSuggestions', false));
  return (
    <SettingRow
      label={t('settings.smartSuggestions.label')}
      hint={on ? t('settings.smartSuggestions.bodyOn') : t('settings.smartSuggestions.bodyOff')}
      icon="lightbulb-on-outline"
      trailing={
        <Toggle
          on={on}
          onToggle={() => {
            const next = !on;
            kv.setBool('smartSuggestions', next);
            setOn(next);
          }}
        />
      }
    />
  );
}

function FabActionRow() {
  const t = useT();
  const [swap, setSwap] = useState(kv.getBool('fabSwapAction', false));
  return (
    <SettingRow
      label={t('settings.fabAction.label')}
      hint={swap ? t('settings.fabAction.bodyOn') : t('settings.fabAction.bodyOff')}
      icon="gesture-tap-hold"
      trailing={
        <Toggle
          on={swap}
          onToggle={() => {
            const next = !swap;
            kv.setBool('fabSwapAction', next);
            setSwap(next);
          }}
        />
      }
    />
  );
}

// ─────────────────────────── Categories ───────────────────────────

function CategoriesRow() {
  const t = useT();
  const router = useRouter();
  const categories = useCategoriesWithMeta();
  const active = categories.filter((c) => !c.archived && c.id !== 'adjustment');
  const budgetCount = categories.filter((c) => c.monthlyBudget != null && !c.archived).length;
  return (
    <SettingRow
      label={t('settings.categories.title')}
      hint={budgetCount > 0 ? t('categories.withBudget', { n: budgetCount }) : undefined}
      value={t('categories.count', { n: active.length })}
      icon="tag-multiple-outline"
      onPress={() => router.push('/categories-manage' as never)}
    />
  );
}

// ─────────────────────────── Security & data ───────────────────────────

function BiometricRow() {
  const t = useT();
  const supported = useBiometricSupported();
  const kind = useBiometricKind();
  const [bio, setBio] = useState(isBiometricEnabled());
  return (
    <SettingRow
      label={t('me.biometric')}
      hint={supported ? t('me.biometric.hintSupported') : t('me.biometric.hintUnsupported')}
      icon={kind === 'face' ? 'face-recognition' : 'fingerprint'}
      iconColor={bio ? theme.accent : theme.text2}
      trailing={
        <Toggle
          on={bio}
          disabled={!supported}
          onToggle={() => {
            setBiometricEnabled(!bio);
            setBio(!bio);
          }}
        />
      }
    />
  );
}

function NotificationsRow() {
  const t = useT();
  const recurringRows = useRecurring();
  const [enabled, setEnabled] = useState(false);
  const [leadDays, setLeadDays] = useState(DEFAULT_LEAD_DAYS);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Lazy-require so bundles without the native module don't crash here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const notif = require('@/utils/notifications') as typeof import('@/utils/notifications');

  useEffect(() => {
    setEnabled(notif.getRemindersEnabled());
    setLeadDays(notif.getReminderLeadDays());
  }, [notif]);

  const toRows = () =>
    recurringRows.map((r) => ({ id: r.id, name: r.name, amount: r.amount, dayOfMonth: r.dayOfMonth, type: r.type }));

  const onToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    const result = await notif.setRemindersEnabled(next, toRows());
    if (next && result === 'denied') {
      setEnabled(false);
      Alert.alert(t('voice.permissionDenied'), t('me.biometric.hintUnsupported'));
    }
  };

  const eligible = recurringRows.filter((r) => r.type === 'expense').length;
  return (
    <>
      <SettingRow
        label={t('notifications.title')}
        hint={enabled ? t('notifications.hint.enabled', { lead: leadDays, count: eligible }) : t('notifications.hint')}
        icon="bell-outline"
        iconColor={enabled ? theme.accent : theme.text2}
        trailing={<Toggle on={enabled} onToggle={() => void onToggle()} />}
      />
      {enabled && (
        <SettingRow
          label={t('notifications.leadDays')}
          value={t('notifications.leadDays.value', { n: leadDays })}
          icon="clock-outline"
          iconColor={theme.text2}
          onPress={() => setPickerOpen(true)}
        />
      )}
      <PickerSheet
        visible={pickerOpen}
        title={t('notifications.leadDays')}
        options={[0, 1, 2, 3, 5, 7].map<PickerOption<string>>((n) => ({
          value: String(n),
          label: n === 0 ? t('notifications.leadDays.sameDay') : t('notifications.leadDays.value', { n }),
        }))}
        selected={String(leadDays)}
        onPick={async (raw) => {
          const n = parseInt(raw, 10);
          setLeadDays(n);
          await notif.setReminderLeadDays(n, toRows());
        }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

function ExportRow() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [lastExport, setLastExport] = useState<number>(() => Number(kv.get('lastExportAt') ?? 0));
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const now = new Date();
  const markExported = () => {
    const ts = Date.now();
    kv.set('lastExportAt', String(ts));
    setLastExport(ts);
  };
  // Only the JSON dump is a restorable backup; CSV / PDF are reports.
  const run = (fmt: string) => {
    if (fmt === 'json') void exportData('json').then(markExported).catch(() => {});
    else if (fmt === 'csv') void exportData('csv').catch(() => {});
    else if (fmt === 'pdfMonth') void exportMonthlyPdf(monthKeyOf(now), currency).catch(() => {});
    else void exportYearlyPdf(now.getFullYear(), currency).catch(() => {});
  };
  const lastHint = lastExport
    ? t('settings.export.lastBackup', { when: new Date(lastExport).toLocaleDateString() })
    : t('settings.export.never');
  return (
    <>
      <SettingRow
        label={t('settings.export.title')}
        hint={lastHint}
        icon="export"
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title={t('settings.export.title')}
        options={[
          { value: 'json', label: t('me.export.json'), hint: t('settings.export.hint.json'), icon: 'code-json' },
          { value: 'csv', label: t('me.export.csv'), hint: t('settings.export.hint.csv'), icon: 'table' },
          { value: 'pdfMonth', label: t('me.export.pdfMonth'), hint: formatMonthYear(now), icon: 'file-pdf-box' },
          { value: 'pdfYear', label: t('me.export.pdfYear'), hint: String(now.getFullYear()), icon: 'file-document-multiple-outline' },
        ] as PickerOption<string>[]}
        selected=""
        onPick={(v) => run(v)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// ─────────────────────────── Advanced ───────────────────────────

function ImportRow() {
  const t = useT();
  return (
    <SettingRow
      label={t('me.import.json')}
      hint={t('me.import.json.hint')}
      icon="import"
      iconColor={theme.text2}
      onPress={() => {
        void importData().catch((e: unknown) => {
          Alert.alert(t('me.import.failed.title'), e instanceof Error ? e.message : String(e));
        });
      }}
    />
  );
}

function DemoProfileRow() {
  const t = useT();
  const onPress = () => {
    Alert.alert(t('settings.demo.title'), t('settings.demo.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.demo.cta'),
        onPress: () => {
          try {
            rebuildDemoProfile();
          } catch (e) {
            Alert.alert('Demo profile', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };
  return (
    <SettingRow
      label={t('settings.demo.label')}
      hint={t('settings.demo.hint')}
      icon="flask-outline"
      iconColor={theme.text2}
      onPress={onPress}
    />
  );
}

// ─────────────────────────── About ───────────────────────────

function AboutSection() {
  const t = useT();
  return (
    <View style={styles.group}>
      <SectionHeader title={t('me.section.about')} />
      <SettingRow
        label={APP_NAME}
        value={t('me.version', {
          v: `${Constants.expoConfig?.version ?? '1.0.0'} (${
            Platform.OS === 'ios'
              ? Constants.expoConfig?.ios?.buildNumber ?? '—'
              : String(Constants.expoConfig?.android?.versionCode ?? '—')
          })`,
        })}
        icon="information-outline"
        iconColor={theme.text2}
      />
      <SettingRow label={t('me.privacyPolicy')} icon="shield-lock-outline" iconColor={theme.text2} onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})} />
      <SettingRow label={t('me.terms')} icon="file-document-outline" iconColor={theme.text2} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} />
      <SettingRow label={t('me.support')} hint={SUPPORT_EMAIL} icon="email-outline" iconColor={theme.text2} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})} />
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  group: { gap: spacing.sm },
  profileCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    gap: spacing.md,
  },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  profileName: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  profileSub: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  editBtnText: { fontSize: sizes.xs, fontFamily: font.bodySemi },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg1,
    maxWidth: 160,
  },
  chipAdd: { borderStyle: 'dashed', borderColor: `${theme.accent}66` },
  chipText: { color: theme.text2, fontSize: sizes.xs, fontFamily: font.bodySemi },
  iconBtn: { padding: 4 },
  segment: {
    flexDirection: 'row',
    backgroundColor: theme.bg3,
    borderRadius: radii.pill,
    padding: 2,
    gap: 2,
  },
  segBtn: { width: 34, height: 28, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  segBtnActive: { backgroundColor: theme.accent },
  disclaimer: {
    color: theme.text3,
    fontSize: sizes.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    lineHeight: 16,
  },
});
