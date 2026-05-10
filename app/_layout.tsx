// Root layout: fonts, DB boot, biometric lock gate, RTL commit.
// Wraps everything in GestureHandlerRootView + SafeAreaProvider.

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { I18nManager, View, Text, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { IS_ISLAMIC } from '@/constants/flavor';
import { theme } from '@/constants/theme';
import { bootAppData } from '@/hooks/useAppData';
import { useAppLock, isBiometricEnabled } from '@/hooks/useBiometricLock';
import { kv } from '@/utils/kv';
import { LockScreen } from '@/components/LockScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HomeSkeleton } from '@/components/Skeleton';
import { setLocale, type LocaleCode } from '@/utils/i18n';
import { ensureDefaultProfile } from '@/utils/profiles';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Fonts: core for both flavors. Arabic font only for islamic — using INLINE
  // process.env check (NOT via IS_ISLAMIC constant) so Babel's
  // transform-inline-environment-variables folds this to a literal `false`
  // before Metro's minifier sees it. This way the entire @expo-google-fonts/
  // ibm-plex-sans-arabic package — including its asset path strings — is
  // physically excluded from the generic bundle.
  const arabicFontMap =
    process.env.APP_FLAVOR === 'islamic'
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@expo-google-fonts/ibm-plex-sans-arabic')
      : {};

  const [fontsLoaded] = useFonts({
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    ...(process.env.APP_FLAVOR === 'islamic'
      ? { IBMPlexSansArabic_500Medium: arabicFontMap.IBMPlexSansArabic_500Medium }
      : {}),
  });

  const [dbReady, setDbReady] = useState(false);
  useEffect(() => {
    // Sync the i18n active locale with whatever the user picked previously.
    const stored = kv.get('locale') as LocaleCode | undefined;
    if (stored) setLocale(stored);
    // Make sure a profile exists before bootAppData opens its .db file.
    ensureDefaultProfile();
    bootAppData().then(() => {
      // Dev backdoor: skip onboarding when EXPO_PUBLIC_BYPASS_ONBOARDING=1.
      // Babel inlines process.env.EXPO_PUBLIC_BYPASS_ONBOARDING at build time,
      // and __DEV__ is a Metro-injected boolean. In production builds, the
      // entire branch dead-code-eliminates. Useful when smoke-testing past
      // onboarding without 3 taps each cycle.
      if (__DEV__ && process.env.EXPO_PUBLIC_BYPASS_ONBOARDING === '1') {
        if (!kv.getBool('onboardingCompleted', false)) {
          kv.setBool('onboardingCompleted', true);
          if (!kv.get('locale')) kv.set('locale', 'en-US');
          if (!kv.get('currency')) kv.set('currency', 'USD');
        }
      }
      setDbReady(true);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, dbReady]);

  // RTL commit — see §3.3. Only runs on islamic, locale-driven, once per locale.
  // In v1 we only force RTL if user explicitly selected Arabic in onboarding.
  useEffect(() => {
    if (!IS_ISLAMIC || Platform.OS === 'web') return;
    const chosen = kv.get('locale');
    if (!chosen) return;
    const shouldBeRTL = chosen.startsWith('ar');
    if (shouldBeRTL !== I18nManager.isRTL && kv.get('rtlSetForLocale') !== chosen) {
      I18nManager.forceRTL(shouldBeRTL);
      kv.set('rtlSetForLocale', chosen);
      // Updates.reloadAsync() would go here; left commented to avoid the SDK 50+ reload loop
      // in dev. In production builds, uncomment.
      // import('expo-updates').then(u => u.reloadAsync()).catch(() => {});
    }
  }, []);

  if (!fontsLoaded || !dbReady) {
    // Skeleton placeholder so the user never stares at a blank screen
    // between splash dismissal and first real frame. The splash itself
    // covers most of the boot — this catches the brief font-loading +
    // DB-seed window after splash hides.
    return (
      <View style={styles.root}>
        <HomeSkeleton />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary>
          <LockGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
            </Stack>
          </LockGate>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Mount LockScreen only if biometric is enabled.
function LockGate({ children }: { children: React.ReactNode }) {
  if (!isBiometricEnabled()) return <>{children}</>;
  return <LockGateInner>{children}</LockGateInner>;
}

function LockGateInner({ children }: { children: React.ReactNode }) {
  const { locked, unlock } = useAppLock();
  if (locked) return <LockScreen onUnlock={unlock} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
});
