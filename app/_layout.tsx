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

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Fonts: core for both flavors; Arabic only for islamic.
  const arabicFonts = IS_ISLAMIC
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@expo-google-fonts/ibm-plex-sans-arabic')
    : {};

  const [fontsLoaded] = useFonts({
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    ...(IS_ISLAMIC
      ? { IBMPlexSansArabic_500Medium: arabicFonts.IBMPlexSansArabic_500Medium }
      : {}),
  });

  const [dbReady, setDbReady] = useState(false);
  useEffect(() => {
    bootAppData().then(() => setDbReady(true));
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
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LockGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
          </Stack>
        </LockGate>
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
