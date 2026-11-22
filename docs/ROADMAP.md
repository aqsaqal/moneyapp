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
   Do this before any paywall work, since it touches every screen.
2. Large-screen and landscape support (Android 16 ignores orientation locks
   on tablets and foldables).
3. Expo SDK upgrade (clears the deprecated edge-to-edge warning).
4. Billing groundwork for Sync: RevenueCat, entitlement flag, paywall and
   Restore screens, products in both consoles. Ships with Sync, not before.

## Later

- Sync and household sharing, end-to-end encrypted. The subscription anchor.
- Widgets, Apple Watch, Wear OS.
- AI monthly review and spike explanations (API cost, so subscription).
- Trip cost splitting with friends; shared events.
- Reports: yearly PDF, tax CSV packs, scheduled backups to Drive / iCloud.

## Monetisation model

Free to download, and everything that runs on the device stays free,
including what ships today (budget rollover and alerts, PDF and CSV
exports, events, split, themes). One paid tier only:

**Flow Sync — subscription.** Features with a monthly cost on our side or
recurring value for the user, so the recurring price is honest:

- Sync and multi-device, end-to-end encrypted, with a household mode where
  two people share one profile (server cost).
- AI insights: monthly written review, spike explanations, questions over
  your own data (API cost per user).
- Automatic bank import where open banking exists (EU, UK, Brazil first).
- Widgets, Apple Watch and Wear OS companions.
- Trip features beyond the basics: split costs with friends, shared events,
  trip summary export.
- Scheduled backups to Drive / iCloud.

No one-time "Pro" tier: after removing what is already free there is not
enough left to sell honestly. No caps on accounts, bills or categories.
The store description's "no subscriptions" line changes only when Sync
ships.

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
