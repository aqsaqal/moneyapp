# MoneyFlow → Dual-Flavor Native App (iOS/Android)

## Context

**Why this change.** [moneyflow-v4.jsx](moneyflow-v4.jsx) is a single-file, 802-line web React MVP (Recharts, lucide-react, inline CSS, `window.storage`). It validated the product and UX. The spec [CLAUDE_CODE_PROMPT_DUAL_FLAVOR.md](CLAUDE_CODE_PROMPT_DUAL_FLAVOR.md) now calls for a native iOS/Android implementation built as **one Expo codebase producing two distinct apps** at build time:

- `generic` → "Flow" (`com.moneyflow.generic`, accent `#00E09E`) — same v4 features, mobile-native
- `islamic` → "Amanah" (`com.amanah.app`, accent `#00C9A7`) — v4 features + 6 Islamic features (Zakat calculator, Hijri dates, 6 Islamic expense categories, halal status per transaction, Sadaqa tracking, Ramadan seasonal mode)

**Hard constraint (from spec).** The generic bundle must physically exclude Islamic code. Verified by running `strings` on the final `.ipa`/`.apk` returning zero matches for `Zakat|Hijri|Sadaqa|nisab|Ramadan|halal|Amanah`. Not runtime-toggled — build-time excluded.

**User decisions locked in (from pre-plan Q&A).**
1. Build generic first (Phases 1-3), add Islamic in Phase 4.
2. Scaffold Expo project at `/Users/admin/dev/projects/moneyapp/` root; archive v4 to `_legacy/moneyflow-v4.jsx`.
3. Plumb multi-currency from day one (Islamic audience spans SAR/AED/MYR/IDR).
4. Ship full RTL support in v1 Islamic flavor (commits us to auditing every `flexDirection`/`marginLeft`).

**Timing.** Realistic: **Flow ready in 1-3 weeks** depending on polish level (raw functional parity ≈ 1 week; production-quality with RTL audit + device testing + animations ≈ 2-3 weeks). Amanah adds another 1-2 weeks layered on top.

**Scope additions to decide (§6 below).** Nine items not in the spec that matter for a 2026 finance app: biometric unlock, data export, transaction search, push notifications, onboarding, encryption at rest, accessibility pass, dark/light mode toggle, hawl-reset UX.

---

## Recommended approach

One Expo/TypeScript app. Flavor selection via env vars. **Three-layer build-time exclusion** enforces that Islamic code is physically absent from the generic bundle:

1. **Babel inlines `process.env.APP_FLAVOR`** so `if (IS_ISLAMIC)` becomes `if (false)` before Metro sees it (lets DCE drop branches).
2. **Metro `resolver.resolveRequest`** returns `{type:'empty'}` for `@/features/islamic/*` in generic builds (belt-and-suspenders — any import that survives Babel resolves to nothing).
3. **Metro `resolver.blockList`** regex hides `features/islamic/` from the file-system resolver entirely (coarsest net).

Plus a **prebuild script** (`scripts/prepare-flavor.js`) that materializes `app/(islamic)/*` routes only for Islamic builds — necessary because Expo Router's build-time route manifest is purely structural and would otherwise leak route names.

Core screens reference Islamic features only through opaque `<FeatureSlots.*/>` components that are no-op in generic builds.

**Stack (2026 choices).**
- Expo SDK (latest), Expo Router, TypeScript
- `expo-sqlite` with proper schema + **Drizzle ORM** for transactional data, `react-native-mmkv` for key-value prefs
- **`victory-native` v40+** (Skia-backed) for charts
- `@expo/vector-icons` (MaterialCommunityIcons)
- `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`
- `expo-local-authentication` (biometric), `expo-notifications`
- Outfit + Plus Jakarta Sans + IBM Plex Sans Arabic (islamic only)
- **`@umalqura/core`** (islamic only) — Hijri dates
- **`adhan-js`** (islamic only) — prayer times, offline-first; no third-party API calls

---

## Phase 1 — Scaffolding & flavor isolation

**Goal:** empty tab layout boots under both `start:generic` and `start:islamic` with correct bundle ID, display name, primary color. Three-layer tree-shake verified on a canary string.

### 1.1 Pre-work

```bash
cd /Users/admin/dev/projects/moneyapp
mkdir -p _legacy && mv moneyflow-v4.jsx _legacy/
# Keep CLAUDE_CODE_PROMPT*.md at root as reference.
```

### 1.2 Create project + dependencies

```bash
npx create-expo-app@latest . --template blank-typescript

# Shared core
npx expo install expo-router expo-sqlite expo-font expo-haptics \
  expo-constants expo-status-bar expo-splash-screen expo-localization \
  expo-updates expo-local-authentication expo-notifications \
  react-native-reanimated react-native-gesture-handler \
  react-native-safe-area-context react-native-screens \
  react-native-svg @shopify/react-native-skia \
  @expo/vector-icons

# Charts + storage
npm i victory-native drizzle-orm react-native-mmkv
npm i -D drizzle-kit

# Islamic-only (imported only from features/islamic/*)
npm i @umalqura/core adhan-js

# Fonts
npm i @expo-google-fonts/outfit @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/ibm-plex-sans-arabic

# Dev
npm i -D dotenv babel-plugin-transform-inline-environment-variables
```

### 1.3 Files to create

| File | Purpose |
|---|---|
| [app.config.ts](app.config.ts) | Replaces `app.json`. Reads env to set `name`, `ios.bundleIdentifier`, `android.package`, icon/splash paths per flavor. Delete the generated `app.json`. |
| [babel.config.js](babel.config.js) | `babel-preset-expo` + `babel-plugin-transform-inline-environment-variables` with allowlist `['APP_FLAVOR','FEATURES_ISLAMIC']` + `react-native-reanimated/plugin` last. **Essential for Layer 1 of tree-shaking.** |
| [metro.config.js](metro.config.js) | (a) `resolver.resolveRequest` returns `{type:'empty'}` for `@/features/islamic/*` when `APP_FLAVOR !== 'islamic'`. (b) `resolver.blockList: [/features\/islamic\//]` in generic. |
| [scripts/prepare-flavor.js](scripts/prepare-flavor.js) | **Prebuild step.** Copies `app-islamic/*` into `app/` before builds/exports when `APP_FLAVOR=islamic`; removes them for generic. Wired into every `start:*` / `build:*` script. |
| [.env.generic](.env.generic), [.env.islamic](.env.islamic) | Verbatim from spec lines 36-52 (`APP_FLAVOR`, `APP_NAME`, `APP_BUNDLE_ID`, `APP_SCHEME`, `PRIMARY_COLOR`, `FEATURES_ISLAMIC`). |
| [constants/flavor.ts](constants/flavor.ts) | Exports `FLAVOR`, `APP_NAME`, `PRIMARY_COLOR`, `IS_ISLAMIC`. **`IS_ISLAMIC` is a direct read of `process.env.APP_FLAVOR === 'islamic'`** (NOT `Constants.expoConfig.extra`) — this is what enables Babel inlining. Display-only values can come from `extra`. |
| [features/index.ts](features/index.ts) | `FeatureFlags` object + `FeatureSlots: FeatureSlotSet` with generic defaults (all `() => null`). Inside `if (IS_ISLAMIC) { slots = require('@/features/islamic/slots').islamicSlots; }` — Babel inlines the condition to `false` in generic, whole branch gets DCE'd. |
| [eas.json](eas.json) | Two profiles (`generic`, `islamic`) each setting the env vars. |
| [tsconfig.json](tsconfig.json) | Add `paths: { "@/*": ["./*"] }`. |
| [package.json](package.json) scripts | Every script sets `APP_FLAVOR` and runs `prepare-flavor.js` first. See §1.7. |

### 1.4 Three-layer exclusion — how it actually works

```
Source: if (IS_ISLAMIC) { require('@/features/islamic/slots').islamicSlots }

┌─ Layer 1: Babel inlines process.env.APP_FLAVOR ─────────────────┐
│ Source becomes: if ('generic' === 'islamic') { require(...) }    │
│                → if (false) { require(...) }                     │
│ Minifier's DCE strips the dead branch — import string is gone.   │
└──────────────────────────────────────────────────────────────────┘
                          ↓ (if anything slips through)
┌─ Layer 2: Metro resolver.resolveRequest → {type:'empty'} ────────┐
│ Any surviving import of @/features/islamic/* resolves to empty.  │
│ Catches dynamic requires, string-literal imports, edge cases.    │
└──────────────────────────────────────────────────────────────────┘
                          ↓ (if an .ts/.tsx file still got crawled)
┌─ Layer 3: Metro resolver.blockList regex ────────────────────────┐
│ features/islamic/** is invisible to the file-system resolver.    │
│ Final safety net.                                                │
└──────────────────────────────────────────────────────────────────┘

┌─ Layer 4 (routes): scripts/prepare-flavor.js ────────────────────┐
│ Expo Router's route manifest is purely structural — folder       │
│ presence alone leaks names. Prebuild copies app-islamic/ into    │
│ app/ only when APP_FLAVOR=islamic, removes for generic.          │
└──────────────────────────────────────────────────────────────────┘
```

**Why the plan needs all four layers.** Runtime `Constants.expoConfig.extra.flavor` is not a compile-time constant — Metro cannot fold it. Resolver empty-module alone leaves import strings in the bundle. Blocklist alone doesn't help dynamic requires. Expo Router ignores Metro resolvers during manifest generation. Each layer covers what the others miss.

### 1.5 FeatureSlots contract (authored once, frozen early)

```typescript
// features/index.ts — shape every core screen depends on
export interface FeatureSlotSet {
  HomeHeaderExtras: React.FC;                                    // Hijri date badge
  HomeExtras: React.FC;                                          // ZakatCard + RamadanCard
  MoreMenuItems: React.FC<{ onNavigate: (path: string) => void }>;// Zakat/Sadaqa entries
  AddTxExtras: React.FC<{ txDraft: Partial<Transaction>;          // halal selector during add
                          onChange: (patch: Partial<Transaction>) => void }>;
  TxActionSheetExtras: React.FC<{ txId: string }>;               // halal picker on long-press
  HistoryFilterExtras: React.FC<{ value: string|null; onChange: (v: string|null) => void }>;
  CategoryExtras: { expense: CategoryDef[]; income: CategoryDef[] };
}
```

Changing this contract after Phase 3 means touching every core screen. Get it right now.

### 1.6 `app.config.ts` skeleton

```typescript
import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const flavor = process.env.APP_FLAVOR ?? 'generic';
const isIslamic = flavor === 'islamic';

const config: ExpoConfig = {
  name: process.env.APP_NAME ?? 'Flow',
  slug: isIslamic ? 'amanah' : 'flow',
  scheme: process.env.APP_SCHEME ?? 'flow',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  icon: `./assets/${flavor}/icon.png`,
  splash: {
    image: `./assets/${flavor}/splash.png`,
    resizeMode: 'contain',
    backgroundColor: '#08080F',
  },
  ios: { bundleIdentifier: process.env.APP_BUNDLE_ID ?? 'com.moneyflow.generic', supportsTablet: false },
  android: {
    package: process.env.APP_BUNDLE_ID ?? 'com.moneyflow.generic',
    adaptiveIcon: { foregroundImage: `./assets/${flavor}/adaptive-icon.png`, backgroundColor: '#08080F' },
  },
  plugins: ['expo-router', 'expo-font', 'expo-sqlite', 'expo-notifications', 'expo-local-authentication'],
  experiments: { typedRoutes: true },
  extra: { flavor, appName: process.env.APP_NAME, primaryColor: process.env.PRIMARY_COLOR },
};

export default config;
```

### 1.7 `package.json` scripts

```json
{
  "scripts": {
    "prep:generic": "APP_FLAVOR=generic node scripts/prepare-flavor.js",
    "prep:islamic": "APP_FLAVOR=islamic node scripts/prepare-flavor.js",
    "start:generic": "npm run prep:generic && APP_FLAVOR=generic ENVFILE=.env.generic expo start -c",
    "start:islamic": "npm run prep:islamic && APP_FLAVOR=islamic ENVFILE=.env.islamic expo start -c",
    "ios:generic":   "npm run prep:generic && APP_FLAVOR=generic ENVFILE=.env.generic expo run:ios",
    "ios:islamic":   "npm run prep:islamic && APP_FLAVOR=islamic ENVFILE=.env.islamic expo run:ios",
    "android:generic": "npm run prep:generic && APP_FLAVOR=generic ENVFILE=.env.generic expo run:android",
    "android:islamic": "npm run prep:islamic && APP_FLAVOR=islamic ENVFILE=.env.islamic expo run:android",
    "build:generic:ios":     "npm run prep:generic && eas build --profile generic --platform ios",
    "build:generic:android": "npm run prep:generic && eas build --profile generic --platform android",
    "build:islamic:ios":     "npm run prep:islamic && eas build --profile islamic --platform ios",
    "build:islamic:android": "npm run prep:islamic && eas build --profile islamic --platform android",
    "verify:tree-shake": "bash scripts/verify-tree-shake.sh"
  }
}
```

### 1.8 Acceptance

- `npm run start:generic` boots empty tabs, display name "Flow", status bar dark.
- `npm run start:islamic` boots identically; display name "Amanah".
- **Canary test:** add `features/islamic/canary.ts` exporting `export const CANARY = "ZAKAT_TEST_STRING"`, import it from `features/index.ts` behind `IS_ISLAMIC`, run full verify-tree-shake pipeline (§5.1). All three layers must return clean for generic build, and the string MUST appear in the islamic build (sanity check that it's not a false negative from Hermes).

---

## Phase 2 — Shared infrastructure

**Goal:** data layer + theme + hooks ready. No UI yet.

### 2.1 Files to create (shared by both flavors)

| File | Role | Ported from v4 |
|---|---|---|
| [constants/theme.ts](constants/theme.ts) | Colors, spacing, radii, fonts. Imports `PRIMARY_COLOR` from `flavor.ts`. | Inline CSS vars at v4 lines 160-175 |
| [constants/categories.ts](constants/categories.ts) | `EXPENSE_CATEGORIES`, `INCOME_CATEGORIES`, plus `allExpenseCategories()` / `allIncomeCategories()` / `catInfo()` that merge in `FeatureSlots.CategoryExtras`. | v4 `ECAT`, `ICAT`, `catInfo()` — lines 45-72, 112 |
| [constants/defaults.ts](constants/defaults.ts) | `DEFAULT_ACCOUNTS`, `DEFAULT_BUDGETS`, `DEFAULT_RECURRING`, `seedTransactions()`. | v4 `DA`, `DBUDGETS`, `DRECURRING`, `SEED` IIFE — lines 76-110 |
| [constants/icons.ts](constants/icons.ts) | `ICON_MAP: Record<string,string>` — lucide name → MaterialCommunityIcons name. Plus `<Icon name="Utensils" size={16}/>` wrapper component. | Lucide imports at v4 lines 1-20 |
| [constants/currency.ts](constants/currency.ts) | Currency list (USD, SAR, AED, MYR, IDR, EUR, GBP), `CurrencyCode`, `formatMoney(amount, code, locale)` using `Intl.NumberFormat`. Replaces v4's hardcoded `$`. | v4 `fmt()`, `fmts()` — lines 112-113 |
| [utils/db/schema.ts](utils/db/schema.ts) | **Drizzle schema**: `transactions`, `accounts`, `budgets`, `recurring`, `paid_items` tables. Foreign keys + indexes on `(date)`, `(category)`, `(account_id)`. | — |
| [utils/db/client.ts](utils/db/client.ts) | Drizzle + `expo-sqlite` connection, `initDB()` runs migrations. | v4 `window.storage` calls — lines 165-180 |
| [utils/db/migrate.ts](utils/db/migrate.ts) | `drizzle-kit generate` wiring; first migration creates tables from §2.2. | — |
| [utils/kv.ts](utils/kv.ts) | `react-native-mmkv` wrapper for prefs (currency, locale, RTL-choice-made-flag, theme, etc.). | — |
| [utils/format.ts](utils/format.ts) | Re-exports `formatMoney` from currency + ports `dayStr()`. | v4 `fmt`, `fmts`, `dayStr` — line 114 |
| [hooks/useAppData.ts](hooks/useAppData.ts) | Exposes queries (`useTransactions()`, `useAccounts()`, `useBudgets()`) and mutations. Backed by Drizzle queries — **not** a single JSON blob in state. SWR-style cache keys. **Replaces ~25 v4 useStates.** | v4 lines 119-155 |
| [hooks/useStreak.ts](hooks/useStreak.ts) | Memoized streak calc from transactions query. | v4 `calcStreak` — line 215 |
| [hooks/useRecurring.ts](hooks/useRecurring.ts) | `markPaid(rec)` (creates transaction + debits account + inserts paid_items row), `unmarkPaid(rec)`, `add/edit/remove`. | v4 lines 221-236 |
| [hooks/useFrequentTxns.ts](hooks/useFrequentTxns.ts) | SQL `GROUP BY category, account_id, ROUND(amount,0), note ORDER BY COUNT(*) DESC LIMIT 4`. | v4 `frequentTxns` useMemo — lines 207-213 |
| [hooks/useHaptics.ts](hooks/useHaptics.ts) | Wraps `expo-haptics` for consistent feel across numpad, submit, tab switch. | new |
| [hooks/useBiometricLock.ts](hooks/useBiometricLock.ts) | Optional — wraps `expo-local-authentication`. Checks MMKV flag on app foreground. | new (§6 decision) |

### 2.2 Database schema (Drizzle)

```typescript
// utils/db/schema.ts
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['expense','income','transfer'] }).notNull(),
  amount: real('amount').notNull(),
  category: text('category'),                 // null for transfers
  accountId: text('account_id').notNull(),
  toAccountId: text('to_account_id'),         // transfer target
  note: text('note'),
  date: integer('date').notNull(),            // unix ms — indexed
  createdAt: integer('created_at').notNull(),
  halalStatus: text('halal_status'),          // optional; islamic only sets it, generic ignores
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['cash','bank','credit','savings'] }).notNull(),
  balance: real('balance').notNull(),
  creditLimit: real('credit_limit'),
});

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  limit: real('limit').notNull(),
});

export const recurring = sqliteTable('recurring', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['expense','income'] }).notNull(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  category: text('category'),
  accountId: text('account_id').notNull(),
  dayOfMonth: integer('day_of_month').notNull(),
});

export const paidItems = sqliteTable('paid_items', {
  id: text('id').primaryKey(),              // rec.id + '_' + monthKey
  recurringId: text('recurring_id').notNull(),
  monthKey: text('month_key').notNull(),    // 'YYYY-MM'
  transactionId: text('transaction_id').notNull(),
});
```

**Why schema, not JSON blob.** Every v4 analytics view (`expByCat`, `dailySpend`, `budgetSpending`, `frequentTxns`) is a SQL aggregation in disguise. With Drizzle these become indexed queries; with a JSON blob they become full-deserialize-then-reduce on every render. For an app expected to accumulate 1000+ transactions over a year of use, this is the difference between instant filters and sluggish ones.

### 2.3 Non-schema state (MMKV)

Theme, currency, locale, `rtl-set-for-locale`, `biometric-enabled`, `onboarding-completed`, `last-opened-screen`, feature flags. Typed wrapper in `utils/kv.ts`.

### 2.4 Islamic state (still SQLite, but a separate small table)

```typescript
// features/islamic/zakat/schema.ts — imported only in islamic builds
export const zakatState = sqliteTable('zakat_state', {
  id: integer('id').primaryKey(),   // singleton row id=1
  mazhab: text('mazhab').notNull(),
  nisabBasis: text('nisab_basis').notNull(),
  hawlStartDate: integer('hawl_start_date'),
  manualGold: real('manual_gold').default(0),
  manualSilver: real('manual_silver').default(0),
  manualInventory: real('manual_inventory').default(0),
  manualInvestments: real('manual_investments').default(0),
  manualReceivables: real('manual_receivables').default(0),
  manualDebts: real('manual_debts').default(0),
});
```

The migration runs only when `IS_ISLAMIC` — keep it conditional in `utils/db/migrate.ts` via `if (IS_ISLAMIC)` (Babel-inlined to `if (false)` in generic → dropped).

### 2.5 Acceptance

- `initDB` runs migrations; `drizzle-kit studio` opens the DB locally for inspection.
- `useTransactions({ month: '2026-04' })` returns seed data, filtered by SQL — verify in profiler that no deserialize-everything happens.
- MMKV prefs persist; launch-time reads < 1ms.
- Islamic flavor: `zakat_state` table exists; generic flavor: it does not.

---

## Phase 3 — Core UI port (generic-equivalent)

**Goal:** all v4 screens running on iOS and Android with haptics, persistence, and full RTL-ready styles.

### 3.1 Translation rules (apply throughout)

| v4 (web) | Native equivalent |
|---|---|
| `<div style={...}>` | `<View style={styles.x}>` (StyleSheet.create; inline only for dynamic values) |
| `<p>`, `<span>`, `<h1>` | `<Text>` with theme font + weight |
| `<button onClick>` | `<Pressable onPress>` + haptic on `onPressIn` |
| CSS `.nb:active {transform:scale(.9)}` | `<Pressable style={({pressed}) => [styles.x, pressed && {transform:[{scale:.94}]}]}>` |
| CSS `@keyframes` (8 of them at v4 lines 21-43) | `react-native-reanimated` `withTiming`/`withSpring`/`withSequence`/`withRepeat` |
| `<ResponsiveContainer><AreaChart>` | **`<CartesianChart>` + `<Line>`/`<Area>`** from Victory Native XL (Skia-backed) |
| `<PieChart>` | `<PolarChart>` from Victory Native XL |
| Lucide `<Utensils size={16}/>` | `<Icon name="Utensils" size={16}/>` (wrapper) → `<MaterialCommunityIcons name={ICON_MAP['Utensils']}/>` |
| `position:"fixed"` on FAB/tabs | FAB rendered inside tab bar layout; modals via Expo Router `presentation:'modal'` |
| `overflow:"auto"`, `maxHeight:"100vh"` | `<ScrollView>` inside `<SafeAreaView>` |
| CSS `var(--ac)` | `theme.accent` |
| Fixed `maxWidth:430` mobile canvas | drop — native owns device width |
| `window.storage` | Drizzle queries via `useAppData` hooks |
| `marginLeft`/`marginRight`/`paddingLeft`/`paddingRight`/`left`/`right` | **`marginStart`/`marginEnd`/`paddingStart`/`paddingEnd`/`start`/`end`** — RTL-safe from the start |

### 3.2 Files to create

| File | Ports from v4 |
|---|---|
| [app/_layout.tsx](app/_layout.tsx) | Font loading, `initDB`, Stack root. Biometric lock gate if enabled. RTL reload-loop-guard (see §3.3). |
| [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) | Custom tab bar with Home / FAB-middle / History / More. FAB routes to `/add`. |
| [app/(tabs)/index.tsx](app/(tabs)/index.tsx) | Ports `HomeView` (v4 lines 326-465). Mounts `<FeatureSlots.HomeHeaderExtras/>` inside header and `<FeatureSlots.HomeExtras/>` between BalanceCard and MonthlyBillsCard. |
| [app/(tabs)/history.tsx](app/(tabs)/history.tsx) | Ports `HistView` (v4 lines 546-558). `<Swipeable>` for delete. Search bar (§6 decision). Mounts `<FeatureSlots.HistoryFilterExtras/>` in filter row. |
| [app/(tabs)/more.tsx](app/(tabs)/more.tsx) | Ports `MoreView` (v4 lines 561-781). 4 sub-tabs. Mounts `<FeatureSlots.MoreMenuItems/>` at bottom of Recurring sub-tab. Settings section: currency, locale, biometric toggle, export data. |
| [app/add.tsx](app/add.tsx) | Ports `AddView` (v4 lines 468-543) as modal route. Numpad + category grid + account picker + quick-add pills + transfer mode. Mounts `<FeatureSlots.AddTxExtras/>` for inline halal selector. |
| [app/onboarding.tsx](app/onboarding.tsx) | First-launch flow: language picker, currency picker, seed-or-empty choice. One-time RTL commit (see §3.3). |
| [components/BalanceCard.tsx](components/BalanceCard.tsx) | v4 Home balance block (lines 347-395) |
| [components/CategoryGrid.tsx](components/CategoryGrid.tsx), [components/CategoryTile.tsx](components/CategoryTile.tsx), [components/CategoryDetailCard.tsx](components/CategoryDetailCard.tsx) | v4 lines 412-464. `CategoryTile` renders a crescent badge when `cat.isIslamic === true`. |
| [components/MiniTrendChart.tsx](components/MiniTrendChart.tsx) | v4 lines 404-411 — Victory Native `<CartesianChart>` with `<Area>` |
| [components/MonthlyBillsCard.tsx](components/MonthlyBillsCard.tsx), [components/ExpectedIncomeCard.tsx](components/ExpectedIncomeCard.tsx) | v4 Home recurring cards |
| [components/TransactionRow.tsx](components/TransactionRow.tsx) | v4 `TxRow` (lines 276-310). Long-press opens `<TxActionSheet>` → renders `<FeatureSlots.TxActionSheetExtras/>`. |
| [components/RecurringRow.tsx](components/RecurringRow.tsx) | v4 `RecRow` (lines 312-324) |
| [components/BudgetCard.tsx](components/BudgetCard.tsx), [components/AccountCard.tsx](components/AccountCard.tsx) | v4 More sub-tab content |
| [components/Numpad.tsx](components/Numpad.tsx) | v4 `numpad()` helper (line 217) — 3×4 grid. **Hardcoded LTR container** (see §3.3). |
| [components/QuickAdd.tsx](components/QuickAdd.tsx) | v4 quick-add pills (lines 486-498) |
| [components/AddRecurringSheet.tsx](components/AddRecurringSheet.tsx), [components/CategoryPickerSheet.tsx](components/CategoryPickerSheet.tsx) | v4 bottom-sheet dialogs |
| [components/SuccessOverlay.tsx](components/SuccessOverlay.tsx) | Reanimated port of `@keyframes checkPop` + confetti (v4 lines 27-28, 40-43) |
| [components/StreakBadge.tsx](components/StreakBadge.tsx) | Reanimated port of `@keyframes streakGlow` (line 30) |
| [components/FabButton.tsx](components/FabButton.tsx) | Reanimated port of `@keyframes pulseRing` (line 29) |
| [components/TxActionSheet.tsx](components/TxActionSheet.tsx) | Long-press menu: Delete / Edit note / mount `<FeatureSlots.TxActionSheetExtras/>` for halal picker |
| [components/SearchBar.tsx](components/SearchBar.tsx) | Debounced text input; drives `useTransactions({ search: '...' })` |

### 3.3 RTL checklist (mandatory audit — full RTL shipped in Islamic v1)

Performing this audit **during** Phase 3 while styles are fresh. Bolt-on later is 3× the work.

**Style conventions (do from start, not after audit):**
- [ ] Use `marginStart`/`marginEnd`/`paddingStart`/`paddingEnd` — never `Left`/`Right`.
- [ ] Use `start`/`end` positioning — never `left`/`right` (except when explicitly LTR-locked, see below).
- [ ] Use `writingDirection` on `<Text>` with mixed Arabic/Latin content.
- [ ] Use `textAlign: 'start' | 'end'` — never `'left' | 'right'`.

**Components that need explicit LTR (do NOT flip on RTL):**
- [ ] **Numpad** — numbers 1-9 stay in LTR order. Wrap in `<View style={{ direction: 'ltr' }}>` or pass `I18nManager.swapLeftAndRightInRTL(false)` on that subtree.
- [ ] **Amount input display** — Western digits; Arabic-Indic digits are a user preference, not forced by locale.
- [ ] **Chart axes and time-series** — dates flow left-to-right regardless of locale (industry standard; mirroring confuses).
- [ ] **Progress bars** — fill direction matches locale (start → end), so these DO flip correctly when using `start`/`end` positioning.

**Direction-implying icons that need mirroring:**
- [ ] `ArrowRightLeft`, `ArrowUpRight`, `ArrowDownLeft`, chevron-left/right, swipe-back, back arrow.
- [ ] Use `transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }]` wrapper.

**Absolute-positioned elements:**
- [ ] `SuccessOverlay` (confetti dots) — compute X positions using `I18nManager.isRTL` check.
- [ ] `FabButton` — stays centered (no change needed).
- [ ] Floating toasts/snackbars — anchor to `start`/`end`, not `left`/`right`.

**Gestures:**
- [ ] `<Swipeable>` from `react-native-gesture-handler` auto-inverts direction on RTL — verify.
- [ ] Back gesture on iOS — RTL swaps direction; test navigation stack.

**First-launch RTL commit (`app/onboarding.tsx`):**
- [ ] User picks language on first launch.
- [ ] If locale is RTL and `I18nManager.isRTL` is false: `I18nManager.forceRTL(true)` → store `mmkv.rtlSetForLocale = locale` → `Updates.reloadAsync()`.
- [ ] Every subsequent launch: check if stored locale matches current; only call `forceRTL` if mismatch. **Prevents SDK 50+ iOS reload loop bug** ([expo/expo#26532](https://github.com/expo/expo/issues/26532)).
- [ ] Never toggle RTL mid-session — force user to language-settings screen that warns "app will restart."

**Platform caveats:**
- [ ] Web: `I18nManager` no-ops. Wrap logic in `if (Platform.OS !== 'web')`; use CSS `dir="rtl"` on web.
- [ ] Android: `android:supportsRtl="true"` in manifest (handled by `expo-localization`).

**Testing:**
- [ ] Run every screen in LTR and RTL on iOS + Android sim.
- [ ] Take RTL screenshots; spot broken alignment by overlaying against LTR.
- [ ] Accessibility: VoiceOver reads Arabic text correctly; TalkBack same.

**Generic flavor note.** Generic doesn't ship RTL (decision #4 covers islamic only, but plumbing is cheap — keep `marginStart`/`marginEnd` conventions throughout so a future generic RTL is a setting-flip rather than a refactor).

### 3.4 Acceptance

- All three tabs + add modal render on iPhone 14 Pro sim and a Pixel 5 sim, pixel-similar to v4.
- Full add flow: open, enter 12.50, pick Food, pick Bank, submit → transaction persists, success overlay animates, FAB pulses, balance updates.
- Delete transaction from History → balance updates.
- Mark recurring as paid → creates transaction + debits account balance + appears in History.
- Streak shows 5 with seed data.
- Search in History filters by text (note + category name).
- Currency setting in More persists; `$12.50` becomes `﷼ ١٢٫٥٠` on SAR+ar-SA.
- Onboarding flow: pick Arabic → splash → app relaunches in RTL; pick English → stays LTR.
- RTL audit checklist fully walked; screenshots comparing LTR vs RTL for each screen.
- Biometric lock (if user enables it) gates app open after foreground with > 30s inactivity.
- Cold launch < 2s on physical iPhone 12 / Pixel 5.
- 60fps scroll over 200 seeded transactions.
- `npm run start:islamic` boots with identical UI (all slots still empty) except accent is `#00C9A7`.

---

## Phase 4 — Islamic features (`features/islamic/`)

**Goal:** Amanah flavor ships Zakat, Hijri, halal, Sadaqa, Ramadan. Generic flavor unaffected.

### 4.1 Files — all under `features/islamic/`

| File | Role |
|---|---|
| [features/islamic/slots.tsx](features/islamic/slots.tsx) | Exports `islamicSlots: FeatureSlotSet` wiring all the components below into the slot contract |
| [features/islamic/fonts.ts](features/islamic/fonts.ts) | Returns IBM Plex Sans Arabic font map; consumed by `app/_layout.tsx` under `IS_ISLAMIC` gate |
| [features/islamic/hijri/conversion.ts](features/islamic/hijri/conversion.ts) | Wrapper over **`@umalqura/core`** (replaces stale `hijri-converter`) |
| [features/islamic/hijri/useHijriDate.ts](features/islamic/hijri/useHijriDate.ts) | Hook returning today's Hijri date + month number (for Ramadan detection) |
| [features/islamic/hijri/HijriDateBadge.tsx](features/islamic/hijri/HijriDateBadge.tsx) | Used as `HomeHeaderExtras` — renders Hijri date next to Gregorian |
| [features/islamic/zakat/nisab.ts](features/islamic/zakat/nisab.ts) | Constants (gold 87.48g, silver 612.36g). Hardcoded per-currency fallback prices table with `lastUpdated`. `calculateNisab(basis, pricePerGram)`. |
| [features/islamic/zakat/mazhab.ts](features/islamic/zakat/mazhab.ts) | Four mazhabs as enum + rule deltas (Hanafi combines gold+silver, jewelry zakatable; others separate, personal jewelry exempt) |
| [features/islamic/zakat/hawl.ts](features/islamic/zakat/hawl.ts) | Hawl tracking: computes whether a full lunar year has passed since `hawlStartDate` AND whether net assets stayed above nisab throughout. Handles **hawl reset** when net drops below nisab (spec §6 decision). |
| [features/islamic/zakat/useZakatCalculation.ts](features/islamic/zakat/useZakatCalculation.ts) | Pure hook. Inputs: cash (Drizzle query) + manual entries (zakat_state row) + mazhab + hawl. Outputs: `zakatDue`, `nextDueDate`, `hawlStatus`. |
| [features/islamic/zakat/ZakatHomeCard.tsx](features/islamic/zakat/ZakatHomeCard.tsx) | Compact card for Home. Gold accent `#D4AF37` (spec line 366). |
| [features/islamic/zakat/ZakatCalculator.tsx](features/islamic/zakat/ZakatCalculator.tsx) | Full screen reached from More. Form per asset class + mazhab picker + hawl date + hawl-reset info + **always-visible** disclaimer "Consult your local scholar". |
| [features/islamic/categories/islamicCategories.ts](features/islamic/categories/islamicCategories.ts) | Literal copy of spec lines 294-301: Zakat, Sadaqa, Qurban, Hajj/Umrah, Masjid, Islamic Education. All marked `isIslamic: true` for the crescent badge. |
| [features/islamic/halal/HalalStatusSheet.tsx](features/islamic/halal/HalalStatusSheet.tsx) | Used as `TxActionSheetExtras`. 4 options (halal/haram/mushbooh/unspecified). Neutral tone — no emojis, no warnings. |
| [features/islamic/halal/HalalInlinePicker.tsx](features/islamic/halal/HalalInlinePicker.tsx) | Used as `AddTxExtras`. Same 4 options, inline in add modal. Optional — defaults to unspecified. |
| [features/islamic/halal/HalalFilterChip.tsx](features/islamic/halal/HalalFilterChip.tsx) | Used as `HistoryFilterExtras`. Single cycling chip. |
| [features/islamic/sadaqa/useSadaqaTotals.ts](features/islamic/sadaqa/useSadaqaTotals.ts) | SQL `SUM(amount) FROM transactions WHERE category IN ('zakat','sadaqa','qurban') GROUP BY period`. Returns month/year/lifetime totals. |
| [features/islamic/sadaqa/SadaqaScreen.tsx](features/islamic/sadaqa/SadaqaScreen.tsx) | Three stacked stat cards. No comparison, no sharing (riya concern — spec lines 330-333). |
| [features/islamic/ramadan/prayerTimes.ts](features/islamic/ramadan/prayerTimes.ts) | **`adhan-js` primary** — computes Fajr/Maghrib locally from lat/lon + method (Umm al-Qura, ISNA, MWL, Muslim World League). Offline-first. No third-party API calls. |
| [features/islamic/ramadan/aladhanFallback.ts](features/islamic/ramadan/aladhanFallback.ts) | **Optional** — Aladhan API as "verify against server" feature, user-opt-in. 30-day SQLite cache. Off by default; privacy disclosure required when enabled. |
| [features/islamic/ramadan/RamadanHomeCard.tsx](features/islamic/ramadan/RamadanHomeCard.tsx) | Renders only when `hijriMonth === 9`. Shows suhoor/iftar (from `adhan-js`), this-Ramadan sadaqa, Zakat al-Fitr reminder in final 10 days. |
| [features/islamic/screens/MoreMenuEntries.tsx](features/islamic/screens/MoreMenuEntries.tsx) | Used as `MoreMenuItems`. Two rows: "Zakat Calculator" and "Sadaqa Tracker". |
| [app-islamic/(islamic)/_layout.tsx](app-islamic/(islamic)/_layout.tsx), [app-islamic/(islamic)/zakat.tsx](app-islamic/(islamic)/zakat.tsx), [app-islamic/(islamic)/sadaqa.tsx](app-islamic/(islamic)/sadaqa.tsx) | **Kept in `app-islamic/`** (not `app/`). `scripts/prepare-flavor.js` copies into `app/` only for Islamic builds — prevents route manifest leak. |

### 4.2 Tone rules (enforce in code review)

Per spec lines 323-326, 381-386, 400-403:
- **No gamification.** No streaks for sadaqa, zakat, prayer. No comparisons to averages. No sharing buttons.
- **No moralizing.** Halal status is neutral metadata; never auto-inferred from category. No "haram warnings."
- **Transparency on fiqh.** Zakat calculator shows which mazhab rule applied. Disclaimer always visible.
- **Ikhlas (sincerity).** Private by default; no external shares of charitable totals.
- **Privacy.** No third-party API calls by default (adhan-js local). Aladhan fallback is opt-in with clear disclosure.

### 4.3 Zakat edge cases (spec didn't specify; decisions here)

- **Hawl reset.** If net eligible assets drop below nisab at any point during the lunar year, hawl resets. `hawl.ts` tracks monthly snapshots of net position; on calculator open, shows "Hawl reset on DATE — assets fell below nisab" with option for user to override (scholars differ).
- **Non-cash assets v1 scope.** Ship the 6 listed asset classes (cash, gold, silver, inventory, investments, receivables) + liabilities. Add "Other wealth (note only)" free-text field for edge cases (401k, crypto) — calculator doesn't compute, user consults scholar.
- **Currency for nisab.** Uses user's primary currency (from MMKV). Nisab fallback prices table is per-currency; "Refresh prices" button fetches from `goldapi.io` (behind opt-in privacy toggle, like Aladhan).

### 4.4 Acceptance

- Islamic flavor: Home shows Hijri badge (from `@umalqura/core`); Zakat card appears with live-computed estimate; Ramadan card appears only if `hijriMonth === 9` (force via dev toggle for QA outside Ramadan).
- Long-press transaction in History → halal sheet → pick "halal" → row shows subtle marker → persists across reload.
- Add modal shows inline halal picker (optional, defaults to unspecified).
- More → "Zakat Calculator" → full calculator; enter $10k cash, $0 debts, Hanafi, silver basis, hawl complete → expect exactly $250 zakat due.
- Hawl reset scenario: seed data where assets dipped below nisab → calculator shows reset warning with correct date.
- Prayer times: airplane mode ON from day 1 → `adhan-js` computes fajr/maghrib correctly from stored lat/lon (no network needed, ever).
- Optional Aladhan verify feature off by default; toggling it shows privacy disclosure before first fetch.
- Generic flavor: **none** of the above visible. Home identical to Phase 3. `strings` on generic `.apk` returns zero matches for `Zakat|Hijri|Sadaqa|halal|nisab|hawl|Amanah|adhan`.

---

## Phase 5 — Build verification & release

### 5.1 Three-layer tree-shake verification — `scripts/verify-tree-shake.sh`

The original plan's single `grep dist/` check was insufficient: Expo SDK 52+ emits Hermes bytecode by default, and `grep` doesn't scan Hermes' binary string pool. Replace with layered verification:

```bash
#!/bin/bash
set -euo pipefail
FORBIDDEN="Zakat|Sadaqa|Hijri|Ramadan|nisab|hawl|mazhab|Qurban|Hajj|Amanah|halal|haram|mushbooh|adhan|umalqura"

echo "=== Layer A: plain assets + manifests ==="
rm -rf dist/generic
APP_FLAVOR=generic npm run prep:generic
APP_FLAVOR=generic ENVFILE=.env.generic npx expo export --platform all --output-dir dist/generic
if grep -rIEi "$FORBIDDEN" dist/generic/assets/ dist/generic/metadata.json 2>/dev/null; then
  echo "FAIL (assets): Islamic strings in dist/generic/assets or manifest"; exit 1
fi

echo "=== Layer B: Hermes bytecode string pools ==="
HBC_HITS=0
while IFS= read -r hbc; do
  if strings "$hbc" | grep -Ei "$FORBIDDEN" >/dev/null; then
    echo "FAIL (hbc): $hbc contains Islamic strings"
    strings "$hbc" | grep -Ei "$FORBIDDEN" | head -5
    HBC_HITS=1
  fi
done < <(find dist/generic/_expo -name "*.hbc" 2>/dev/null)
[ $HBC_HITS -eq 1 ] && exit 1

echo "=== Layer C: non-Hermes JS audit (extra safety) ==="
rm -rf dist/generic-js
EXPO_USE_HERMES=0 APP_FLAVOR=generic npm run prep:generic
EXPO_USE_HERMES=0 APP_FLAVOR=generic ENVFILE=.env.generic npx expo export --platform all --output-dir dist/generic-js
if grep -rIEi "$FORBIDDEN" dist/generic-js/_expo/ 2>/dev/null; then
  echo "FAIL (js): Islamic strings in non-Hermes JS bundle"; exit 1
fi

echo "=== Layer D: final shipping artifacts (REQUIRED for release gate) ==="
if [ -f build/generic.apk ]; then
  if strings build/generic.apk | grep -Ei "$FORBIDDEN" >/dev/null; then
    echo "FAIL (apk): Islamic strings in final Android artifact"; exit 1
  fi
fi
if [ -f build/generic.ipa ]; then
  if strings build/generic.ipa | grep -Ei "$FORBIDDEN" >/dev/null; then
    echo "FAIL (ipa): Islamic strings in final iOS artifact"; exit 1
  fi
fi

echo "PASS: generic bundle clean across all layers"
```

**Layer D is the gold standard** — it proves what actually ships. Wire into CI as a required check before any store submission. Layers A-C are fast pre-flight checks during development.

**Canary sanity check.** Also run the same pipeline against `dist/islamic` and assert at least one forbidden string is present — confirms the greps actually work and aren't silently returning empty.

### 5.2 EAS profiles

Already in [eas.json](eas.json) (Phase 1). Run `eas credentials` once per flavor to provision certs. Two separate App Store / Play Store listings.

### 5.3 Device test matrix

- **Simulator** (both flavors): iPhone 14 Pro (iOS 17), Pixel 5 (Android 14)
- **Physical** (both flavors): iPhone 12, Pixel 6 — haptics, 60fps scroll over 200 tx, cold launch < 2s, biometric unlock
- **RTL (islamic only)**: locale flip on onboarding + reload; full visual comparison LTR vs RTL per screen; no reload-loop on repeated locale switch
- **Hijri accuracy**: verify `@umalqura/core` output matches Saudi Gazette / IslamicFinder for today's date
- **Prayer times (islamic only)**: `adhan-js` with airplane mode from day 1 — must compute correctly offline forever
- **Zakat arithmetic**: $10k cash → $250 due; hawl-reset edge case with seeded history
- **Tree-shake gate**: `npm run verify:tree-shake` green across all four layers

### 5.4 Store submission

- `com.moneyflow.generic` → "Flow"
- `com.amanah.app` → "Amanah"

Separate screenshots, descriptions, privacy nutrition labels. Do not reuse marketing copy. Amanah's privacy label must accurately reflect that by default no third-party servers are contacted (opt-in Aladhan + goldapi are the only exceptions).

---

## Critical files (author correctly early — cascades if wrong)

- [babel.config.js](babel.config.js) — `transform-inline-environment-variables` for `APP_FLAVOR`. **Layer 1 of tree-shaking.**
- [metro.config.js](metro.config.js) — resolver alias + blockList. Layers 2-3.
- [scripts/prepare-flavor.js](scripts/prepare-flavor.js) — route swap. Layer 4.
- [app.config.ts](app.config.ts) — env → config pipe.
- [constants/flavor.ts](constants/flavor.ts) — `IS_ISLAMIC` as direct `process.env` read (NOT `Constants.expoConfig.extra`).
- [features/index.ts](features/index.ts) — `FeatureSlots` contract; changing after Phase 3 touches every screen.
- [utils/db/schema.ts](utils/db/schema.ts) — Drizzle schema; migrations forever after.
- [hooks/useAppData.ts](hooks/useAppData.ts) — replaces v4's 25 useStates, owns all data access.

---

## Reference (reused from v4 — do not rewrite)

- Data shapes: v4 lines 45-110 (categories, defaults, seed)
- State mutations: v4 lines 221-270 (`addTxn`, `delTxn`, `submit`, `quickAdd`, `markPaid`, `unmarkPaid`) — port semantics to Drizzle mutations
- Memoized calcs: v4 lines 183-213 (`moTxns`, `lastMoTxns`, `totExp`, `totInc`, `expByCat`, `dailySpend`, `frequentTxns`, `budgetSpending`) — port to SQL aggregations
- Streak calc: v4 line 215 (`calcStreak`)
- Numpad logic: v4 line 217
- View layouts: `HomeView` (326-465), `AddView` (468-543), `HistView` (546-558), `MoreView` (561-781), `TxRow` (276-310), `RecRow` (312-324)
- Animations: v4 `@keyframes` at lines 21-43 — port semantics to Reanimated, not syntax

---

## §6 Open decisions (flag for user before Phase 2)

Nine scope items not in the spec. Each has a default; user can override:

| # | Decision | Default | Cost of default | Fix later? |
|---|---|---|---|---|
| 1 | **Storage: Drizzle schema vs single JSON blob?** | **Drizzle schema** (recommended) — +2 days up front, 10× faster filters/aggregations at scale | If you skip: sluggish analytics at 500+ tx | Painful — requires migration |
| 2 | **Biometric unlock (`expo-local-authentication`)?** | Opt-in setting in More, off by default | None | Trivial to add later |
| 3 | **Data export (CSV + JSON)?** | Export button in More | None | Easy to add later |
| 4 | **Transaction search in History?** | Debounced text search | None | Easy to add later |
| 5 | **Push notifications (`expo-notifications`)?** | Budget alerts, recurring bill due, Zakat anniversary (islamic), Ramadan reminders (islamic) | None if skipped | Easy to add later |
| 6 | **First-launch onboarding?** | Language + currency + seed-or-empty | Ugly first launch without it | Easy to add later |
| 7 | **Encryption at rest (SQLCipher)?** | **Skip** — rely on OS-level device encryption | If breached: unencrypted SQLite | Painful — requires data re-encryption |
| 8 | **Accessibility audit?** | VoiceOver/TalkBack labels in Phase 3 | App unusable for screen reader users | Easy but tedious later |
| 9 | **Dark/light mode toggle?** | Dark-only (matches v4) | None | Easy to add later |

Items 1 and 7 are the only ones painful to retrofit. Confirm those two before Phase 2; others can default.

---

## Verification (end-to-end smoke test)

Run after Phase 4 completes:

```bash
# 1. Generic iOS smoke
npm run start:generic
# On sim: open app → onboarding → skip biometric → add expense 12.50 Food Bank
# → see success overlay → history shows it → search "12" finds it
# → long-press → see ONLY Delete + Edit Note (no halal sheet) → delete → balance reverts
# → switch to Arabic in settings → warning dialog → confirm → stays LTR (generic doesn't ship RTL)

# 2. Islamic iOS smoke
npm run start:islamic
# Onboarding → pick Arabic → RTL commit → app reloads RTL
# → Home shows Hijri badge + Zakat card
# → add expense with inline halal=halal → persists → long-press to change → persists
# → More → Zakat Calculator → $10k cash, Hanafi, silver, hawl complete → exactly $250
# → More → Sadaqa Tracker → sums zakat+sadaqa+qurban categories correctly
# → dev toggle: force hijri month=9 → Ramadan card appears with offline prayer times

# 3. Android builds (both flavors)
npm run android:generic
npm run android:islamic

# 4. Tree-shake gate (4 layers)
npm run verify:tree-shake
# Must print "PASS: generic bundle clean across all layers"

# 5. Final artifact check (gold standard)
strings build/generic.apk | grep -Ei "Zakat|Hijri|Sadaqa|halal|Amanah|adhan|umalqura" && echo "FAIL" || echo "PASS"
strings build/generic.ipa | grep -Ei "Zakat|Hijri|Sadaqa|halal|Amanah|adhan|umalqura" && echo "FAIL" || echo "PASS"

# 6. Bundle size comparison
ls -lh build/generic.apk build/islamic.apk
# Generic meaningfully smaller (no @umalqura/core, no adhan-js, no Arabic font, no Islamic screens)
```

All six green = ready for store submission.
