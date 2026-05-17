// First-launch onboarding: language picker (step 1) → currency picker
// (step 2). Both steps pre-select a detected default plus 3-6 regional
// alternatives, with a "More" affordance that opens a searchable list
// covering the full set. Selecting an RTL language flips layout before
// advancing to step 2. Both selections are required.

import React, { useMemo, useState } from 'react';
import {
  FlatList,
  I18nManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Localization from 'expo-localization';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import {
  CURRENCIES,
  type CurrencyCode,
} from '@/constants/currency';
import {
  defaultCurrencyForRegion,
  defaultLocaleForRegion,
  currencyAlternativesFor,
} from '@/constants/regionCurrency';
import {
  LOCALES,
  languageAlternativesForRegion,
  localeSearchHaystack,
  normalizeQuery,
  type LocaleDef,
} from '@/constants/locales';
import { kv } from '@/utils/kv';
import { setLocale as setI18nLocale, type LocaleCode } from '@/utils/i18n';
import { useT } from '@/hooks/useT';

// Pick the closest supported locale for a system locale. Exact match
// first, then region-driven, then language-prefix, finally en-US.
function detectLocale(): LocaleCode {
  const sys = Localization.getLocales()[0];
  if (!sys) return 'en-US';
  const sysCode = sys.languageTag;
  if (LOCALES.some((l) => l.code === sysCode)) return sysCode as LocaleCode;
  const regionLocale = defaultLocaleForRegion(sys.regionCode, '');
  if (regionLocale && LOCALES.some((l) => l.code === regionLocale)) {
    return regionLocale as LocaleCode;
  }
  const langPrefix = sys.languageCode + '-';
  const byLang = LOCALES.find((l) => l.code.startsWith(langPrefix));
  if (byLang) return byLang.code;
  return 'en-US';
}

function detectCurrency(localeOverride?: LocaleCode): CurrencyCode {
  // Locale-driven first (kk-KZ → KZT, ru-RU → RUB, …) — matches the spec's
  // priority order: "Selected language locale > IP geolocation > USD".
  const fromLocale = localeOverride ?? detectLocale();
  const region = fromLocale.split('-')[1]?.toUpperCase();
  const fromRegion = region ? defaultCurrencyForRegion(region) : null;
  if (fromRegion && fromRegion !== 'USD') return fromRegion;
  // Fall back to device's reported currency, then region inference.
  const sys = Localization.getLocales()[0];
  const c = (sys?.currencyCode ?? '').toUpperCase();
  if (c && c in CURRENCIES) return c as CurrencyCode;
  return defaultCurrencyForRegion(sys?.regionCode);
}

export default function Onboarding() {
  const router = useRouter();
  const t = useT();

  // Auto-detect from device locale + region. User can override either.
  const initialLocale = useMemo<LocaleCode>(() => {
    const detected = detectLocale();
    setI18nLocale(detected);
    return detected;
  }, []);
  const [locale, setLocale] = useState<LocaleCode>(initialLocale);
  const [currency, setCurrency] = useState<CurrencyCode>(() => detectCurrency(initialLocale));
  const [step, setStep] = useState<'language' | 'currency'>('language');

  const region = Localization.getLocales()[0]?.regionCode ?? null;

  function pickLanguage(code: LocaleCode) {
    setLocale(code);
    setI18nLocale(code);
    // Step 1 → Step 2: re-derive currency from the chosen language so
    // a user who picks kk-KZ from a US device still lands on KZT.
    setCurrency(detectCurrency(code));
    // Flip RTL immediately so step 2 already reads in the right direction.
    if (Platform.OS !== 'web') {
      const shouldBeRTL = LOCALES.find((l) => l.code === code)?.rtl ?? false;
      if (shouldBeRTL !== I18nManager.isRTL && kv.get('rtlSetForLocale') !== code) {
        I18nManager.forceRTL(shouldBeRTL);
        kv.set('rtlSetForLocale', code);
      }
    }
    setStep('currency');
  }

  async function finish() {
    kv.set('locale', locale);
    kv.set('currency', currency);
    kv.setBool('onboardingCompleted', true);
    // RTL was already committed when the user picked the language at
    // step 1 — but if Updates.reloadAsync was not available then, we
    // still need a reload here for the flip to take visual effect.
    if (Platform.OS !== 'web') {
      const shouldBeRTL = locale.startsWith('ar') || locale.startsWith('he')
        || locale.startsWith('fa') || locale.startsWith('ur');
      if (shouldBeRTL !== I18nManager.isRTL) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Updates = require('expo-updates');
          await Updates.reloadAsync();
          return;
        } catch {
          /* dev: router.replace below still works visually */
        }
      }
    }
    router.replace('/');
  }

  if (step === 'language') {
    return (
      <LanguageStep
        detected={locale}
        region={region}
        onPick={pickLanguage}
        t={t}
      />
    );
  }

  return (
    <CurrencyStep
      currency={currency}
      onChangeCurrency={setCurrency}
      onBack={() => setStep('language')}
      onFinish={finish}
      t={t}
    />
  );
}

// ────────────────────────────────────────────────────────────────────
// Step 1 — Language
// ────────────────────────────────────────────────────────────────────

function LanguageStep({
  detected,
  region,
  onPick,
  t,
}: {
  detected: LocaleCode;
  region: string | null;
  onPick: (code: LocaleCode) => void;
  t: (k: string) => string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const detectedDef = LOCALES.find((l) => l.code === detected) ?? LOCALES[0];
  const altCodes = languageAlternativesForRegion(region, detected);
  const alts = altCodes
    .map((c) => LOCALES.find((l) => l.code === c))
    .filter((l): l is LocaleDef => !!l);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.scroll}>
        <View style={styles.brandWrap}>
          <Text style={styles.welcome}>{t('onboarding.welcome')}</Text>
          <Text style={styles.brand}>{APP_NAME}</Text>
        </View>

        <Text style={styles.section}>{t('onboarding.chooseLanguage')}</Text>

        <Pressable
          onPress={() => onPick(detectedDef.code)}
          style={[styles.option, styles.optionActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
        >
          <Text style={[styles.optionText, { color: theme.bg }]}>{detectedDef.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {detectedDef.rtl && <Text style={[styles.rtl, { color: theme.bg }]}>RTL</Text>}
            <MaterialCommunityIcons name="check" size={20} color={theme.bg} />
          </View>
        </Pressable>

        <View style={{ gap: 8, marginTop: spacing.md }}>
          {alts.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => onPick(l.code)}
              style={styles.option}
              accessibilityRole="button"
            >
              <Text style={styles.optionText}>{l.name}</Text>
              {l.rtl && <Text style={styles.rtl}>RTL</Text>}
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setSearchOpen(true)}
          style={styles.moreLink}
          accessibilityRole="button"
        >
          <Text style={styles.moreLinkText}>{t('onboarding.moreLanguages')}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.accent} />
        </Pressable>
      </View>

      <LanguageSearchModal
        visible={searchOpen}
        selected={detected}
        onClose={() => setSearchOpen(false)}
        onPick={(c) => {
          setSearchOpen(false);
          onPick(c);
        }}
        t={t}
      />
    </SafeAreaView>
  );
}

function LanguageSearchModal({
  visible,
  selected,
  onClose,
  onPick,
  t,
}: {
  visible: boolean;
  selected: LocaleCode;
  onClose: () => void;
  onPick: (code: LocaleCode) => void;
  t: (k: string) => string;
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = normalizeQuery(query);
    if (!q) return LOCALES;
    return LOCALES.filter((l) => localeSearchHaystack(l).includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text1} />
          </Pressable>
          <Text style={styles.modalTitle}>{t('onboarding.chooseLanguage')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={16} color={theme.text3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('currencyPicker.search')}
            placeholderTextColor={theme.text3}
            style={styles.search}
            autoCorrect={false}
            autoFocus
          />
        </View>
        <FlatList
          data={list}
          keyExtractor={(l) => l.code}
          renderItem={({ item }) => {
            const picked = item.code === selected;
            return (
              <Pressable onPress={() => onPick(item.code)} style={styles.modalRow}>
                <Text style={[styles.modalRowName, picked && { color: theme.accent }]}>
                  {item.name}
                </Text>
                {item.rtl && <Text style={styles.rtl}>RTL</Text>}
                {picked && (
                  <MaterialCommunityIcons name="check" size={18} color={theme.accent} />
                )}
              </Pressable>
            );
          }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────
// Step 2 — Currency
// ────────────────────────────────────────────────────────────────────

function CurrencyStep({
  currency,
  onChangeCurrency,
  onBack,
  onFinish,
  t,
}: {
  currency: CurrencyCode;
  onChangeCurrency: (c: CurrencyCode) => void;
  onBack: () => void;
  onFinish: () => void;
  t: (k: string) => string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const altCodes = currencyAlternativesFor(currency);
  const def = CURRENCIES[currency];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.scroll}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn} accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.text1} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>

        <Text style={styles.section}>{t('onboarding.chooseCurrency')}</Text>

        <Pressable
          onPress={() => {}}
          style={[styles.option, styles.optionActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionText, { color: theme.bg }]}>
              {currency} · {def.symbolNative}  {def.name}
            </Text>
          </View>
          <MaterialCommunityIcons name="check" size={20} color={theme.bg} />
        </Pressable>

        <View style={{ gap: 8, marginTop: spacing.md }}>
          {altCodes.map((c) => {
            const d = CURRENCIES[c];
            return (
              <Pressable
                key={c}
                onPress={() => onChangeCurrency(c)}
                style={styles.option}
                accessibilityRole="button"
              >
                <Text style={styles.optionText}>
                  {c} · {d.symbolNative}  {d.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setSearchOpen(true)}
          style={styles.moreLink}
          accessibilityRole="button"
        >
          <Text style={styles.moreLinkText}>{t('onboarding.searchCurrency')}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.accent} />
        </Pressable>

        <Pressable onPress={onFinish} style={styles.cta} accessibilityRole="button">
          <Text style={styles.ctaText}>{t('onboarding.getStarted')}</Text>
        </Pressable>
      </View>

      <CurrencySearchModal
        visible={searchOpen}
        selected={currency}
        onClose={() => setSearchOpen(false)}
        onPick={(c) => {
          setSearchOpen(false);
          onChangeCurrency(c);
        }}
        t={t}
      />
    </SafeAreaView>
  );
}

function CurrencySearchModal({
  visible,
  selected,
  onClose,
  onPick,
  t,
}: {
  visible: boolean;
  selected: CurrencyCode;
  onClose: () => void;
  onPick: (c: CurrencyCode) => void;
  t: (k: string) => string;
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const allCodes = Object.keys(CURRENCIES) as CurrencyCode[];
    const q = normalizeQuery(query);
    if (!q) return allCodes;
    // Score rows: exact-code = 0, starts-with = 1, contains = 2.
    const scored = allCodes
      .map((c) => {
        const d = CURRENCIES[c];
        const codeLow = c.toLowerCase();
        const nameLow = d.name.toLowerCase();
        const sym = d.symbolNative.toLowerCase();
        if (codeLow === q) return [c, 0] as const;
        if (codeLow.startsWith(q) || nameLow.startsWith(q)) return [c, 1] as const;
        if (codeLow.includes(q) || nameLow.includes(q) || sym.includes(q)) {
          return [c, 2] as const;
        }
        return [c, -1] as const;
      })
      .filter(([, s]) => s >= 0)
      .sort((a, b) => a[1] - b[1])
      .map(([c]) => c);
    return scored;
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text1} />
          </Pressable>
          <Text style={styles.modalTitle}>{t('onboarding.chooseCurrency')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={16} color={theme.text3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('currencyPicker.search')}
            placeholderTextColor={theme.text3}
            style={styles.search}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />
        </View>
        <FlatList
          data={list}
          keyExtractor={(c) => c}
          renderItem={({ item }) => {
            const d = CURRENCIES[item];
            const picked = item === selected;
            return (
              <Pressable onPress={() => onPick(item)} style={styles.modalRow}>
                <Text style={[styles.modalCode, picked && { color: theme.accent }]}>{item}</Text>
                <Text style={[styles.modalSymbol, picked && { color: theme.accent }]}>
                  {d.symbolNative}
                </Text>
                <Text style={[styles.modalRowName, { flex: 1 }, picked && { color: theme.accent }]}>
                  {d.name}
                </Text>
                {picked && (
                  <MaterialCommunityIcons name="check" size={18} color={theme.accent} />
                )}
              </Pressable>
            );
          }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  brandWrap: { marginBottom: spacing.lg },
  welcome: { color: theme.text2, fontSize: sizes.md, marginTop: spacing.lg },
  brand: { color: theme.text1, fontSize: 48, fontFamily: font.displayBold },
  section: {
    color: theme.text2,
    fontSize: sizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  optionActive: { backgroundColor: theme.accent, borderColor: 'transparent' },
  optionText: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  rtl: { color: theme.warning, fontSize: sizes.xs, fontFamily: font.bodySemi },
  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  moreLinkText: { color: theme.accent, fontSize: sizes.md, fontFamily: font.bodySemi },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  backText: { color: theme.text1, fontSize: sizes.md },
  cta: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  ctaText: { color: theme.bg, fontSize: sizes.lg, fontWeight: '700' },
  // search modal
  modalSafe: { flex: 1, backgroundColor: theme.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalTitle: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 8,
    backgroundColor: theme.bg2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  search: {
    flex: 1,
    color: theme.text1,
    fontSize: sizes.sm,
    fontFamily: font.body,
    paddingVertical: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  modalRowName: { color: theme.text1, fontSize: sizes.md, flex: 1 },
  modalCode: { color: theme.text2, fontSize: sizes.sm, width: 50, fontFamily: font.bodySemi },
  modalSymbol: { color: theme.text3, fontSize: sizes.md, width: 40 },
});
