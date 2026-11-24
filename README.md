# Budget Mobile

Budget Mobile is an Expo + React Native application for tracking income and expenses with an offline-first experience.  
The app supports secure login, transaction management, filters, local caching, and background sync with a remote API.

## Features

- **Authentication flow** with online login and cached offline fallback
- **Transaction management**: add, edit, delete, categorize, and annotate entries
- **Offline-first behavior** with local persistence via AsyncStorage
- **Sync queue** to reconcile unsynced actions when connectivity is restored
- **Search, filtering, and pagination** for fast browsing of transactions
- **Privacy mode** to hide sensitive balance values in the UI
- **Release notes tab** embedded in-app for product update visibility

## Tech Stack

- **Framework:** Expo (SDK 54), React Native 0.81, React 19
- **Routing:** Expo Router
- **Networking:** Axios
- **State & Storage:** React hooks + AsyncStorage
- **Connectivity detection:** @react-native-community/netinfo
- **Language:** JavaScript

## Project Structure

```text
app/            Route screens (login, dashboard, add/edit transaction)
components/     Reusable UI components (cards, filters, toast, modal)
constants/      App constants (API URL, theme colors, pagination)
contexts/       Global UI/application context providers
utils/          Sync and data utility logic
assets/         Static images and icons
```

## Prerequisites

- Node.js 18+ (recommended LTS)
- npm 9+
- Expo tooling (installed through project dependencies)
- Android Studio / Xcode / Expo Go (depending on target platform)

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment (optional)**

   The app reads API base URL from:

   ```bash
   EXPO_PUBLIC_API_URL
   ```

   If not set, it falls back to:

   ```text
   https://budget-tracker-hike.vercel.app
   ```

3. **Start the development server**

   ```bash
   npm run start
   ```

4. **Run on a platform**

   ```bash
   npm run android
   npm run ios
   npm run web
   ```

## Available Scripts

- `npm run start` — start Expo development server
- `npm run android` — launch Android target
- `npm run ios` — launch iOS target
- `npm run web` — launch web target
- `npm run lint` — run Expo ESLint checks

## Build & Release

EAS configuration is provided in `eas.json` with development, preview, and production profiles.  
OTA updates are enabled via Expo Updates in `app.json`.

## Notes

- Data is cached locally to support interrupted or offline usage.
- Unsynced create/edit/delete actions are queued and retried during sync.
- Current lint output includes existing hook dependency warnings in `app/dashboard.js`.

## Verify UPI alerts on Android

1. Install the Android preview APK from Releases. It installs as **Budget Mobile
   Preview** alongside the existing app. Sign in to load your synced ledger.
2. Sign in and open **UPI capture settings** below the balance. The setting starts
   off. Turn on **Auto-Parse GPay / UPI Alerts** and allow SMS access. For Google
   Pay notifications, also enable notification access in Android settings.
3. Tap **Scan Recent UPI SMS** to scan the past seven days, or use
   **Paste SMS / GPay Receipt**. Paste this fictional example to try the flow:

   "Google Pay: You sent ₹299 to Swiggy. UPI transaction ID: 628412345609"

4. Open **Needs Verification**. Edit the merchant or category and tap
   **Verify & Add**. The item leaves the queue and appears in the timeline
   and balance. **Ignore** removes a pending item. Scanning the same UPI
   reference again on this device skips it.
5. Expo Go supports paste and review. A native Android APK is required for
   SMS and notification capture. Alerts received while Budget Mobile is
   closed are held on the device and sync when the app is next open.

From a clone, run npm ci, npm test, and npx expo lint. To produce an
EAS-signed preview APK, run eas build -p android --profile preview with
access to the linked Expo project.

For a side-by-side APK built locally, set `BUDGET_ANDROID_PREVIEW=1`, run
`npx expo prebuild --platform android`, then run `gradlew.bat :app:assembleRelease`
from the generated Android directory on Windows.
