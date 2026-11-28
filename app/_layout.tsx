// Root layout: fonts, DB boot, biometric lock gate, RTL commit.
// Wraps everything in GestureHandlerRootView + SafeAreaProvider.

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { I18nManager, View, Text, StyleSheet, Platform, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { IS_ISLAMIC } from '@/constants/flavor';
import { theme, activeThemeIsLight } from '@/constants/theme';
import { initPro } from '@/utils/pro';
import { WidgetSync } from '@/components/WidgetSync';
import { bootAppData } from '@/hooks/useAppData';
import { useAppLock, isBiometricEnabled } from '@/hooks/useBiometricLock';
import { kv } from '@/utils/kv';
import { LockScreen } from '@/components/LockScreen';
import { ToastHost } from '@/components/Toast';
import { useRouter } from 'expo-router';

/** Dev-only screenshot driver. With EXPO_PUBLIC_SCREENSHOT_CTL=1 the app
 *  polls http://localhost:8090/route.txt and navigates to whatever path
 *  it finds ("dismiss" closes modals). Lets a shell script walk every
 *  screen on the simulator without the iOS "Open in Flow?" prompt that
 *  `simctl openurl` triggers. Dead-code-eliminated in production. */
function ScreenshotController() {
  const router = useRouter();
  React.useEffect(() => {
    if (!(__DEV__ && process.env.EXPO_PUBLIC_SCREENSHOT_CTL === '1')) return;
    // No yellow "Open debugger" toast in captures.
    LogBox.ignoreAllLogs(true);
    let alive = true;
    let last = '';
    const tick = async () => {
      try {
        const r = await fetch('http://localhost:8090/route.txt', { cache: 'no-store' });
        const txt = (await r.text()).trim();
        if (txt && txt !== last) {
          last = txt;
          if (txt === 'dismiss') router.dismissAll();
          else if (txt.startsWith('profile:')) {
            // Switch to (creating if needed) a named profile — gives tests
            // a genuinely fresh database without tapping through Settings.
            const name = txt.slice('profile:'.length).trim();
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const P = require('@/utils/profiles') as typeof import('@/utils/profiles');
            const found = P.listProfiles().find((p) => p.name.toLowerCase() === name.toLowerCase())
              ?? P.createProfile({ name });
            if (found.id !== P.getActiveProfileId()) P.switchActiveProfile(found.id);
            console.log(`[screenshot-ctl] profile → ${found.name}`);
          }
          else if (txt === 'demo:rebuild') {
            // Regenerate the Demo profile's sample data relative to today
            // (store screenshots) and switch to it.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const D = require('@/utils/db/demoSeed') as typeof import('@/utils/db/demoSeed');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const P = require('@/utils/profiles') as typeof import('@/utils/profiles');
            const r = D.rebuildDemoProfile();
            const demo = P.listProfiles().find((p) => p.name.toLowerCase() === 'demo');
            if (demo && demo.id !== P.getActiveProfileId()) P.switchActiveProfile(demo.id);
            console.log(`[screenshot-ctl] demo rebuilt → ${JSON.stringify(r)}`);
          }
          else if (txt.startsWith('kv:')) {
            // kv:<key> logs a value; kv:<key>=<value> sets it; kv:<key>= deletes it.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { kv: K } = require('@/utils/kv') as typeof import('@/utils/kv');
            const body = txt.slice('kv:'.length);
            const eq = body.indexOf('=');
            if (eq < 0) console.log(`[screenshot-ctl] kv ${body} = ${JSON.stringify(K.get(body as never))}`);
            else if (eq === body.length - 1) K.delete(body.slice(0, eq) as never);
            else K.set(body.slice(0, eq) as never, body.slice(eq + 1) as never);
          }
          else if (txt.startsWith('pro:') || txt.startsWith('gate:')) {
            // pro:on|off|clear — fake the entitlement; gate:gated|grandfathered|clear.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Pro = require('@/utils/pro') as typeof import('@/utils/pro');
            const v = txt.split(':')[1].trim();
            if (txt.startsWith('pro:')) Pro.devSetPro(v === 'on' ? '1' : v === 'off' ? '0' : null);
            else Pro.devSetGate(v === 'gated' || v === 'grandfathered' ? v : null);
          }
          else if (txt.startsWith('mode:')) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { kv: K } = require('@/utils/kv') as typeof import('@/utils/kv');
            const v = txt.slice('mode:'.length).trim();
            // After the reload the controller re-reads the same command;
            // only reload when the value actually changes.
            if ((K.get('themeMode') ?? 'system') !== v) {
              K.set('themeMode', v);
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { DevSettings } = require('react-native') as typeof import('react-native');
              DevSettings.reload();
            }
          }
          else if (txt.startsWith('theme:')) {
            // Switch color theme (kv.themeId) and reload so StyleSheets pick it up.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { kv: K } = require('@/utils/kv') as typeof import('@/utils/kv');
            const v = txt.slice('theme:'.length).trim();
            if ((K.get('themeId') ?? 'mint') !== v) {
              K.set('themeId', v);
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { DevSettings } = require('react-native') as typeof import('react-native');
              DevSettings.reload();
            }
          }
          else if (txt.startsWith('locale:')) {
            // Switch the app language in place (store screenshots per language).
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const I = require('@/utils/i18n') as typeof import('@/utils/i18n');
            I.setLocale(txt.slice('locale:'.length).trim() as never);
          }
          else if (txt.startsWith('taborder:')) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const T = require('@/utils/tabOrder') as typeof import('@/utils/tabOrder');
            T.setTabOrder(txt.slice('taborder:'.length).split(',').map((x) => x.trim()) as never);
          }
          else if (txt.startsWith('import:')) {
            // Restore a backup file from the simulator's filesystem so
            // the import path can be exercised without the document picker.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const FS = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { importBackupJson } = require('@/utils/dataExport') as typeof import('@/utils/dataExport');
            const raw = await FS.readAsStringAsync(txt.slice('import:'.length));
            const res = await importBackupJson(raw, { skipConfirm: true });
            console.log(`[screenshot-ctl] import → ${res}`);
          }
          else router.push(txt as never);
        }
      } catch { /* server not up yet */ }
      if (alive) setTimeout(tick, 600);
    };
    void tick();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HomeSkeleton } from '@/components/Skeleton';
import { setLocale, type LocaleCode } from '@/utils/i18n';
import { ensureDefaultProfile, listProfiles, switchActiveProfile, getActiveProfileId } from '@/utils/profiles';

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
      // Pro gate + store connection. Before the dev bypass below, so a
      // fresh dev install is 'gated' like a fresh store install.
      try {
        initPro();
      } catch (e) {
        console.warn('[pro] init failed', e);
      }
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
        // EXPO_PUBLIC_DEV_PROFILE=<name> → start in that profile (e.g.
        // "Demo" for store screenshots). Dev-only, same DCE as above.
        const wanted = process.env.EXPO_PUBLIC_DEV_PROFILE;
        if (wanted) {
          const target = listProfiles().find((p) => p.name.toLowerCase() === wanted.toLowerCase());
          if (target && target.id !== getActiveProfileId()) switchActiveProfile(target.id);
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
    //
    // SafeAreaProvider is intentionally mounted on the boot path too,
    // so the skeleton header isn't tucked under the status bar / notch
    // on devices that boot fast enough to render this frame.
    return (
      <SafeAreaProvider>
        <View style={styles.root}>
          <HomeSkeleton />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style={activeThemeIsLight() ? 'dark' : 'light'} />
        <ErrorBoundary>
          <LockGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              {/* Smart Add stays at 1 ms fade so the FAB-tap-to-input
                  loop feels instant. Other modals share a 75 ms
                  slide_from_bottom — snappy enough to read as a popup
                  rather than a separate screen. */}
              <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'fade', animationDuration: 1 }} />
              <Stack.Screen name="split" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="insights" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="net-worth" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="account/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="event/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="account-balance" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              {/* Long-press → category-grid mirrors Smart Add's near-
                  instant fade so the picker pops up as quickly as the
                  short-press FAB → /add does. */}
              <Stack.Screen name="category-grid" options={{ presentation: 'modal', animation: 'fade', animationDuration: 1 }} />
              <Stack.Screen name="categories-manage" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: 75 }} />
              <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
            </Stack>
            <ToastHost />
            <WidgetSync />
            <ScreenshotController />
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
