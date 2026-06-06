# v2 Pre-ship Device Matrix Test

Phone-only matrix. Run every section on every device.

## Devices

| ID | Device | Width | Notes |
|----|--------|-------|-------|
| A | iPhone SE (3rd gen) sim | 4.7" / 750×1334 | smallest iOS |
| B | iPhone 17 Pro Max sim | 6.9" / 1290×2796 | largest iOS |
| C | Physical iPhone | varies | real perf |
| D | Pixel 4a AVD | 5.8" / 1080×2340 | smallest mainstream Android |
| E | Pixel 7 AVD | 6.3" / 1080×2400 | mid-size baseline |
| F | Galaxy S26 Ultra (physical) | 6.8" / 1440×3088 | largest Android |

## Cold-boot + setup

For each device:
- [ ] Install release APK / IPA.
- [ ] First launch hits Onboarding, then Home.
- [ ] No "stuck on splash" / blank screen / red-screen JS error.
- [ ] Skeleton renders without being clipped under the notch.
- [ ] Status bar text is readable against `theme.bg`.

## Home tab

- [ ] Brand row + profile chip + streak badge all visible.
- [ ] Hero amount fits one line at default Dynamic Type.
- [ ] On-track Forecast card renders (today is past day 1).
- [ ] Avg/Day excludes recurring expenses (matches yesterday's expectations).
- [ ] HomeActionCard (if any insight is firing) is tappable and routes correctly.
- [ ] Recent rows: 3 max + "View all". Each row shows category title, account name + icon, note if any.
- [ ] Cross-currency transfer rows show two-line amount stack.
- [ ] Triple-currency transfer rows show three-line stack with raised `·`.

## Activity tab

- [ ] Segmented control (Categories / Transactions) responds.
- [ ] Month carousel (pill-shaped arrows + label) is centered, not cut off.
- [ ] Tapping label opens month picker.
- [ ] Per-day total renders on the right edge.
- [ ] Chart-icon button opens the ChartModal slide-up sheet.
- [ ] ChartModal: stat cards visible, NetWorthChart renders, share-recap CTA works.
- [ ] Double-tap on Activity tab toggles between Categories ↔ Transactions.
- [ ] Empty-state icon + copy renders when filtered into emptiness.

## Smart Add

- [ ] FAB tap opens /add modal near-instant (fade, 1ms).
- [ ] Numpad: 5 columns × 4 rows, all cells equal size, no overflow on iPhone SE / Pixel 4a.
- [ ] Math chain works: `100+50*2` → `=` evaluates → `200` → ✓ submits.
- [ ] `%` resolves iOS-style: `500*60%` → `300`, `500+30%` → `650`.
- [ ] Currency-format preset shows correct grouping (e.g. `1,234.56` vs `1 234,56`).
- [ ] Expense: account chip shows account icon (your chosen one, not hardcoded wallet).
- [ ] Income: same.
- [ ] Transfer: From + To pickers both show all accounts; selecting the opposite side's account swaps the two.
- [ ] Transfer USD → KZT (display=KZT): entry currency = USD by default; converted preview reads `≈ ₸ 54,250.00` with 2 decimals.
- [ ] Triple-currency transfer (entry EUR, From USD, To KZT): conversion shows two rows.
- [ ] Note placeholder reads "Notes" (or localized equivalent).
- [ ] Submit success: confetti + haptic (or static + haptic if reduce-motion is on).
- [ ] Edit existing transaction: form prefills, override field is `108.50` not `108.50000003`.
- [ ] Delete-from-edit shows confirm Alert with "This cannot be undone".

## Plan tab

- [ ] Recurring section: each row tappable, type-correct title in editor sheet.
- [ ] Tap checkmark on May recurring → /add opens → pick June 5 date → submit → return to Plan → May STILL shows checked.
- [ ] When June 5 actually arrives (you can manipulate device date to verify), the txn applies + balance moves + May checkmark persists.
- [ ] Goals + Debts (if you have any) render and edit correctly.
- [ ] Plan-tab recurring quick-delete shows confirm Alert.
- [ ] Subscription audit annual burn line, stale tag, detected candidates surface.

## Me tab

- [ ] Profiles section: switch + add work.
- [ ] Accounts section: each account shows its custom icon (your chosen one).
- [ ] Open AccountSheet → edit name / type / color / **icon** / currency / archived → save → list updates immediately.
- [ ] Delete account confirms cascade.
- [ ] Settings ⚙ button opens Settings modal.

## Settings

- [ ] Language picker: switch to Russian → UI reloads in Russian.
- [ ] Currency picker.
- [ ] Currency format picker.
- [ ] Biometric Unlock toggle (will prompt OS).
- [ ] Export JSON, CSV, PDF month, PDF year all share via system share sheet.
- [ ] Import JSON: pick a previously exported file → confirm dialog → restore replaces active profile's data.
- [ ] Privacy + Terms links open correct hosted URL.

## Localization sweep

Run for **at minimum**: en-US, ru-RU, ar-SA (RTL).

- [ ] No hardcoded English on any tab.
- [ ] ar-SA: layout mirrors RTL, numpad stays LTR, Arabic-Indic numerals show on currency formatter.
- [ ] Date format follows locale.
- [ ] HomeActionCard string ("Hawl in 30 days" etc.) shows in chosen locale or English fallback.

## Accessibility

- [ ] VoiceOver (iOS): swipe through Home → Add → submit → Activity using only the screen reader. Everything reachable + labeled.
- [ ] TalkBack (Android): same.
- [ ] Dynamic Type 3xLarge: no overflow on Home / Activity / Plan / Me / Settings.
- [ ] Reduce Motion ON: SuccessOverlay shows static check (no confetti), FAB doesn't pulse, StreakBadge doesn't glow.
- [ ] All icon buttons have ≥44pt iOS / ≥48dp Android tap area (counting hitSlop).

## Performance

- [ ] Cold boot to interactive Home < 3s on the slowest device.
- [ ] FAB tap → /add fully open < 100ms (fade with 1ms duration is effectively instant).
- [ ] Activity scroll with 200+ rows is smooth (no dropped frames).
- [ ] Submit → Activity row visible within ~150ms.

## Stress + edge cases

- [ ] Add 100 transactions quickly. Memory + frame rate hold.
- [ ] Multi-currency: 5+ accounts in different currencies. Hero + transfers convert correctly.
- [ ] FX cache stale (toggle auto-refresh off, manually edit cache to 99-day-old timestamp). Convert still works with fallback.
- [ ] Force-quit during a write. Re-open: DB intact, no half-rows.
- [ ] Toggle profile mid-session. New profile's DB used, accounts/budgets re-read.

## Pass/fail tally

| Device | Cold-boot | Home | Activity | Smart Add | Plan | Me | Settings | i18n | a11y | Notes |
|--------|-----------|------|----------|-----------|------|-----|----------|------|------|-------|
| A iPhone SE sim | | | | | | | | | | |
| B 17 Pro Max sim | | | | | | | | | | |
| C iPhone physical | | | | | | | | | | |
| D Pixel 4a AVD | | | | | | | | | | |
| E Pixel 7 AVD | | | | | | | | | | |
| F S26 Ultra | | | | | | | | | | |
