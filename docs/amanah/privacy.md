---
title: Amanah — Privacy Policy
---

# Amanah — Privacy Policy

**Effective: 2026-05-30**

This Privacy Policy applies to the **Amanah** mobile application ("the App"). The App is provided by the developer ("we", "us"). It is designed to help Muslim users track personal expenses and zakat on the user's device, with full respect for the principle of `amanah` (trust): your data stays with you.

## 1. Summary

- **No account.** No sign-up, no login, no email required.
- **No data collection.** We do not collect, store, transmit, or sell any data about you. We never receive your transactions, account balances, notes, sadaqa amounts, zakat calculations, or any other information you enter.
- **No analytics, no ads, no tracking.** No third-party analytics or advertising SDKs are bundled with the App.
- **Local-only data.** Every transaction, account, budget, zakat snapshot, and preference you create lives only on your device.
- **Permissions are used only when invoked.** Camera and photo access are used only when you tap the receipt-scan button. Biometrics are read only when you unlock the App.

## 2. Data we process

Information you enter into the App (transactions, accounts, budgets, recurring items, mazhab and prayer-time preferences, manual zakat-eligible asset entries, settings) is stored on your device using the operating system's local SQLite database and key/value storage. We do not have access to it.

Sadaqa amounts are never shared on social-share images. Ibadah categories (zakat, sadaqa, qurban) are excluded from streak counters and from the headline category in any shareable end-of-month recap card.

The App does not include Sentry, Firebase Analytics, Crashlytics, Google Analytics, Meta SDK, AppsFlyer, Adjust, Mixpanel, Amplitude, or any other third-party SDK that collects user data.

## 3. Optional features that touch the network

The following features may make a network request **if you opt in**. Each is **off by default** and toggled in Settings. Disabling them eliminates all outbound network activity.

- **FX rates.** When the App holds accounts in more than one currency, it fetches USD-anchored exchange rates once per day to convert balances into your display currency. It tries three providers in fallback order: `open.er-api.com`, `api.fxratesapi.com`, `api.frankfurter.app`. Only the request URL leaves the device; no user data, account names, or balances are included. The response is a list of currency rates, cached locally and overwritten on next refresh.
- **Nisab refresh.** When enabled, the App fetches the current spot price of gold and silver per gram from `api.gold-api.com`. Only the request URL leaves the device; no user data is included. The response is a single number per metal, stored locally and used to compute whether your wealth meets nisab.
- **Prayer-time calendar.** Times are computed on-device using the `adhan` library; no network call is made.

## 4. Crash reporting

The App contains **no third-party crash reporting SDK**. We do not operate a crash dashboard.

Apple and Google's platforms offer system-level crash reporting (App Store Connect Crashes and Google Play Console Android vitals). These dashboards are operated by Apple and Google respectively and only receive data if **you** have enabled "Share with App Developers" in iOS Settings → Privacy & Security → Analytics & Improvements, or its Android equivalent. Reports delivered to those dashboards are governed by Apple's and Google's privacy policies, not ours; the App developer can view aggregated crash stack traces but never user identifiers, transaction data, sadaqa amounts, or notes.

## 5. Permissions we request

| Permission | Why | When |
|---|---|---|
| Camera | Scan a paper receipt to auto-fill an expense. | Only while you hold the receipt-scan button on the Add Transaction screen. |
| Photos | Import a receipt photo from your library. | Only when you tap "Import from photos" on the Add Transaction screen. |
| Biometrics (Face ID / Touch ID / fingerprint) | Optional app unlock. | Only when you enable Biometric Unlock in Settings. |
| Notifications | Bill-due reminders. | Only when you enable Reminders in Settings. |

We do not request location, contacts, microphone, calendar, or background data permissions.

## 6. Data retention and deletion

Because data lives on your device, deletion happens by:

- Tapping **"Delete"** on a transaction, account, budget, or recurring item;
- Tapping **"Erase all data"** in Settings → Data; or
- Uninstalling the App, which removes the app sandbox and all stored data.

The App does not back data up to iCloud or any cloud service. iOS / Android device-level backups are governed by the operating system; if you have iCloud Backup or Google Drive Backup enabled and have not excluded the App, the operating system may include the App's local files in those backups. The Android build has device backup explicitly disabled (`allowBackup=false`).

## 7. Children's privacy

The App is not directed at children under 13 (United States) or 16 (European Union). No data is collected from any user, including children.

## 8. Changes

If this Policy changes, the new version will be posted at this URL. Material changes will be highlighted in the App's About screen.

## 9. Contact

If you have questions about this Policy, email **ak.saken@gmail.com**.
