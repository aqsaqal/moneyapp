# MoneyFlow — dual-flavor expense tracker

One Expo codebase that produces two distinct iOS/Android apps at build time:

| Flavor    | Display name | Bundle ID               | Accent    | Has Islamic features? |
|-----------|--------------|-------------------------|-----------|-----------------------|
| `generic` | Flow         | `com.moneyflow.generic` | `#00E09E` | No — physically excluded from the bundle |
| `islamic` | Amanah       | `com.amanah.app`        | `#00C9A7` | Yes — Zakat, Hijri dates, halal status, Sadaqa, Ramadan, 6 Islamic categories |

Generic builds **physically exclude** Islamic code via a four-layer pipeline; the verified bundle contains zero matches for `Zakat`, `Sadaqa`, `Hijri`, `Ramadan`, `nisab`, `hawl`, `mazhab`, `Qurban`, `Hajj`, `Amanah`, `mushbooh`, `haram`, `umalqura`, `adhan`, or `ibm-plex-sans-arabic`. Run [`npm run verify:tree-shake`](scripts/verify-tree-shake.sh) before any generic release.

## Quick start

```bash
# install deps
npm install --legacy-peer-deps

# generic flavor (Flow) on iOS sim
npm run ios:generic

# islamic flavor (Amanah) on iOS sim
npm run ios:islamic

# Android (requires AVD configured in Android Studio first)
npm run android:generic
npm run android:islamic

# verify tree-shake (4-layer raw-byte scan on Hermes bytecode)
npm run verify:tree-shake

# pure-math zakat tests (45 assertions including the spec's $10k → $250 anchor)
npm test
```

> **Node 18 caveat.** Expo SDK 54's Metro requires `Array.prototype.toReversed`, which is Node 20+. We polyfill it in [metro.config.js](metro.config.js); remove the polyfill when moving to Node 20.

> **Android first-build notes (read before `npm run android:*`):**
> 1. **NDK version override.** RN 0.81 defaults to NDK `27.1.12297006` (in `node_modules/react-native/gradle/libs.versions.toml`); Android Studio installs `30.0.14904198`. After `expo prebuild`, add `ext { ndkVersion = "30.0.14904198" }` to `android/build.gradle` **before** `apply plugin: "expo-root-project"` — that plugin reads `rootProject.ext.ndkVersion` at apply-time. The override doesn't survive a re-prebuild; reapply when you regenerate `android/`.
> 2. **Skia patch is mandatory.** NDK 30's clang flags a real dangling-pointer bug in `@shopify/react-native-skia/cpp/api/JsiSkImageFilterFactory.h:250`. We persist the fix via `patches/@shopify+react-native-skia+*.patch` and a `postinstall: patch-package` hook. `npm install` automatically applies it.
> 3. **APP_FLAVOR must reach gradle.** If you bypass `expo run:android` to invoke `./gradlew app:assembleDebug` directly, prefix `APP_FLAVOR=...` — the `expo-updates-gradle-plugin` re-evaluates `app.config.ts` at gradle time and bakes `assets/app.config` into the APK; without the env, it falls back to generic defaults (`name: "Flow"`, etc.).

## Layout

```
app/                          Expo Router screens (shared by both flavors)
  _layout.tsx                 fonts, DB boot, biometric gate, RTL commit
  (tabs)/                     Home, History, More + center FAB
  add.tsx                     transaction modal
  onboarding.tsx              first-launch language + currency picker
app-islamic/                  Islamic-only routes — copied into app/(islamic)/
                              by scripts/prepare-flavor.js when APP_FLAVOR=islamic
components/                   shared components (~15 files)
constants/                    flavor.ts, theme, categories, defaults, currency, icons
features/
  index.ts                    FeatureSlots contract + flavor-aware slot loading
  islamic/                    islamic-only features (entire dir excluded from generic)
    hijri/                    @umalqura/core wrapper + HijriDateBadge
    zakat/                    nisab, mazhab, hawl, ZakatCalculator, ZakatHomeCard
    halal/                    HalalStatusSheet + InlinePicker + FilterChip
    sadaqa/                   useSadaqaTotals + SadaqaScreen
    ramadan/                  adhan-js prayer times + RamadanHomeCard
    categories/               6 Islamic expense categories
hooks/                        useAppData (Drizzle), useStreak, useFrequentTxns,
                              useHaptics, useBiometricLock
utils/
  db/                         Drizzle schema + client + seed
  format.ts                   currency-aware formatters
  kv.ts                       MMKV wrapper
scripts/
  prepare-flavor.js           Layer 4 — copies app-islamic/ → app/(islamic)/
                              when APP_FLAVOR=islamic, removes for generic
  verify-tree-shake.sh        4-layer raw-byte scan
  run-tests.sh                lightweight test runner (no jest)
plan.md                       full implementation plan (Phases 1-5 + §6 decisions)
CLAUDE_CODE_PROMPT.md         original MVP spec (reference)
CLAUDE_CODE_PROMPT_DUAL_FLAVOR.md   dual-flavor spec (source of truth)
_legacy/moneyflow-v4.jsx      web React MVP (reference for UX details)
```

## Stack

| Concern        | Choice                                  | Notes |
|----------------|-----------------------------------------|-------|
| Framework      | Expo SDK 54 + Expo Router 6 + React 19  | TypeScript |
| Storage        | `expo-sqlite` + Drizzle ORM             | Indexed transactions, accounts, budgets, recurring, paid_items |
| Prefs / KV     | `react-native-mmkv` v4                  | currency, locale, biometric flag, RTL state |
| Charts         | `victory-native` v41 (Skia-backed)      | replaces v4's Recharts |
| Animations     | `react-native-reanimated` v4 + worklets | replaces v4's CSS keyframes |
| Icons          | `@expo/vector-icons` (MCC)              | mapped from v4's lucide via [constants/icons.tsx](constants/icons.tsx) |
| Haptics        | `expo-haptics`                          | numpad + submit + tab haptics |
| Auth           | `expo-local-authentication`             | opt-in biometric unlock |
| Hijri (islamic)| `@umalqura/core`                        | KACST Umm al-Qura tables |
| Prayer (islamic)| `adhan` (Batoul Apps)                  | offline computation, no third-party API by default |

## How tree-shaking works (4 layers)

```
Source: if (process.env.APP_FLAVOR === 'islamic') {
          slots = require('@/features/islamic/slots').islamicSlots;
        }

┌─ Layer 1: Babel inlines process.env.APP_FLAVOR ─────────────────┐
│   babel-plugin-transform-inline-environment-variables turns      │
│   the env read into a literal 'generic' or 'islamic'. Terser    │
│   then DCE's `if (false) { require(...) }` → nothing.            │
└──────────────────────────────────────────────────────────────────┘
                          ↓ if anything slips through
┌─ Layer 2: Metro resolver.resolveRequest → {type:'empty'} ────────┐
│   any surviving import of @/features/islamic/* resolves to       │
│   nothing. Catches dynamic require() and string-path imports.    │
└──────────────────────────────────────────────────────────────────┘
                          ↓ if a file still gets crawled
┌─ Layer 3: Metro resolver.blockList ──────────────────────────────┐
│   features/islamic/** and app-islamic/** invisible to Metro's    │
│   file-system resolver in generic builds.                        │
└──────────────────────────────────────────────────────────────────┘

┌─ Layer 4 (routes): scripts/prepare-flavor.js ────────────────────┐
│   Expo Router enumerates app/ structurally at build time —       │
│   independent of Metro resolvers. Islamic routes live in         │
│   app-islamic/ and are copied into app/(islamic)/ ONLY when      │
│   APP_FLAVOR=islamic.                                            │
└──────────────────────────────────────────────────────────────────┘
```

`IS_ISLAMIC` in [constants/flavor.ts](constants/flavor.ts) is a direct read of `process.env.APP_FLAVOR === 'islamic'` — **not** a `Constants.expoConfig.extra` lookup — so Babel can fold it. Don't refactor this to use the runtime expoConfig. Display-only values (`APP_NAME`, `PRIMARY_COLOR`) are runtime-okay and can come from `extra`.

## Verification

```bash
# 4-layer tree-shake (all must pass before generic release):
npm run verify:tree-shake
#   Layer A: plain-text assets / manifest grep
#   Layer B: Hermes .hbc raw-byte grep (NOT `strings` — misses pool entries)
#   Layer C: islamic-bundle sanity scan (catches false negatives)
#   Layer D: documented in script — `strings` on the final .ipa/.apk

# pure-math zakat tests:
npm test
#   45 assertions across constants, nisab, mazhab, hawl, and the
#   anchor case from plan.md §4.4: $10k cash + Hanafi + silver basis +
#   hawl complete → exactly $250 zakat due.
```

## Design tone (islamic flavor)

Per spec: no gamification, no riya. The Zakat calculator shows which mazhab rule applied and always shows the "consult your local scholar" disclaimer. The Sadaqa screen has no comparison to averages, no sharing, no streaks. Halal status is neutral metadata — never auto-inferred from category, no "haram warnings."

## Build phases

See [plan.md](plan.md) for the full phased approach. Commits map 1:1:

```
c275687  chore: add `npm run ios` and `android` shortcut scripts
b974962  Phase 5: tree-shake verification gate (4-layer raw-byte scan)
b39eef3  Phase 4: Islamic flavor features + verified tree-shake parity
55ee9ca  Phase 3: port v4 UI to native screens (generic flavor functional)
0fa452a  Phase 2: shared infrastructure (Drizzle schema, hooks, utils)
1cd6ecf  Phase 1: scaffold Expo dual-flavor app with 4-layer tree-shake
```
