# MoneyFlow — Dual Flavor Architecture (Amendment to base prompt)

> This document amends `CLAUDE_CODE_PROMPT.md`. All base specifications (data
> models, categories, screens, recurring system, design tokens) remain valid.
> This document adds dual-flavor architecture on top: **one codebase, two
> branded builds.**

---

## What Changes

You are building **one Expo codebase** that produces **two distinct apps** at
build time:

| Flavor     | Bundle ID                    | Display Name       | Audience           |
|------------|------------------------------|--------------------|--------------------|
| `generic`  | `com.moneyflow.generic`      | Flow               | General users      |
| `islamic`  | `com.amanah.app`             | Amanah             | Muslim users       |

Both apps share the same core features (balance, transactions, recurring,
history, analytics). The `islamic` flavor additionally exposes Islamic finance
features (Zakat calculator, Hijri dates, halal categories, Sadaqa tracking)
that are **absent entirely** from the `generic` build — not hidden, not
toggleable, physically excluded from the bundle.

The `generic` flavor has no awareness that Islamic features exist.

---

## Flavor Configuration

### Environment variables

Set at build time via `.env.generic` and `.env.islamic`:

```env
# .env.generic
APP_FLAVOR=generic
APP_NAME=Flow
APP_BUNDLE_ID=com.moneyflow.generic
APP_SCHEME=flow
PRIMARY_COLOR=#00E09E
FEATURES_ISLAMIC=false

# .env.islamic
APP_FLAVOR=islamic
APP_NAME=Amanah
APP_BUNDLE_ID=com.amanah.app
APP_SCHEME=amanah
PRIMARY_COLOR=#00C9A7
FEATURES_ISLAMIC=true
```

Load these through `expo-constants` or `react-native-config`. Expose a single
`flavor.ts` module that the rest of the app imports from:

```typescript
// constants/flavor.ts
import Constants from 'expo-constants';

export const FLAVOR = Constants.expoConfig?.extra?.flavor as 'generic' | 'islamic';
export const APP_NAME = Constants.expoConfig?.extra?.appName as string;
export const IS_ISLAMIC = FLAVOR === 'islamic';
```

### Dynamic app.config.ts

Replace `app.json` with `app.config.ts` that reads from `process.env`:

```typescript
// app.config.ts
import 'dotenv/config';

export default {
  expo: {
    name: process.env.APP_NAME,
    slug: process.env.APP_FLAVOR === 'islamic' ? 'amanah' : 'flow',
    scheme: process.env.APP_SCHEME,
    ios: { bundleIdentifier: process.env.APP_BUNDLE_ID },
    android: { package: process.env.APP_BUNDLE_ID },
    icon: `./assets/${process.env.APP_FLAVOR}/icon.png`,
    splash: { image: `./assets/${process.env.APP_FLAVOR}/splash.png` },
    extra: {
      flavor: process.env.APP_FLAVOR,
      appName: process.env.APP_NAME,
      featuresIslamic: process.env.FEATURES_ISLAMIC === 'true',
    },
  },
};
```

### Build scripts

Add to `package.json`:

```json
{
  "scripts": {
    "start:generic": "ENVFILE=.env.generic expo start",
    "start:islamic": "ENVFILE=.env.islamic expo start",
    "build:generic:ios": "eas build --profile generic --platform ios",
    "build:generic:android": "eas build --profile generic --platform android",
    "build:islamic:ios": "eas build --profile islamic --platform ios",
    "build:islamic:android": "eas build --profile islamic --platform android"
  }
}
```

Configure `eas.json` profiles for `generic` and `islamic` that set the correct
env file before building.

---

## Assets Structure

Separate asset directories per flavor:

```
assets/
  generic/
    icon.png
    splash.png
    adaptive-icon.png
    logo.svg
  islamic/
    icon.png          # Amanah logo, Islamic geometric pattern
    splash.png
    adaptive-icon.png
    logo.svg
  shared/             # used by both flavors
    category-icons/
    fonts/
```

---

## Code Isolation Rules

### Rule 1: Islamic code lives in one place

All Islamic-specific logic, UI, and data lives under `features/islamic/`.
Nothing outside this directory imports `features/islamic/*` unconditionally.

```
features/
  islamic/
    zakat/
      ZakatCalculator.tsx
      useZakatCalculation.ts
      nisab.ts              # nisab thresholds (gold, silver)
      mazhab.ts             # Hanafi vs Shafi'i rules
    hijri/
      HijriDate.tsx
      useHijriDate.ts
      conversion.ts
    categories/
      islamicCategories.ts  # Zakat, Sadaqa, Qurban, Hajj, etc.
    screens/
      ZakatScreen.tsx
      RamadanScreen.tsx
    components/
      ZakatCard.tsx         # shown on Home in Islamic flavor
      HalalFilter.tsx
    index.ts                # single public API surface
```

### Rule 2: Conditional imports via a feature flag module

Create `features/index.ts` as the single import point for flavor-specific code:

```typescript
// features/index.ts
import { IS_ISLAMIC } from '@/constants/flavor';

export const FeatureFlags = {
  zakat: IS_ISLAMIC,
  hijriDates: IS_ISLAMIC,
  halalCategories: IS_ISLAMIC,
  sadaqaTracking: IS_ISLAMIC,
  ramadanMode: IS_ISLAMIC,
};

// Lazy re-exports — only loaded when flavor matches
export const IslamicFeatures = IS_ISLAMIC
  ? require('./islamic').default
  : null;
```

### Rule 3: No conditional rendering sprinkled in core components

**Wrong:**
```tsx
// HomeScreen.tsx
{IS_ISLAMIC && <ZakatCard />}
{IS_ISLAMIC && <HijriDate />}
```

**Right:**
```tsx
// HomeScreen.tsx
import { FeatureSlots } from '@/features';

<FeatureSlots.HomeExtras />  {/* renders nothing in generic, ZakatCard + HijriDate in islamic */}
```

`FeatureSlots` is exported from `features/index.ts` and returns either
Islamic-specific components or null fragments based on flavor. Core screens
don't know which flavor they're in.

### Rule 4: Tree-shaking guarantee

Wrap all Islamic imports in the `IS_ISLAMIC` check so Metro bundler can dead-
code-eliminate them from the generic build:

```typescript
// features/index.ts
let islamicModule: typeof import('./islamic') | null = null;
if (IS_ISLAMIC) {
  islamicModule = require('./islamic');
}
export { islamicModule };
```

Verify by checking generic build's bundle size — it should not include any
Islamic strings (no "Zakat", "Sadaqa", "Hijri", "Mecca" tokens).

---

## Islamic Flavor Features

These features exist ONLY in the `islamic` flavor. Do not implement them as
settings-toggles in `generic`.

### 1. Zakat Calculator

Dedicated screen accessed from More tab. Pulls live data from user's accounts.

**Calculation model:**

```typescript
interface ZakatCalculation {
  nisabThreshold: number;      // current nisab in user's currency
  nisabBasis: 'gold' | 'silver'; // user preference, default silver (more inclusive)
  eligibleAssets: {
    cash: number;              // all cash + bank + savings accounts
    gold: number;              // manually entered
    silver: number;            // manually entered
    businessInventory: number; // manually entered
    investments: number;       // manually entered (halal only)
    receivables: number;       // debts owed to user (expected to be repaid)
  };
  liabilities: {
    debts: number;             // immediate debts (loans, credit cards)
  };
  mazhab: 'hanafi' | 'shafii' | 'maliki' | 'hanbali';
  hawl: {
    startDate: string;         // when wealth first exceeded nisab
    currentDate: string;
    isComplete: boolean;       // has full lunar year passed
  };
  zakatDue: number;            // 2.5% of net eligible assets if hawl complete
  nextDueDate: string;
}
```

**Nisab values** (refresh monthly from a gold/silver price API):
- Gold: 87.48 grams × current gold price per gram
- Silver: 612.36 grams × current silver price per gram
- Default to silver nisab (lower threshold, more people owe zakat — considered
  safer from fiqh perspective, especially for Hanafi and Maliki schools)

**Mazhab differences to encode:**
- Hanafi: combines gold + silver for nisab calculation; jewelry is zakatable
- Shafi'i: gold and silver calculated separately; personal-use jewelry exempt
- Maliki: similar to Shafi'i on jewelry
- Hanbali: similar to Shafi'i

Show a clear "Consult your local scholar" disclaimer. App calculates, it does
not issue fatwa.

### 2. Hijri Date Display

- Home screen header shows both Gregorian and Hijri dates
- Transaction dates show Hijri as secondary
- Use `hijri-converter` or similar library for conversion
- Default calendar (Umm al-Qura for Gulf, Tabular for general) configurable in
  settings

### 3. Islamic Category Set

Additional expense categories available only in `islamic` flavor:

```typescript
const ISLAMIC_EXPENSE_CATEGORIES = [
  { id: 'zakat', name: 'Zakat', icon: 'hand-holding', color: '#00C9A7' },
  { id: 'sadaqa', name: 'Sadaqa', icon: 'heart-circle', color: '#34D399' },
  { id: 'qurban', name: 'Qurban', icon: 'leaf', color: '#4ADE80' },
  { id: 'hajj', name: 'Hajj/Umrah', icon: 'compass', color: '#FBBF24' },
  { id: 'masjid', name: 'Masjid', icon: 'home', color: '#818CF8' },
  { id: 'islamic_edu', name: 'Islamic Education', icon: 'book', color: '#60A5FA' },
];
```

These are treated as standard categories in the grid but styled with a subtle
distinguishing mark (small green crescent badge in corner) so users see at a
glance how much goes to religious/charitable obligations.

### 4. Halal Status on Transactions

Optional field on every transaction:

```typescript
interface Transaction {
  // ...existing fields
  halalStatus?: 'halal' | 'haram' | 'mushbooh' | 'unspecified';
}
```

- Default: `'unspecified'`
- User can mark transactions via long-press → action sheet
- History screen has a filter chip for halal status
- **Do not** auto-infer from category (coffee could be halal or from a chain
  the user objects to — respect user judgment, don't moralize)
- Do not gamify or guilt. No "halal streak." No "haram warnings." Just a
  neutral tracking field for users who want the data.

### 5. Sadaqa Tracking

Special view in More tab: total charitable giving (Zakat + Sadaqa + Qurban
categories) for the current month, year, and lifetime. No comparison to
"average" (riya concern). No sharing. Private.

### 6. Ramadan Mode (seasonal)

When current Hijri month is Ramadan (ninth month), home screen shows:

- Suhoor/Iftar times (configurable by city, use Aladhan API)
- Running total of Sadaqa given this Ramadan
- Zakat al-Fitr reminder in the last 10 days

This is the only part of the app that changes UI based on calendar date. Keep
it subtle — a card on Home, not a takeover.

---

## Styling Differences Between Flavors

### Generic flavor

- Keep existing `#00E09E` accent (electric green)
- Typography: Outfit + Plus Jakarta Sans as specified in base prompt
- Fully secular iconography

### Islamic flavor

- Slightly shifted accent to `#00C9A7` (more teal, less neon) — reads as
  professional/traditional rather than startup-green
- Same typography, but add a secondary display font option for Arabic text:
  Use `IBM Plex Sans Arabic` for any Arabic strings (du'a, surah references,
  Hijri month names)
- Islamic geometric pattern as a subtle background texture on key screens
  (opacity 3-5%, not decorative, barely perceptible)
- Zakat card uses a distinct accent (gold: `#D4AF37`) to signal its special
  status

---

## Shared Core (no changes to base prompt)

Everything in the base `CLAUDE_CODE_PROMPT.md` applies to both flavors:

- All 18 generic expense categories
- All 6 income categories
- Default accounts
- Home screen structure (with `FeatureSlots.HomeExtras` slot for islamic
  extras)
- History screen (with conditional halal filter chip in islamic)
- More screen structure (with Zakat and Ramadan screens added in islamic)
- Recurring bills system (unchanged)
- Streak system (unchanged — no religious framing)
- Storage layer (unchanged — halalStatus and islamic categories just become
  additional fields in the same JSON blob)
- Numpad, haptics, animations (unchanged)

---

## File Structure (updated)

```
app/
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx
    history.tsx
    more.tsx
components/              # shared by both flavors
constants/
  theme.ts               # imports PRIMARY_COLOR from flavor
  categories.ts          # generic categories only
  defaults.ts
  flavor.ts              # NEW — flavor detection
features/
  index.ts               # NEW — FeatureFlags + FeatureSlots
  islamic/               # NEW — entire directory only bundled in islamic build
    zakat/
    hijri/
    categories/
    screens/
    components/
    index.ts
hooks/
utils/
assets/
  generic/
  islamic/
  shared/
.env.generic             # NEW
.env.islamic             # NEW
app.config.ts            # REPLACES app.json
eas.json                 # UPDATED with flavor profiles
```

---

## Build Order (revised)

1. Project setup with `app.config.ts` and flavor env files
2. Flavor detection module (`constants/flavor.ts`)
3. Feature flag module (`features/index.ts` with empty `FeatureSlots`)
4. Core app from base prompt — build everything as if Islamic doesn't exist
5. Verify `npm run start:generic` works end-to-end
6. Build `features/islamic/` module in isolation
7. Wire `FeatureSlots` to conditionally render Islamic components
8. Verify `npm run start:islamic` works end-to-end
9. Configure EAS build profiles for both flavors
10. Test bundle size — generic should not contain Islamic strings

---

## Testing the Separation

After build, verify isolation:

```bash
# Inspect generic bundle
npm run build:generic:android
grep -r "Zakat\|Hijri\|Sadaqa\|nisab" dist/generic/
# should return nothing

# Inspect islamic bundle
npm run build:islamic:android
grep -r "Zakat" dist/islamic/
# should return Islamic feature code
```

If generic bundle contains Islamic strings, tree-shaking isn't working —
revisit the conditional require pattern in `features/index.ts`.

---

## Rationale Notes (for Claude Code to understand design intent)

- The generic flavor is not "Islamic app with features hidden." It is a
  different product that shares infrastructure. A user of `Flow` should never
  know `Amanah` exists from looking at the app.
- The Islamic flavor is not "generic app with Islamic mode on." It is a
  product designed around Muslim financial life. Islamic features are first-
  class, not afterthoughts tucked in settings.
- Zakat calculation is sensitive territory — fiqh differences are real. App
  must show its calculation method transparently and disclaim that final
  rulings come from qualified scholars.
- No sycophancy in Islamic flavor — don't praise user for giving sadaqa, don't
  show streaks for prayer or fasting, don't gamify ibadah. Respect the
  principle of ikhlas.
- Accessibility matters in both flavors — Arabic RTL support in Islamic
  flavor is non-negotiable. Use `I18nManager.forceRTL(true)` when Arabic
  locale is selected.
