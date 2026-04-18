// First-launch onboarding: language picker (drives RTL), currency picker.
// Persists choices in MMKV; commits forceRTL once and reloads if needed.

import React, { useState } from 'react';
import { I18nManager, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import { CURRENCIES, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';

const LOCALES = [
  { code: 'en-US', name: 'English', rtl: false },
  { code: 'ar-SA', name: 'العربية', rtl: true },
  { code: 'tr-TR', name: 'Türkçe', rtl: false },
  { code: 'id-ID', name: 'Bahasa Indonesia', rtl: false },
  { code: 'ms-MY', name: 'Bahasa Melayu', rtl: false },
];

export default function Onboarding() {
  const router = useRouter();
  const [locale, setLocale] = useState<string>('en-US');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  const finish = async () => {
    kv.set('locale', locale);
    kv.set('currency', currency);
    kv.setBool('onboardingCompleted', true);
    if (Platform.OS !== 'web') {
      const shouldBeRTL = locale.startsWith('ar');
      if (shouldBeRTL !== I18nManager.isRTL && kv.get('rtlSetForLocale') !== locale) {
        I18nManager.forceRTL(shouldBeRTL);
        kv.set('rtlSetForLocale', locale);
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Updates = require('expo-updates');
          await Updates.reloadAsync();
          return;
        } catch {
          // expo-updates not available in dev — direct router replace works
          // for visual change; full RTL flip will apply on next cold start.
        }
      }
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.welcome}>Welcome to</Text>
        <Text style={styles.brand}>{APP_NAME}</Text>

        <Text style={styles.section}>Choose Your Language</Text>
        <View style={{ gap: 8 }}>
          {LOCALES.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => setLocale(l.code)}
              style={[styles.option, locale === l.code && styles.optionActive]}
            >
              <Text style={[styles.optionText, locale === l.code && { color: theme.bg }]}>{l.name}</Text>
              {l.rtl && <Text style={styles.rtl}>RTL</Text>}
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Choose Your Currency</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => setCurrency(c)}
              style={[styles.chip, currency === c && { backgroundColor: theme.accent, borderColor: 'transparent' }]}
            >
              <Text style={[styles.chipText, currency === c && { color: theme.bg }]}>
                {c} · {CURRENCIES[c].symbolNative}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable onPress={finish} style={styles.cta}>
          <Text style={styles.ctaText}>Get Started</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  welcome: { color: theme.text2, fontSize: sizes.md, marginTop: spacing.xl },
  brand: { color: theme.text1, fontSize: 48, fontFamily: font.displayBold, marginBottom: spacing.lg },
  section: { color: theme.text2, fontSize: sizes.sm, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  optionActive: { backgroundColor: theme.accent, borderColor: 'transparent' },
  optionText: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  rtl: { color: theme.warning, fontSize: sizes.xs },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  chipText: { color: theme.text2, fontSize: sizes.sm },
  cta: { marginTop: spacing.xl, padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.accent, alignItems: 'center' },
  ctaText: { color: theme.bg, fontSize: sizes.lg, fontWeight: '700' },
});
