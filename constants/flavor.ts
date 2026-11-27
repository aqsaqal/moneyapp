/**
 * Flavor detection — Layer 1 of the tree-shake pipeline.
 *
 * CRITICAL: `IS_ISLAMIC` MUST be a direct read of `process.env.APP_FLAVOR`.
 * Do NOT change this to `Constants.expoConfig.extra.flavor` — that's a runtime
 * lookup that Babel cannot fold. The `transform-inline-environment-variables`
 * plugin (see babel.config.js) replaces `process.env.APP_FLAVOR` with a literal
 * string at build time, so `IS_ISLAMIC` becomes a literal boolean before Metro's
 * minifier runs. Dead branches (`if (IS_ISLAMIC) { ... }` in generic builds) are
 * then eliminated along with their string literals and import sites.
 *
 * Display-only values (APP_NAME, PRIMARY_COLOR) can safely come from
 * Constants.expoConfig.extra since they're used at runtime only.
 */

import Constants from 'expo-constants';

// Compile-time constant via babel inline. Do NOT refactor to a runtime lookup.
export const IS_ISLAMIC: boolean = process.env.APP_FLAVOR === 'islamic';

// Runtime-okay values
const extra = (Constants.expoConfig?.extra ?? {}) as {
  flavor?: 'generic' | 'islamic';
  appName?: string;
  primaryColor?: string;
};

export const FLAVOR: 'generic' | 'islamic' = extra.flavor ?? (IS_ISLAMIC ? 'islamic' : 'generic');
export const APP_NAME: string = extra.appName ?? (IS_ISLAMIC ? 'Amanah' : 'Flow');
export const PRIMARY_COLOR: string = extra.primaryColor ?? (IS_ISLAMIC ? '#00C9A7' : '#00E09E');

/**
 * Demo builds (internal testers, the S26): Settings shows a "Demo
 * controls" group with Pro on/off and the pre-paywall switch. Inlined at
 * bundle time from EXPO_PUBLIC_DEMO_CONTROLS=1; store builds leave it
 * unset, so the group and its code are dead-code-eliminated.
 */
export const DEMO_CONTROLS: boolean = process.env.EXPO_PUBLIC_DEMO_CONTROLS === '1';
