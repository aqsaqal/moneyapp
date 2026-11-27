# Flow roadmap

Living document. Dates are when a decision was made, not promises.
Last updated 2026-11-27.

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

Done on `dev` (2026-11-27): keyboard dismissal audit. Every field was
checked on iOS: tapping blank space closes the keyboard on screens, and in
sheets the first backdrop tap closes the keyboard, the second the sheet.
No Done bar; the native one looked out of place. Verified on the S26.

Done on `dev` (2026-11-28): color themes. Settings → Theme: Mint (the
original, default), Graphite, Ink, Espresso, each with a dark and a light
palette. Device-wide, restart on change like light/dark. Existing
installs see no change. The picker is the base for Pro themes later.

1. Flow Pro, one-time unlock: products in both consoles, RevenueCat,
   paywall screen, Restore. Everything shipped free today stays free.

## 1.4 — early 2027

- Expo SDK upgrade + Xcode 27. The one item with a deadline: from
  April 2027 App Store Connect accepts only uploads built with the iOS 27
  SDK (Xcode 27). Today: Xcode 26.4.1, Expo SDK 54 / RN 0.81.5. Plan:
  install Xcode 27 when it is stable, move to the Expo SDK that supports
  it, re-check the patched libraries (draggable-flatlist, reanimated,
  gesture-handler, MMKV), run through both platforms. Target: the first
  release of 2027, so there is slack before April. Also clears the
  deprecated edge-to-edge warning on Play.
- Don't break in landscape on large screens. Android 16 ignores the
  portrait lock on screens 600dp and wider (tablets, unfolded foldables),
  so the phone layout rotates and stretches there. Not a tablet layout:
  cap content width around 600dp and center it, check modals and sheets
  in landscape, check the Plan segment row, Home tiles and the category
  grid, which do their own width math. Test by lifting the portrait lock
  and rotating the S26. Rides along with the SDK upgrade's full
  run-through of every screen.

## Later

- Sync and household sharing, end-to-end encrypted. The subscription anchor;
  Pro included.
- Widgets, Apple Watch, Wear OS.
- AI monthly review and spike explanations (API cost, so subscription).
- Trip cost splitting with friends; shared events.
- Reports: yearly PDF, tax CSV packs, scheduled backups to Drive / iCloud.

## Growth levers (no ad spend)

Baseline 2026-11: ~15 installs/month with no marketing. Finance apps
convert 2–5% of installs to a paid tier, so installs come before any
paywall. In order of expected effect per hour of work:

1. **Store screenshots with captions.** A script composes the existing
   captures into device frames with one headline each, for every store
   size, so captions are a text-file change:
   1. "Know what's safe to spend today" (Home)
   2. "Add a coffee in three taps" (Smart Add)
   3. "See what a trip really cost" (Events)
   4. "Bills, budgets, goals, one plan" (Plan)
   5. "Your money stays on your phone" (Accounts)
2. **Localized store listings** (title, subtitle, description, captions) in
   the ten largest locales. Fifty in-app locales is an asset almost no
   competitor matches; listings are where it shows up in search.
3. **Rating prompt**, native, once, after a success moment (first month
   Home says "On track"). Ratings move search position most at this size.
4. **Onboarding → first minute.** "Try with sample data" at the end of
   onboarding (one tap into the Demo profile); a three-step guided card on
   the empty Home (add income, add a bill, log a purchase) that ticks off
   and disappears.
5. **Listing copy**: keywords in title/subtitle, Events and Split in the
   description, first two screenshots carry the message.
6. **Community posts** where people compare finance apps (personal-finance
   and privacy communities): "no accounts, no tracking, works offline" is
   what gets asked for there.

### What to measure (store consoles, free)

Installs show the listing works; whether people like the app shows in
what they do afterwards. Readable from ~100 installs/month, no need to
wait for 1,000:

- **Day-30 retention**: 20% good, 10% average, under 5% means the first
  minute isn't landing.
- **First-week uninstalls**: above 50% means the listing promised something
  the app didn't deliver.
- **Active devices ÷ installs**: Flow is meant to be opened most days; this
  is the health number.
- **Written reviews**: five of them say more than any install count.

Milestones: 100 installs/month → read retention and fix the first minute;
1,000 installs/month → the growth levers worked, start the paywall work.

## Monetisation model

Free to download, everything shipped today stays free. Two paid tiers
later, chosen by what each feature costs us to run:

**Flow Pro — one-time unlock.** New finished work with no running cost.
Not anything already shipped: budget rollover and alerts, PDF and CSV
exports, events and split stay free.

- Custom color themes and icon packs (today: dark / light only).
- Envelope budgeting.
- Trip summary export.
- Future polish features of the same kind.

Existing free features that could move to Pro later, ranked by how well
they'd survive the move (core features — multi-currency, backup, categories,
bills, budgets, net worth — never):

1. PDF reports.
2. Events and trips.
3. Split.
4. Budget rollover and envelope-style rules (plain budgets stay free).
5. A third profile (the second stays free).
6. Receipt scanning.

Rule for any such move: grandfather. A flag set on first launch of the
paywall version keeps everything free for installs that predate it; only
new installs see the gate.

**Flow Sync — subscription.** Only features with a monthly cost on our side
or recurring value for the user go here, so the recurring price is honest:

- Sync and multi-device, end-to-end encrypted, with a household mode where
  two people share one profile (server cost).
- AI insights: monthly written review, spike explanations, questions over
  your own data (API cost per user).
- Automatic bank import where open banking exists (EU, UK, Brazil first).
- Widgets, Apple Watch and Wear OS companions.
- Trip features beyond the basics: split costs with friends, shared events,
  trip summary export.
- Scheduled backups to Drive / iCloud.

Pro is included in Sync. No caps on accounts, bills or categories in either
tier (see below). The store description's "no subscriptions" line changes
only when Sync ships.

## Release process

Steps are in `docs/release-playbook.md`. Per version: finish and test on
the S26 and the iOS simulator; bump version / build number / version
code; prepare the listing; build the AAB and the iOS archive; Play
internal track → closed track → production; App Store version → submit;
store-side products last; after approval check the live build and
update this file. Submit, publish and legal clicks are the user's.

Store listings and screenshots in twelve languages, English the source:
English, Spanish, Portuguese, French, German, Turkish, Indonesian,
Russian, Kazakh, Japanese, Korean, Chinese (Simplified). App Store has no
Kazakh storefront, so Kazakh is Play and in-app only; Spanish is entered
twice there (Spain, Mexico). Machine translations need a fluent read.

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
