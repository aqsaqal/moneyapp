// Theme — ported from v4 lines 17-21 (CSS custom properties).
// PRIMARY_COLOR comes from flavor.ts so the Islamic flavor's #00C9A7 flows through
// automatically without any conditional UI code.

import { PRIMARY_COLOR } from './flavor';

export const theme = {
  bg: '#08080F',
  bg1: '#0E0E18',
  bg2: '#161622',
  bg3: '#1E1E2E',
  bg4: '#282840',

  accent: PRIMARY_COLOR,
  accentDim: `${PRIMARY_COLOR}20`,
  accentMid: `${PRIMARY_COLOR}44`,

  income: PRIMARY_COLOR,
  expense: '#FF6B8A',
  warning: '#FFBE44',
  indigo: '#818CF8',
  transfer: '#60A5FA',

  text1: '#EAEAF2',
  text2: '#8888AA',
  text3: '#55556A',

  border: '#252538',

  // Islamic-flavor only (gold). In generic builds this value is present as a
  // constant but never read — it's not a security secret.
  gold: '#D4AF37',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  pill: 999,
} as const;

export const font = {
  display: 'Outfit_700Bold',
  displayBold: 'Outfit_800ExtraBold',
  body: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  arabic: 'IBMPlexSansArabic_500Medium',
} as const;

/**
 * Phase 8: pick the right text font for the user's locale.
 * Returns IBM Plex Sans Arabic for ar-* locales (islamic flavor only — the
 * Arabic font isn't shipped in generic; tree-shake guarantee). Otherwise
 * returns the default Latin body font.
 *
 * Components that mix Arabic + Latin text (e.g., HijriGregorianHero) should
 * call this per-Text rather than at the StyleSheet level so each Text segment
 * picks the right glyph file.
 */
export function localizedFont(locale: string | null | undefined): string {
  if (locale && locale.startsWith('ar') && process.env.APP_FLAVOR === 'islamic') {
    return font.arabic;
  }
  return font.body;
}

export function localizedDisplayFont(locale: string | null | undefined): string {
  if (locale && locale.startsWith('ar') && process.env.APP_FLAVOR === 'islamic') {
    // IBM Plex Sans Arabic doesn't ship a separate display weight in our
    // package; reuse the medium for now. Headings still scale via fontSize.
    return font.arabic;
  }
  return font.displayBold;
}

export const sizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 42,
} as const;
