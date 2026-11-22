# Flow roadmap

Living document. Dates are when a decision was made, not promises.
Last updated 2026-11-22.

## In flight — 1.2.0

- iOS 1.2 (build 4) in App Review.
- Play: closed-testing release 4 (1.2.0), Testers Community group and the
  refreshed listing are in Google's review. App is free on Play as of
  2026-11-21 (permanent).
- Testers Community: 14-day closed test starts once Play shows the app as
  free and the release is live.

## Next build — 1.2.1

Already on `dev`, send when there is a reason to:

- Split: one total distributed across categories (Smart Add link + grid tile).
- Camera declared optional hardware (clears the Play availability warning).
- R8 minification + resource shrinking (clears the DEX warning, due Feb 2027).

## After the 14-day test

- Apply for Play production access, promote to production. Releases then go
  straight to production.
- Google trader-status declaration (due Feb 2027).

## 1.3 candidates, in order

1. Palette refresh. Variants captured 2026-11-22 (current / graphite +
   chartreuse / ink + saffron / espresso + sage); ink + saffron recommended.
   Do this before Pro, since it touches every screen.
2. Large-screen and landscape support (Android 16 ignores orientation locks
   on tablets and foldables).
3. Expo SDK upgrade (clears the deprecated edge-to-edge warning).
4. Flow Pro, one-time unlock: products in both consoles, RevenueCat,
   paywall screen, Restore. Everything shipped free today stays free.

## Later

- Sync and household sharing, end-to-end encrypted. The subscription anchor;
  Pro included.
- Widgets, Apple Watch, Wear OS.
- AI monthly review and spike explanations (API cost, so subscription).
- Trip cost splitting with friends; shared events.
- Reports: yearly PDF, tax CSV packs, scheduled backups to Drive / iCloud.

## Decided against

- Home period filters (Today / Week / Year): Home stays month-centric;
  Activity and Insights cover other ranges.
- Swiping between tabs: conflicts with month swipe and row swipe actions.
- Caps on accounts, bills or categories as a paywall.
- Making Split paid now: it shipped free and is in the store description.

## Done recently

- 1.2.0: Events / trips, Plan month navigation, TestFlight feedback fixes
  (iOS date picker, onboarding keyboard, backup restore keeping categories,
  account reordering on the new architecture), Activity category chips,
  Accounts explainer, icon packs, Tab order, icon-only search chip.
- 1.1.1: Plan month browsing, scheduled bills from future months.
