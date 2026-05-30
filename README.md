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
