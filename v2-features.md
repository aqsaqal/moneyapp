# MoneyFlow v2 — Remaining Work

Snapshot of what's still open before public release on App Store + Play
Store. Anything not listed here is shipped (numpad redesign, smart-add,
percent eval, activity month-scoped views, on-track card, currency
preset polish, etc.).

## Status legend

- 🟢 **Ready** — code is in, just needs QA pass.
- 🟡 **Partial** — scaffolding exists, real feature work remaining.
- 🔴 **Not started** — empty.

---

## 1. Pre-launch features (must ship in v1.0)

### 1.1 Crash reporting + diagnostics 🟢
- Decision: stores-only, no third-party SDK. App Store Connect + Play
  Console crash dashboards are free, zero-setup, no extra network.
- Native crashes: dSYMs are auto-bundled in the IPA by EAS Build;
  Apple symbolicates on upload. Android AAB ships NDK + Hermes
  symbols by default; Play Console handles ANRs + native crashes.
- JS crashes: accept the blindness (native traces show as
  `RCTFatal`-style frames). §1.2 ErrorBoundary keeps users out of
  the unhandled-exception path for the recoverable cases.
- Privacy nutrition labels can declare **no data collected by the
  developer** because Apple/Google diagnostics aren't attributed to
  us.
- If JS-error blindness becomes a problem post-launch, add Sentry
  (opt-in) in a v1.0.x patch.

### 1.2 Error boundaries on every tab 🟢
- `components/ErrorBoundary.tsx` wraps `(tabs)` and every modal at
  the root level in `app/_layout.tsx`, so any tab or modal crash
  falls through to the same fallback (icon + title + body + Reload).
- Reload prefers `expo-updates.reloadAsync` and degrades to a soft
  `setState({ error: null })` reset.
- Per-tab wrapping was an over-spec — root-level covers the same
  cases with less code, accepting that the tab bar disappears
  during the fallback (the Reload button restores it).

### 1.3 Skeleton loading on cold boot 🟢
- `HomeSkeleton` renders at root level in `app/_layout.tsx` while
  fonts or DB aren't ready, which gates the entire (tabs) tree —
  no per-tab `null` flash possible.
- Wrapped the boot-path skeleton in `SafeAreaProvider` and made
  `HomeSkeleton` consume `useSafeAreaInsets()` so the placeholder
  header isn't tucked under the notch / status bar.

### 1.4 Empty-state illustrations 🟢
- Decision: ship v1.0 with text-only empty states (title + hint +
  small MaterialCommunityIcons ghost icon). Commissioning custom
  illustrations is a v1.1+ polish item.
- Covered surfaces: Activity fresh/filtered, BalanceCard no-acct/
  no-income, Plan expenses/income/budgets/goals/debts,
  CategoriesAnalytics. All have copy + at least an icon anchor.

### 1.5 Real app icons + splash 🟢
- Flow: green F mark on navy with subtle radial highlight. Confirmed
  on `assets/generic/`.
- Amanah: gold 8-pointed star on dark green (geometric Islamic motif,
  not calligraphy — matches the plan §Phase 10 acceptance criteria).
- All three asset variants exist per flavor: `icon.png`,
  `adaptive-icon.png` (Android foreground), `splash-icon.png`.
- Polish for v1.0.x (non-blocking): monochrome variant for Android
  13+ themed mode; iOS 18 dark / tinted icon variants.

### 1.6 Hawl-approaching action card (islamic) 🟢
- `computeHawlForActiveState()` returns `daysRemaining ≤ 30 →
  hawl-approaching`, `isComplete → hawl-due`. Wired via lazy-require
  inside an `APP_FLAVOR === 'islamic'` guard so the require DCE's in
  generic builds.
- Fixed broken `/(islamic)/zakat` route reference — the action card
  now falls back to `/plan` (where Zakat/Sadaqa rows live via
  `PlanTabExtras`). A dedicated zakat calculator screen ships in v1.1.
- **Manual QA still needed on islamic build:** set `hawlStartIso =
  today − 335 days` via the Me → Islamic settings, then return to
  Home and confirm the gold `calendar-clock` card shows "Hawl in
  30 days · Review zakat — projected $X".

### 1.7 Gold/silver nisab auto-refresh (islamic) 🟢
- `metalsRefresh.ts` fetches `api.gold-api.com/price/{XAU,XAG}` (no
  API key, free), caches `pricesUsdPerGram` in MMKV with a 24h TTL,
  and the boot path in `hooks/useAppData.ts` fires the refresh in the
  background when `islamic.nisabAutoRefresh` is on + cache stale.
- Manual refresh + last-fetched timestamp surfaced in
  `MeTabExtras.tsx`.
- Properly gated under `process.env.APP_FLAVOR === 'islamic'` so the
  generic bundle DCE's the require + network call.
- §2.1 privacy policy must disclose the outbound call.

### 1.8 Bill reminders push notifications 🟢
- `utils/notifications.ts` exports `rescheduleAllReminders` which
  wipes prior reminders (by `bill-reminder:` ID prefix) and re-emits
  one local notification per active expense-type recurring item at
  09:00 local on `dayOfMonth − reminderLeadDays`.
- `hooks/useAppData.ts` calls `resyncReminders()` on boot,
  `upsertRecurring`, and `deleteRecurring` so the queue always
  matches the table.
- User controls: `remindersEnabled` toggle + `reminderLeadDays`
  picker in Settings → Notifications (`app/settings.tsx:502,556`).

### 1.9 Subscription audit surface 🟢
- Plan tab consumes `useSubscriptionAudit()` and renders three slices:
  `annualBurn` as a header subtitle, `stale` items inline-tagged on
  existing recurring rows (`{daysSinceLastSeen}` days since last seen),
  and `detected` candidates as suggestion rows with the merchant
  token + amount + `monthsSeen` count.

### 1.10 i18n parity sweep 🟡
- **Code-level fixes done:**
  - `HomeActionCard` now uses 14 new `homeAction.*` keys for
    overbudget / bill-soon / bill-overdue / spike / hawl-approaching
    / hawl-due / zakat-due / below-nisab titles + details.
  - Activity month-carousel arrows + label have proper
    `accessibilityLabel`s (`activity.month.prev|next|pick`).
  - Arabic-Indic numerals confirmed default-on for ar-*
    via `kv.get('arabicNumerals')` → `-u-nu-arab` Intl extension.
- **Manual QA still needed before submission:** run app under at
  least ar-SA + ru-RU. Watch for any remaining hardcoded English
  Text/accessibilityLabel strings (a handful exist in
  PickerSheet.tsx, RecurringRow.tsx, add.tsx — low-priority,
  accessibility-only). RTL mirror correctness on Activity
  ChartModal + day-header net total.

### 1.11 Accessibility audit 🟡
- **Code-level done:**
  - Reduce-motion gated on `SuccessOverlay`, `StreakBadge`,
    `FabButton` via `useReducedMotion()`.
  - Activity carousel arrows + chart button now have
    `accessibilityLabel`s (added under §1.10).
  - Touch targets: the 36×36 filter / chart icons sit inside a
    `hitSlop` of 6-8, expanding the effective hit area to 48-52
    pixels — meets iOS 44pt + Android 48dp minimums.
  - Hero amount on `BalanceCard` uses `adjustsFontSizeToFit +
    numberOfLines={1}` to prevent Dynamic Type 3xLarge overflow.
- **Manual QA before submission:** VoiceOver iOS + TalkBack Android
  walkthrough — Home → Add → submit → Activity reachable with
  screen reader only. Dynamic Type 3xLarge sweep on Home, Plan,
  Activity, Settings.

### 1.12 Cultural review (islamic) 🟢
- **Streaks exclude ibadah** — `useStreak.ts` filters out
  `zakat`, `sadaqa`, `qurban` from the day-set in islamic builds.
- **MonthlyRecap no longer leaks Sadaqa** — added an `APP_FLAVOR ===
  'islamic'` guard that strips ibadah categories from the candidate
  set when picking the shareable headline "top category."
- **Zakat disclaimer** — present on `ZakatCalculator` (always-visible
  "consult your local scholar" line) and `ZakatHomeCard`. The
  `HomeActionCard` hawl card only nudges; the destination screen
  carries the disclaimer.
- **Riba framing** — opt-in `me.account.riba.{label,hint,footer}`
  surfaces the warning only when the user explicitly tags an account
  as interest-bearing; never asserts it on their behalf.

### 1.13 Device matrix QA 🔴
- Full v2 acceptance walkthrough on 6 phones: iPhone SE / iPhone 17
  Pro Max / physical iPhone / Pixel 4a / Pixel 7 / S26 Ultra.
- Checklist lives at `docs/device-matrix-test.md` (cold boot, each
  tab, Smart Add, transfer fx, restore-from-backup, i18n + a11y,
  perf, stress).
- Phones only — iPad / foldables / tablets explicitly out of scope
  per `app.config.ts` `supportsTablet: false` + `UIDeviceFamily: [1]`.
- Run before each release build; record pass/fail in the table at
  the bottom of the doc.

---

## 2. Polish / nice-to-have for v1.0

### 2.1 Privacy policy + Terms of Use 🟢
- Two separate doc sets per flavor on the public `main` branch
  (orphan, docs-only) at github.com/aqsaqal/moneyapp:
  - `docs/flow/{privacy,terms}.md` — covers FX opt-in + camera/photos
    for OCR + biometrics + bill reminders.
  - `docs/amanah/{privacy,terms}.md` — adds zakat / nisab refresh /
    sadaqa-privacy / halal-tagging / Hijri / prayer-times clauses,
    plus an "informational only — consult a scholar" disclaimer in
    the Terms.
- Hosted on GitHub Pages with `jekyll-theme-minimal` + pretty
  permalinks. Live URLs:
  - Flow: `https://aqsaqal.github.io/moneyapp/flow/privacy/` and
    `https://aqsaqal.github.io/moneyapp/flow/terms/`
  - Amanah: `https://aqsaqal.github.io/moneyapp/amanah/privacy/` and
    `https://aqsaqal.github.io/moneyapp/amanah/terms/`
- `constants/legal.ts` is flavor-aware via
  `process.env.APP_FLAVOR` — generic build links Flow's pages,
  islamic build links Amanah's. Settings → About surfaces the
  matching pair.
- **Submit each pair to the matching store listing** (App Store
  Connect Privacy URL + Play Console Data safety form).

### 2.2 Onboarding region detection 🟢
- `constants/regionCurrency.ts` covers ~150 ISO-3166 regions →
  ISO-4217 currency, including every target from the plan
  (SA→SAR, AE→AED, EG→EGP, PK→PKR, ID→IDR, MY→MYR, TR→TRY),
  plus GCC, MENA, South / Southeast / East Asia, Anatolia / CIS,
  Eurozone + non-euro Europe, Americas, Africa, Pacific.
- Also exports `REGION_TO_LOCALE` so a fresh ar-SA install lands on
  Arabic UI + SAR + RTL, and `currencyAlternativesFor()` for the
  onboarding step-2 "did we guess right?" picker.

### 2.3 Cashflow forecast subtext on Home 🟢
- Always-open card after this session's BalanceCard refactor.
- Formula: `disposable − (avgDailyVar × daysLeft) − remainingBills`.
  Zero-state breakdown:
  - `expense = 0` → `avgDailyVar = 0` → `projectedVar = 0` →
    `forecast = disposable − remainingBills`. Correct.
  - `recurring = 0` → `remainingBills = 0` → forecast tracks daily
    spend only. Correct.
  - Both zero → `forecast = disposable` (no projection drag yet).
- `ForecastCard.shouldRender(daysOfData ≥ 3)` hides the card during
  the first 2 days of the month, so the zero-data window can't
  display a misleadingly perfect forecast.

### 2.4 PDF monthly reports 🟢
- `utils/pdfReport.ts` exports `exportMonthlyPdf(monthKey, currency)`
  and `exportYearlyPdf(year, currency)` via `expo-print` +
  `expo-sharing`. Both use a lazy-required `getPrint()` so test
  environments missing the native module don't crash at eval.
- Surfaced in Settings → Data with row labels `me.export.pdfMonth`
  (current-month subtitle) and `me.export.pdfYear` (current-year
  subtitle).
- A single annual PDF covers the same ground as the "tax-season
  bundle" the plan called for, with one fewer share-sheet step.

### 2.5 Net worth chart polish 🟢
- `refreshTodaySnapshot()` is called on every transaction
  add/update/delete and every account upsert/delete (and
  balance-adjustment path) in `hooks/useAppData.ts`, plus boot.
- `NetWorthChart` subscribes via `useTransactions({ limit: 1 })`,
  which re-runs on every `bump()`; its `useMemo` keys off the
  bump array length so the chart re-fetches `recentSnapshots(90)`
  whenever today's snapshot is rewritten. Intra-day refresh works.

---

## 3. Improvements after initial acceptance pass 🟢

Features and fixes that shipped after the §1 / §2 status freeze.
All landed on `master` and are in the release APK on the dogfood
device.

### 3.1 Cross-currency transfer math
- `transactions.to_amount` column added (idempotent ALTER).
- Apply, reverse (delete + edit), and scheduled-apply paths all use
  `to_amount ?? amount` so a USD → KZT transfer debits USD source
  correctly + credits KZT destination with the FX-converted amount.
- Smart Add computes `toAmount` whenever From and To currencies
  differ; legacy rows + same-currency transfers stay as before.

### 3.2 Cross-currency / triple-currency transaction display
- `TransactionRow` now has three display modes:
  1. Cross-currency transfer → main = From debit, sub = To credit.
  2. Triple-currency transfer (entry differs from both sides) →
     LARGE entered amount + SMALL `debit · credit` line with a
     raised middle dot.
  3. Mixed-currency expense/income → original LARGE, account
     SMALL (existing behavior).
- Activity + Home recent rows pass `fromCurrency` / `toCurrency`
  from a precomputed account-id → currency map.

### 3.3 Account-label line + account icon on rows
- Between title (category) and subtitle (note), every row now shows
  the account name (or `From → To` for transfers) with a small
  brand-colored icon. Caller computes the label + icon once per
  render so 200-row lists don't fan out N SQLite queries.
- Includes archived accounts in the lookup so historical rows still
  show their context.

### 3.4 Account icon picker
- `AccountSheet` has a 12-option icon palette below the color
  swatches (Wallet, Banknote, PiggyBank, CreditCard, TrendingUp,
  Briefcase, Home, Plane, Gift, Heart, Star, Target).
- Override stored on `accounts.icon`. Choosing the type's default
  reverts to inherit-from-type so changing the type later still
  updates the visual.
- Me-tab account list, AccountPicker (Smart Add + transfer pickers),
  PredictedStrip — all now read `a.icon` instead of a hardcoded
  wallet/credit-card glyph.

### 3.5 Restore-from-backup JSON import
- `utils/dataExport.ts` now exports `importData()` alongside the
  existing exporter.
- DocumentPicker → JSON parse + validate (schemaVersion guard,
  legacy camelCase mapping) → native confirm Alert ("This cannot be
  undone") → single SQLite transaction (DELETE every backup table →
  bulk INSERT) → `bumpVersion()` to refresh subscribed UI.
- Per-active-profile; other profile DB files untouched.
- Export now covers all 10 user-authored tables (was 6): added
  `custom_categories`, `debts`, `goals`, `net_worth_snapshots`.
- `schemaVersion: 2` + `exportedAt` header on the JSON.
- New keys localized across 50 locales.

### 3.6 Transfer picker UX
- Both From and To pickers see the same set of accounts (no
  exclusion). Picking the opposite side's account swaps the two
  instead of nudging to "next available".
- Archived accounts currently selected on either side stay
  selectable on both sides (so editing an old transfer with a
  retired wallet works); `AccountPicker` keeps `value` even when
  archived. Visual "Archived" pill + 60% name opacity.

### 3.7 Delete confirmations everywhere
- Swipe-delete, sheet-delete, edit-screen delete on transactions
  all open a native `Alert` with Cancel / Delete and the
  `common.cannotBeUndone` line.
- Plan-tab recurring quick-delete now confirms (was direct delete).
- Existing Goal / Debt / Recurring sheets already confirmed; left
  those.
- Bulk-localized across 50 locales.

### 3.8 Forecast / On-track card fixes
- Always-open after the BalanceCard refactor (no chevron toggle).
- `daysLeft === 0` short-circuit dropped — card stays visible on
  the last day of the month.
- 3-day warmup gate dropped to 1 — card shows from day 1.
- Avg-daily-variable now excludes recurring-linked transactions:
  `expense` filter checks `!t.recurringId`. Recurring bills
  appear once via `remainingBills` and don't contaminate the
  per-day rate.
- One-shot DB backfill at boot: pre-fix transactions came from the
  recurring-checkmark flow with `recurring_id = NULL` and only the
  join in `paid_items`. The backfill sets `recurring_id` on those
  historical rows by reading `paid_items`.

### 3.9 Recurring → paid-month linking
- Plan tab stamps `markMonth` on the prefill it builds for the
  recurring-checkmark flow. Submit links `paid_items` to that
  month so a future-dated transaction still ticks the originating
  month (not the future one).
- New transactions from the recurring flow also persist
  `recurring_id` on the row directly (was missing).

### 3.10 Smart Add converted-amount precision
- All conversion previews under the amount entry round to 2
  decimals regardless of the destination currency's natural minor
  unit (KZT, KWD).
- Edit-mode override field seeds with `.toFixed(2)` so legacy FP
  noise like `108.50000003` doesn't leak in.

### 3.11 Sheet titles
- Category sheet: "New category" ↔ "Edit category".
- Recurring sheet: 4-way matrix —
  `New|Edit recurring expense|income`.
- Both localized across 50 locales.

### 3.12 Recent-tx row parity
- Home `recentTxns` rows now use the same TransactionRow props as
  Activity (accountLabel, accountIcon, accountColor, fromCurrency,
  toCurrency), so cross-currency / triple-currency layouts show
  identically on both surfaces.

### 3.13 Production install workflow
- Switched the dogfood phone (S26) from debug-variant `expo
  run:android` (Metro-dependent, brittle reopen) to release-variant
  builds with the debug keystore as signer. App now launches
  standalone and survives cold-boot without `adb reverse`.
- Workflow: `npm run android:generic -- --variant release` (~25-45s
  per build).

---

## 4. Deferred to v1.1+

These were intentionally cut from v1 to keep the launch scope sane.

- **Voice dictation** — `expo-speech-recognition` plugin + permission
  strings + `components/VoiceMicButton.tsx` were removed from the v1
  build. Restoring is: `git checkout v1.0.0 -- components/VoiceMicButton.tsx`,
  `npm i expo-speech-recognition`, put the plugin block back in
  `app.config.ts`, restore `NSMicrophoneUsageDescription` /
  `NSSpeechRecognitionUsageDescription` and `RECORD_AUDIO`, then
  re-import + re-render the `<VoiceMicButton/>` in `app/add.tsx`.
  Permission-explainer modal still needed before re-enabling.
- **SQLite + MMKV encryption** — op-sqlite migration with SQLCipher,
  key in expo-secure-store, biometric gate. Privacy policy currently
  honestly discloses on-device unencrypted.
- **Cloud sync & backup** — encrypted multi-device. Requires a backend.
- **Shared profiles** — Splitwise-style expense splitting.
- **Apple Watch / Wear OS** — companion app.
- **iOS WidgetKit + Android RemoteViews widgets** — native modules
  for both platforms.
- **OCR receipt scanning** — `ReceiptScanButton.tsx` placeholder
  exists; real VisionKit / ML Kit integration deferred.
- **SMS parsing** — Kazakh/Russian bank templates. `READ_SMS` triggers
  Play review for "core functionality."
- **Multi-currency at full coverage** — accounts already have per-
  account currency + FX cache. Outbound auto-refresh + opt-in toggle
  remain to ship.

---

# Production Release Checklist

## 0. Prerequisites

- Apple Developer Program account ($99/yr, 24-48hr activation).
- Google Play Console account ($25 one-time).
- A real domain you control (privacy policy + support email).
- Bundle IDs locked: `com.moneyflow.generic` (Flow) +
  `com.moneyflow.amanah` (Amanah) on both stores.

## 1. Native build prep

### 1.1 Version + build numbers
- Bump `version` and `ios.buildNumber` / `android.versionCode` in
  `app.config.ts` for both flavors. iOS build numbers must increase
  monotonically per upload; Android `versionCode` must increase
  monotonically per submitted APK/AAB.

### 1.2 Production signing
- iOS: EAS Build will generate / reuse the provisioning profile and
  distribution cert. First run prompts for Apple ID login.
- Android: generate a release keystore (or let EAS manage one).
  **Back up the keystore** — Google Play uses it as the upload key
  forever.

### 1.3 Sentry (if going with §1.1)
- Add `sentry-expo` config to `app.config.ts`.
- Set DSN as an EAS secret, not a hardcoded value.
- Source-map upload step in `eas.json` build hooks.

### 1.4 Build release APK / AAB / IPA
```bash
npm run build:generic:ios       # iOS production .ipa via EAS
npm run build:generic:android   # Android .aab via EAS
npm run build:islamic:ios
npm run build:islamic:android
```
or for a local AAB:
```bash
npm run build:aab:generic
npm run build:aab:islamic
```

## 2. App Store Connect

### 2.1 App record (per flavor)
- App name (≤30 chars): "Flow — Money" / "Amanah — Halal Money".
- Bundle ID matches the build.
- Primary language, primary category (Finance), secondary (Lifestyle
  or Productivity).
- Age rating questionnaire (Frequent/Intense Realistic Violence: No;
  etc. — Finance app, almost all No).

### 2.2 Metadata
- Subtitle (≤30 chars).
- Promotional text (≤170 chars, can be updated without re-review).
- Description (≤4000 chars), in EN + AR for Amanah, EN + RU + KK +
  TR + ID + MS for the markets you care about.
- Keywords (100 chars, comma-separated, no spaces after commas).
- Support URL + Marketing URL + Privacy Policy URL (required).

### 2.3 Screenshots (per locale)
- iPhone 6.7" (mandatory): 1290×2796 — 3-10 screenshots.
- iPad 13" (only if iPad build supported).
- Capture with iPhone 17 Pro sim. Tools: simulator screenshot →
  optional Bezel/Fastlane snapshot for framed marketing shots.

### 2.4 App privacy
- "Data Used to Track You": **None** (Sentry anonymized, no ad SDKs).
- Data linked to user: nothing (on-device).
- Data not linked: financial info (used), user content (used),
  diagnostics (used if Sentry on, opt-out available).

### 2.5 Build submission
- Upload via EAS Submit:
  ```bash
  eas submit -p ios --profile generic --latest
  eas submit -p ios --profile islamic --latest
  ```
- Pick the build, attach to the version, complete the export
  compliance question (uses standard HTTPS / non-exempt encryption?
  Almost certainly **No** if you're not adding custom crypto).
- Submit for review. Apple SLA: usually <24h, occasionally 2-3 days.

### 2.6 Common rejection vectors to pre-empt
- Guideline 2.1 (no functional content): make sure the app works on
  fresh install without any account / sign-up gate.
- Guideline 4.0 (design): every modal needs an obvious close button.
- Guideline 5.1.1 (privacy): privacy URL must actually resolve and
  describe data practices accurately.
- Guideline 5.1.2 (data collection / storage / use): the app's
  privacy nutrition label must match the in-app disclosures.

## 3. Google Play Console

### 3.1 App record (per flavor)
- App name (≤30 chars).
- Default language.
- Category: Finance.
- Tags: Budget, Personal finance, Expense tracker.

### 3.2 Store listing
- Short description (≤80 chars).
- Full description (≤4000 chars).
- App icon: 512×512 PNG, no transparency.
- Feature graphic: 1024×500 PNG/JPG, no transparency.
- Screenshots: 1080×1920 minimum, 8 max, 4-8 recommended.

### 3.3 Data safety form
- Match the iOS privacy nutrition labels — same answers.
- Specifically declare: data is collected (financial, app activity)
  but not shared with third parties (unless you ship Sentry).
- Data is **encrypted in transit** (only for the FX rate fetch and
  Sentry, otherwise no network).
- Data is NOT encrypted at rest (until §3 deferred encryption lands).

### 3.4 Content rating
- IARC questionnaire — Finance app, expect 3+ in all regions.

### 3.5 Target audience
- 18+ to avoid the COPPA / GDPR-K self-certification path.

### 3.6 Internal testing → Closed → Open → Production
- Upload AAB to **Internal testing** track first (instant, no review).
- Promote to **Closed testing** with a small cohort (still no review).
- Promote to **Production** for review (Google SLA: 1-7 days).

### 3.7 Common rejection vectors to pre-empt
- Permissions: `RECORD_AUDIO`, `READ_SMS` (if added later) — declare
  the use case clearly in the listing.
- "Sensitive permissions" form for finance apps: be ready to declare
  no account aggregation / no scraping.
- App content forms — fill ALL of them. Google rejects automatically
  if any are incomplete.

## 4. Pre-submission verification

```bash
# Tree-shake gate still passing
npm run verify:tree-shake

# Type-check
npm run typecheck

# Unit tests
npm test

# Real-device smoke
# - Cold launch on iPhone 12 (oldest reasonable target) for Flow
# - Cold launch on Pixel 6 + Galaxy S26 for Flow + Amanah
# - Switch locale to ar-SA — RTL mirror, Hijri hero, Arabic-Indic
# - Force-quit during a save — DB should be intact on next launch
```

## 5. Day-of submission

1. Tag the release: `git tag v1.0.0 && git push --tags`.
2. EAS Build production (both flavors, both platforms).
3. EAS Submit (both flavors, both platforms).
4. Monitor reviews; respond to App Store reviewer messages within
   24h (rejections that go un-answered for 7 days auto-close).
5. Once live, enable **phased release on Play** (1d/2d/4d/7d/14d
   to ramp) and **Apple's 7-day phased rollout** to keep blast
   radius small if a bad bug ships.

## 6. Post-launch (first 2 weeks)

- Watch crash-free user rate. Target: >99.5%.
- Watch reviews — respond to every 1-2-3⭐ review within 48h.
- Monitor Play Console "Bad behavior" alerts (ANRs, crashes).
- Have a hotfix path ready: minor version bump (1.0.1), patch
  release through Play Internal → Production in <24h.
