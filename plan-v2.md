# MoneyFlow v2 — UX Redesign for Public Release

## Context

**Why this change.** v1 is shipped: both flavors (Flow, Amanah) verified end-to-end on iPhone 17 Pro sim, Pixel 7 emulator, and a real Galaxy S26 Ultra. All v1 features work, the 4-layer tree-shake is solid, and the Drizzle data layer scales. But the UX has three concrete friction points the user (now an actual user of the app on their phone) wants fixed before going public:

1. **Adding a transaction takes ≥5 interactions** — FAB → numpad → category → account → (note) → submit. The most common action is the slowest.
2. **Home screen is too dense** — `BalanceCard` + `MiniTrendChart` + 18-tile category grid + recent + (Hijri + Zakat + Ramadan in Amanah). Overwhelming on first launch.
3. **More tab is a junk drawer** — 5 sub-tabs (Recurring / Budgets / Analytics / Accounts / Settings) hidden behind one icon. Discoverability collapses.

**v2 user decisions locked in (Q&A).**
1. **Target user:** public release on Play + App Store. Amanah specifically targets MENA + Pakistan + Indonesia + Malaysia.
2. **Scope appetite:** total redesign — new IA, new screens, new patterns acceptable.
3. **Constraints to preserve:** both flavors stay; 4-layer tree-shake guarantee untouched; FeatureSlots contract additive only; no v1 features deleted (some move).

**Outcome.** Three shippable milestones over ~4-5 weeks: **v2.0 (IA + Home)** as Phase 5+6, **v2.1 (Smart Add)** as Phase 7, **v2.2 (MENA + a11y + polish + ship)** as Phases 8-11.

---

## Recommended approach

**New IA:** 4 bottom tabs + center FAB.
```
[ Home ]  [ Plan ]  [ + FAB ]  [ Activity ]  [ Me ]
```
- **Home** = right-now snapshot (Disposable hero, 1 action card, 3 recent rows). One thing.
- **Plan** = forward money (Recurring + Budgets + islamic Zakat/Sadaqa via slot).
- **FAB** → `/add` modal, redesigned around Smart Add.
- **Activity** = backward money (search + filters + day-grouped list + analytics-on-scroll header).
- **Me** = Accounts on top + Settings + (islamic) mazhab/method + About + privacy.

The existing `app/(tabs)/more.tsx` collapses entirely; nothing disappears, things move to the temporal-axis tab where they belong (forward = Plan, backward = Activity, identity/setup = Me).

**Add Transaction → "Smart Add":** median expense becomes 3 interactions (FAB → type "12 coffee" → submit) with 4-layer category prediction (note keyword → merchant memory → recent-by-time → fallback) and `@react-native-voice/voice` for hands-free input. Override path keeps the explicit category grid + account picker for power users.

**Stack additions (kept minimal):** `@react-native-voice/voice` (free, on-device on iOS 15+/Android), `expo-localization` (already installed, deeper use), Sentry-Expo (privacy-toggled, default off in Amanah). NO new chart library. NO new state library. NO backend.

---

## Phase 5 — IA refactor (foundation, ships independently)

**Goal:** new tab structure, no per-tab UX changes yet. Pure relocation.

### Files

| File | Change |
|---|---|
| [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) | Register 4 tabs: Home / Plan / Activity / Me. FAB stays middle-anchored absolute; widen `tabBarStyle` if needed. |
| [app/(tabs)/history.tsx](app/(tabs)/history.tsx) | Rename to `app/(tabs)/activity.tsx`. Pull in Analytics sub-tab content from `more.tsx` as a collapsible header section. |
| `app/(tabs)/plan.tsx` | New. Extract Recurring + Budgets sections from `more.tsx`. Mount `<FeatureSlots.PlanTabExtras/>` at the bottom (islamic: Zakat + Sadaqa entries). |
| `app/(tabs)/me.tsx` | New. Top: Accounts list (current `more.tsx` Accounts sub-tab). Below: Settings (current `more.tsx` Settings sub-tab). Bottom: About + privacy. Mount `<FeatureSlots.MeTabExtras/>` (islamic: mazhab + prayer method rows). |
| [app/(tabs)/more.tsx](app/(tabs)/more.tsx) | Delete. |
| [features/index.ts](features/index.ts) | Add `PlanTabExtras`, `MeTabExtras`, `HomeHeroExtras`, `ActivityHeaderExtras` to `FeatureSlotSet`. Generic defaults to `EmptySlot`. Keep `MoreMenuItems` as type alias of `PlanTabExtras` for back-compat. |
| [features/islamic/slots.tsx](features/islamic/slots.tsx) | Wire `MoreMenuEntries → PlanTabExtras`; wire mazhab/method links to `MeTabExtras`. |

### Acceptance
- `npm run start:generic` and `npm run start:islamic` both boot and show new tab bar.
- Every v1 feature still reachable (recurring mark-paid, budget edit, account create, currency setting, biometric toggle, data export, halal filter, zakat calc).
- `npm run verify:tree-shake` PASS.
- `npm test` PASS (zakat math unchanged).

**ETA: 2 days.**

---

## Phase 6 — Home redesign (ships with Phase 5 as v2.0)

**Goal:** strip Home density. One actionable card max. Recents capped at 3.

### v2 Home (generic)
```
Flow                                     [🔥3]
┌─────────────────────────────────────────┐
│  May · Disposable                       │
│     $1,247.50                           │  ← THE one number
│  $3,200 in · $1,952 out · 28 days left  │
└─────────────────────────────────────────┘
⚠ Groceries 90% of budget — $40 left        ← max 1 actionable card
Recent ▸                                     ← 3 rows + "View all →" → Activity
 ☕ Coffee · Bank          -$4.50  2:14 PM
 🛒 Groceries · Card      -$48.20  Yesterday
 💵 Salary · Bank      +$3,200.00  May 1
```

### v2 Home (islamic) — same plus a single Hijri-first hero row
```
Amanah                                   [🔥3]
١٥ شوال ١٤٤٧ هـ · 2 May 2026                ← HomeHeroExtras: Hijri large, Greg small grey
┌─────────────────────────────────────────┐
│  Disposable · شهر شوال                  │
│     ر.س ٤٬٢٥٠٫٥٠                        │  ← Arabic-Indic numerals when locale=ar-*
└─────────────────────────────────────────┘
⚠ Hawl approaching — review zakat in Plan ▸  ← single action card, gated to "within 30 days"
Recent ▸ …
```

### Files

| File | Change |
|---|---|
| [components/BalanceCard.tsx](components/BalanceCard.tsx) | Add `<DisposableHeroCard/>` variant. Keep `BalanceCard` exported as alias for back-compat. Lead with Disposable, demote Net to Me/Accounts header. |
| `components/HomeActionCard.tsx` | New. Reads `useBudgets()`, `useMonthTotalsByCategory()`, `useRecurring()` (+ islamic: `useZakatCalculation()`). Picks top-1 actionable insight. Empty state: renders nothing. |
| [app/(tabs)/index.tsx](app/(tabs)/index.tsx) | Strip `<MiniTrendChart/>` (lines 96-101) and `<CategoryGrid/>` (lines 103-113) from Home. Cap `recentTxns` to 3 + "View all" link to `/activity`. |
| `features/islamic/hijri/HijriGregorianHero.tsx` | New. Replaces `HijriDateBadge` for islamic Home brand row. Hijri large (`font.displayArabic`), Gregorian small grey. |
| [features/islamic/slots.tsx](features/islamic/slots.tsx) | Bind `HomeHeroExtras: HijriGregorianHero`. |

### Acceptance
- Home renders ≤6 distinct visual blocks.
- Removed components (`MiniTrendChart`, `CategoryGrid`) still mount on Activity tab — verify chart + grid show there as scroll-up header.
- Action card respects "no gamification of ibadah" — never surfaces a Zakat/Sadaqa total as an "achievement"; only logistical reminders.

**ETA: 2 days.**

---

## Phase 7 — Smart Add (ships as v2.1, the user-felt feature)

**Goal:** median expense in 3 interactions. Voice support. Override path preserved.

### v2 Add modal layout
```
[×] ●●● Expense  Income  Transfer  [✓]      ← mode pill row (top)
                                              
        $ ▎ 0                                 ← big amount, blinking cursor
                                              
   ┌────────────────────────────┐             
   │ + What was it for?      🎤 │             ← single text field + mic
   └────────────────────────────┘             
                                              
   ▒▒ Coffee  $4.50 · Bank   ▒▒ Lunch $12     ← Smart Suggestions (max 4)
   ▒▒ Uber    $14   · Bank   ▒▒ Groceries…    ← fuzzy frequent + recent merchants
                                              
   [ 1 ][ 2 ][ 3 ]                            
   [ 4 ][ 5 ][ 6 ]                            ← numpad (LTR-locked, unchanged)
   [ 7 ][ 8 ][ 9 ]                            
   [ . ][ 0 ][⌫]                             
                                              
   Predicted: 🍴 Food · 💳 Bank   tap ▾       ← live prediction strip, expand for grid
                                              
   [        Add Expense  ✓               ]    
```

### Smart Category Prediction — 4 layers, chained, cheap

| Layer | Source | Hit rate (est) | Cost |
|---|---|---|---|
| **L1** Note keyword | Static index `coffee→coffee, uber|lyft→transport, kfc|mcd|lunch→food, pharmacy→health, rent→rent, …` | ~50% | 0 ms |
| **L2** Merchant memory | New `merchant_memory` table (FTS5). Updated on every successful add. | +25% | <1 ms |
| **L3** Recent-by-time | If no note + amount within 20% of last txn at this hour-of-day on this weekday → mirror its cat/account | +10% | 1 SQL query |
| **L4** Default fallback | Most-used category for current account this month; account = MMKV `defaultAccountId` (set after first 5 txns) | catch-all | <1 ms |

### Voice — `@react-native-voice/voice` (recommended)

| Option | Bundle hit | Latency | Privacy | Cost | Verdict |
|---|---|---|---|---|---|
| `@react-native-voice/voice` (Apple Speech / Android Speech) | small | <500 ms | on-device for short utterances on iOS 17+ | free | **SHIP IN v2** |
| Local Whisper.cpp via JSI | +75 MB | 1-3 s | fully on-device | free | DEFER |
| Server Whisper API | none | ~1 s + net | sends audio off-device | $0.006/min | DEFER (violates Amanah privacy) |

Tap mic → record → on stop, parse `/(\d+(?:\.\d+)?)\s+(.*)/` to extract amount + note → run L1-L4 prediction → fill predicted strip. User reviews and taps Add. **Two interactions** for the entire add flow.

### Files

| File | Change |
|---|---|
| [utils/db/schema.ts](utils/db/schema.ts) | Append `merchantMemory` table + FTS5 virtual table + insert/update trigger. Reserve `transactions.receiptImagePath` (additive, nullable) for v2.1 OCR. |
| [utils/db/client.ts](utils/db/client.ts) | Add idempotent DDL for the new table to `createTables()`. |
| `hooks/useSmartPredict.ts` | New. 4-layer predictor returning `{category, accountId, confidence}`. |
| [hooks/useFrequentTxns.ts](hooks/useFrequentTxns.ts) | Split into `useExactReplays` (current) + `useFuzzyMerchants` (groups by tokenized note). |
| [app/add.tsx](app/add.tsx) | Reorder: amount → note (with mic) → smart suggestions → predicted strip → numpad → CTA. Hide cat grid + account picker behind "Override ▾" expand. |
| `components/SmartSuggestionRow.tsx` | New. Merges fuzzy + exact-replay rows. |
| `components/PredictedStrip.tsx` | New. Single-line "🍴 Food · 💳 Bank — tap to override". |
| `components/VoiceMicButton.tsx` | New. `@react-native-voice/voice` integration with permission flow + Arabic locale support. |
| [package.json](package.json) | Add `@react-native-voice/voice`. |
| [app.config.ts](app.config.ts) | Add iOS `NSSpeechRecognitionUsageDescription` + Android `RECORD_AUDIO` permission via plugins. Add iOS Shortcuts intent + Android App Shortcuts (manifest declarations only — no native code). |

### Acceptance
- Median expense in 3 taps, prediction correct ≥75% on dogfood data.
- Voice: "twelve fifty coffee" → amount=12.50, note="coffee", category=food, account=lastUsed.
- Override path: tap predicted strip → cat grid + account picker expand.
- Existing exact-replay quick-add still works (one row of `SmartSuggestionRow`).
- `npm run verify:tree-shake` PASS (no new islamic-side surface).

**ETA: 4 days.**

---

## Phase 8 — MENA polish (ships with 9-11 as v2.2)

**Goal:** Arabic UI feels native, defaults are right per region, cultural review clean.

### Concrete changes

| Item | File | Fix |
|---|---|---|
| Arabic font loaded but unused | [constants/theme.ts](constants/theme.ts) | Add `font.bodyArabic = 'IBMPlexSansArabic_500Medium'` + `localizedFont(locale)` helper used by every `<Text>`. |
| Arabic-Indic numerals | [constants/currency.ts](constants/currency.ts) line 28 | Pass `locale + '-u-nu-arab'` to `Intl.NumberFormat` when locale starts with `ar`. Toggle `arabicNumerals` (default ON for ar-*) in Me settings. |
| Default currency by region | [app/onboarding.tsx](app/onboarding.tsx) line 24 | New `constants/regionCurrency.ts`: SA→SAR, AE→AED, EG→EGP, PK→PKR, ID→IDR, MY→MYR, TR→TRY, fallback USD. Use `Localization.region`. |
| Hijri-first hero | covered in Phase 6 | — |
| Streak excludes ibadah | [hooks/useStreak.ts](hooks/useStreak.ts) | When `IS_ISLAMIC`, exclude `zakat`/`sadaqa`/`qurban` categories from streak count. (Compromise vs. removing streak entirely; still honors §4.2 "no streaks for ibadah".) |
| Mazhab/method visible after pick | [app/(tabs)/me.tsx](app/(tabs)/me.tsx) | Show as readable rows with edit affordance. |
| RTL audit on new screens | Plan, Me, Activity-as-history | Re-run §3.3 checklist from v1 plan. |

### Cultural review checklist
- [ ] No figurative animation imagery (confetti dots ✓ already abstract).
- [ ] No "earnings since you started" / lifetime gamification.
- [ ] No social share of Sadaqa totals (verify v2 export doesn't dump these to a share sheet).
- [ ] Zakat disclaimer always-visible whenever a "due" amount is shown (Home action card included).
- [ ] Privacy disclosure shown before any third-party fetch (goldapi.io for nisab refresh; Aladhan if user opts in).
- [ ] No interest/riba framing on credit accounts.
- [ ] No Westernism copy patterns ("Treat yourself!", "You're crushing it!"). Audit `SuccessOverlay`, push notifications, empty states.

### Acceptance
- Saudi-region launch (sim with `Localization.region = 'SA'`): defaults to ar-SA + SAR + RTL + Hijri-first hero + Arabic-Indic numerals.
- English-fallback launch on en-US Android: layout LTR, Outfit font, Western numerals, USD.
- Cultural checklist all checked.

**ETA: 3 days.**

---

## Phase 9 — Accessibility audit

**Goal:** VoiceOver + TalkBack walkable. Reduced-motion respected. Touch targets compliant. Dynamic Type works.

### Concrete fixes

| Component | Issue | Fix |
|---|---|---|
| FAB ([components/FabButton.tsx](components/FabButton.tsx)) | already has label; pulse ring not gated | Gate `withRepeat` behind `useReducedMotion()` hook. |
| [components/TransactionRow.tsx](components/TransactionRow.tsx) | Row has no aggregated label | `accessibilityLabel="${name}, ${formatMoney(amount)}, ${dayStr(date)}"` + `accessibilityHint="Long press for halal status, swipe to delete"`. |
| [components/BalanceCard.tsx](components/BalanceCard.tsx) | Big numbers not labeled | Wrap in `<View accessible accessibilityLabel="...">`. |
| [app/add.tsx](app/add.tsx) amount display | No accessibility label, no live region | `accessibilityLabel + accessibilityLiveRegion="polite"`. |
| [components/SuccessOverlay.tsx](components/SuccessOverlay.tsx) | Confetti not gated | Gate confetti + checkPop scale behind reduced-motion; fall back to static check + haptic. |
| [components/StreakBadge.tsx](components/StreakBadge.tsx) | Looping glow not gated | Same. |
| Color contrast | `theme.text2`/`text3` against `bg2` | WCAG AA verification; add `theme.text2HighContrast` + Me toggle. |
| Dynamic Type 3xLarge | absolute sizes overflow | Add `adjustsFontSizeToFit` on amount + Hero numbers; verify `numberOfLines` on names; add `allowFontScaling={true}` defaults. |
| Touch targets | History chips at `paddingVertical: 6` (~28pt) | Bump to ≥44pt iOS / ≥48dp Android. |
| Toggle in `me.tsx` | Custom toggle missing role | `accessibilityRole="switch" + accessibilityState={{checked: bio}}`. |
| TalkBack/VoiceOver Arabic | English labels on Arabic locale | Localize all `accessibilityLabel`s once `t()` exists. |

### New components
- `components/AccessibleNumber.tsx` — composed-label + live-region wrapper.
- `hooks/useReducedMotion.ts` — `AccessibilityInfo.isReduceMotionEnabled()` listener.

### Acceptance
- VoiceOver: Home → Add (with mic) → submit → Activity reachable with screen reader only.
- TalkBack same.
- Dynamic Type 3xLarge: no overflow on Home/Add/Plan.
- Reduce Motion ON: confetti and pulse skipped; haptic + static check still fire.
- All touch targets pass platform minimums.

**ETA: 2 days.**

---

## Phase 10 — Production polish

**Goal:** real icons, splash, empty states, skeletons, error boundaries, crash reporting decision, store assets.

### Files

| Asset / file | Purpose |
|---|---|
| `assets/generic/{icon,adaptive-icon,splash}.png` | Real Flow icon. F-mark, monochrome variant for Android 13+ themed icons. |
| `assets/islamic/{icon,adaptive-icon,splash}.png` | Real Amanah icon. Geometric Islamic motif — NOT calligraphy. |
| `components/EmptyState.tsx` + `assets/illustrations/{flavor}/*.svg` | Activity empty / filter empty / Plan recurring empty / Plan budgets empty / Sadaqa empty (neutral, no pressure copy). |
| `components/Skeletons/{Home,Activity,Plan,Me}Skeleton.tsx` | Reanimated opacity-pulse blocks. Mount when `useAppDataReady()` is false. |
| `components/ErrorBoundary.tsx` + `components/ErrorFallback.tsx` | Wrap each tab; fallback: "Something went wrong — Reload". |
| `utils/sentry.ts` (or `utils/errorLog.ts` if Sentry off) | Crash reporting. PII-scrubbed (note field excluded from breadcrumbs). |
| [app/_layout.tsx](app/_layout.tsx) | Init Sentry + wrap each tab in `<ErrorBoundary/>`. |
| `assets/store/{flavor}/{ios,android}/screenshots/` | 5 screenshots per flavor per store, localized for Arabic. |

### Crash reporting decision
**Recommendation: Sentry ON, default opt-in, transparent toggle in Me → Privacy.**
- `sentry-expo`. Crashes only, no Performance.
- PII scrub: strip `note` field from breadcrumbs.
- Disclose in privacy nutrition label.
- Amanah: provide opt-OUT toggle visible in Me. (Default ON to keep quality data; user can flip.)
- Alternative if user prioritizes privacy: `expo-error-recovery` + offline log buffer + email-export-on-crash. Decision flagged in §Open Decisions.

### Privacy nutrition labels
| Type | Used? | Linked to identity? |
|---|---|---|
| Financial info | YES | NO (on-device) |
| User content (notes) | YES | NO |
| Diagnostics (Sentry if on) | OPTIONAL | NO (anonymized) |
| Location (Amanah, prayer times) | YES (local only) | NO |
| Identifiers / Contact info | NO | — |

### Acceptance
- Cold launch shows real splash → real Home (no `null` flash).
- Empty states render on fresh DB.
- Forced render error caught by boundary → fallback shown → reload works.
- Sentry test event reaches dashboard in dev (privacy-disable for prod build).
- 5 screenshots × 2 flavors × 2 stores = 20 store images assembled, Arabic-localized for Amanah.

**ETA: 4 days.**

---

## Phase 11 — Pre-release verification

**Goal:** lock in v2 quality before submission.

- Re-run all v1 acceptance from `plan.md` Phase 5 (RTL, Hijri, Zakat math, prayer times offline, tree-shake gate).
- New v2 acceptance: ≤3-tap add, voice flow on iOS+Android, IA navigability with stopwatch ("can a new user reach Recurring in <10s?"), accessibility walkthroughs.
- Device matrix: iPhone 12, S26 Ultra, Pixel 6 — both flavors, both languages.
- Beta cohort (TestFlight + Play Internal Testing) for 1 week.
- Submit to stores.

**ETA: 5 days incl. beta.**

---

## Critical files (modify carefully — high blast radius)

- [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) — IA root
- [app/(tabs)/index.tsx](app/(tabs)/index.tsx) — Home
- [app/add.tsx](app/add.tsx) — Smart Add
- [features/index.ts](features/index.ts) — FeatureSlots contract (additive only)
- [utils/db/schema.ts](utils/db/schema.ts) + [utils/db/client.ts](utils/db/client.ts) — `merchant_memory` FTS5
- [features/islamic/slots.tsx](features/islamic/slots.tsx) — slot bindings for new tabs
- [constants/theme.ts](constants/theme.ts) + [constants/currency.ts](constants/currency.ts) — Arabic font + numeral handling
- [app/onboarding.tsx](app/onboarding.tsx) — auto-detect locale + currency

---

## §Open Decisions (resolve before each Phase)

| # | Decision | Default | Resolve before |
|---|---|---|---|
| 1 | Voice provider: `@react-native-voice/voice` vs. local Whisper vs. server | `@react-native-voice/voice` | Phase 7 |
| 2 | Sentry default ON (opt-out) vs. OFF (opt-in) vs. local-only error log | ON, opt-out, scrub PII | Phase 10 |
| 3 | Receipt OCR in v2 or defer to v2.3? | DEFER, reserve schema | Phase 7 |
| 4 | Home widget in v2 or v2.3? | DEFER; ship App Shortcuts in v2 | Phase 7 |
| 5 | Streak: exclude ibadah from count, or remove StreakBadge in islamic? | Exclude (compromise) | Phase 8 |
| 6 | Default `arabicNumerals` ON for ar-* or off-by-default? | ON | Phase 8 |
| 7 | Net Balance position: Me/Accounts header vs. small Home pill | Move to Me; tiny "$ in / $ out / days left" line on Home | Phase 6 |
| 8 | Empty-state illustrations: commission custom, generative AI, or open-source library | Open-source placeholder for v2.0; commission for v2.2 launch | Phase 10 |
| 9 | Mazhab default: Hanafi global vs. Hanbali Saudi vs. detect by region | Detect by region with override | Phase 8 |
| 10 | MMKV iCloud/Google backup of prefs on reinstall | OFF by default; "Sync settings" toggle in Me | Phase 10 |
| 11 | Plan-v2 file location | Save as `plan-v2.md` in repo root alongside `plan.md` (v1) | execution start |

---

## Verification (end-to-end smoke after Phase 11)

```bash
# 1. Tree-shake gate (must remain passing across all phases)
npm run verify:tree-shake

# 2. Unit tests
npm test
# Expected: 45 zakat assertions still pass; new merchant-memory tests added in Phase 7

# 3. iOS sim — both flavors
npm run ios:generic    # Flow on iPhone 17 Pro
# Expected: 4-tab IA visible, Home shows Disposable + max 1 action card, Add modal in Smart Add layout
npm run ios:islamic    # Amanah on iPhone 17 Pro
# Expected: Hijri hero "١٥ شوال ١٤٤٧ هـ", Plan tab has Zakat/Sadaqa rows, Me tab has mazhab/method, Arabic-Indic numerals on ar-SA

# 4. Android — both flavors
npm run android:generic
npm run android:islamic
# Same expectations on Pixel 7

# 5. Voice flow
# Open Add → tap mic → say "twelve fifty coffee" → assert amount=12.50, note="coffee", category=food, predicted strip filled
# Same in ar-SA: "اثنا عشر ريال قهوة" → amount=12, note=قهوة, category=food (predicted via L1 keyword index pluralised for Arabic)

# 6. Accessibility
# VoiceOver iOS + TalkBack Android: Home → Add → submit → Activity reachable
# Reduce Motion ON: confetti skipped, static check shown
# Dynamic Type 3xLarge: no overflow on any of the 4 tabs

# 7. Real device (S26 Ultra)
# Reinstall both APKs (release variant), repeat 1-3 of 1-6 manually

# 8. Beta cohort feedback (TestFlight + Play Internal)
# 1-week soak, collect crash rate < 0.1%, no critical UX feedback
```

All pass = ready for store submission.
