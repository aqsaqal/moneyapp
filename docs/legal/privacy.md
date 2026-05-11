---
title: Privacy Policy
---

# Privacy Policy

**Effective: 2026-05-09**

This Privacy Policy applies to the **Flow** and **Amanah** mobile applications (collectively, "the App"). The App is provided by the developer ("we", "us"). It is designed to track personal expenses on the user's device.

## 1. Summary

- **No account.** No sign-up, no login, no email required.
- **No collection.** We do not collect, store, transmit, or sell any data about you.
- **No analytics, no ads, no tracking.** No third-party SDKs report your activity.
- **Local-only data.** Every transaction, account, budget, and preference you create lives only on your device.
- **Permissions are used only when invoked.** The microphone is accessed only when you tap the voice-entry button. Biometrics are read only when you unlock the app.

## 2. Data we process

Information you enter into the App (transactions, accounts, budgets, recurring items, settings) is stored on your device using the operating system's local SQLite and key/value APIs. We do not have access to it.

When you tap the voice-entry button:

- **iOS** routes the audio through Apple's speech-recognition service. On iOS 17+ this runs on-device whenever the system supports it; on older iOS versions audio is sent to Apple per the standard iOS speech contract. We do not receive, store, or process the audio.
- **Android** routes the audio through the device's installed speech recognizer (typically Google Speech Services on Pixel/Samsung). The audio handling is governed by that recognizer's privacy policy, which the user has accepted at device setup. We do not receive, store, or process the audio.

We disclose this so you can make an informed choice; you can ignore the voice button and type instead.

## 3. Optional features that touch the network

The following features may make a network request **if you opt in**. Each is **off by default** and toggled in Settings. Disabling them eliminates all outbound network activity.

- **FX rates** (Flow + Amanah). When the App holds accounts in more than one currency, it fetches USD-anchored exchange rates once per day to convert balances into your display currency. It tries three providers in fallback order: `open.er-api.com`, `api.fxratesapi.com`, `api.frankfurter.app`. Only the request URL leaves the device; no user data, account names, or balances are included. The response is a list of currency rates, cached locally and overwritten on next refresh.
- **Nisab refresh** (Amanah only — gold price). When enabled, the App fetches the current gold price per gram from `https://www.goldapi.io`. Only the request URL leaves the device; no user data is included. The response is a single number, stored locally.
- **Prayer-time calendar** (Amanah). Times are computed on-device using the `adhan` library; no network call is made.

## 4. Permissions we request

| Permission | Why | When |
|---|---|---|
| Microphone | Voice-to-text dictation of transaction notes. | Only while you hold the voice button. |
| Speech Recognition (iOS) | Convert dictated speech to text. | Same as microphone. |
| Biometrics (Face ID / Touch ID / fingerprint) | Optional app unlock. | Only when you enable Biometric Unlock in Settings. |
| Notifications (optional) | Bill-due reminders if you enable them. | Only when you enable reminders. |

We do not request location, contacts, photos, calendar, or background data permissions.

## 5. Data retention and deletion

Because data lives on your device, deletion happens by:

- Tapping **"Delete"** on a transaction, account, budget, or recurring item;
- Tapping **"Erase all data"** in Settings → Data; or
- Uninstalling the App, which removes the app sandbox and all stored data.

The App does not back data up to iCloud or any cloud service. iOS/Android device-level backups are governed by the operating system; if you have iCloud Backup or Google Drive Backup enabled and have not excluded the App, the operating system may include the App's local files in those backups. The Android build has device backup explicitly disabled.

## 6. Children's privacy

The App is not directed at children under 13 (United States) or 16 (European Union). No data is collected from any user, including children.

## 7. Changes

If this Policy changes, the new version will be posted at this URL. Material changes will be highlighted in the App's About screen.

## 8. Contact

If you have questions about this Policy, email **ak.saken@gmail.com**.
