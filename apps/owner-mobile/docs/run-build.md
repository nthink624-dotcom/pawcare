# Legacy Owner Mobile Shell Run & Build

## 1. Purpose

This directory contains a legacy Capacitor shell. The canonical app, including iOS, is `apps/mobile`.

## 2. Configure the target URL

1. Create `apps/owner-mobile/.env`.
2. Add the owner admin URL:

```env
OWNER_MOBILE_WEB_URL=https://app.petmanager.co.kr/owner/mobile
```

The production native shell URL is always `https://app.petmanager.co.kr/owner/mobile`. If `OWNER_MOBILE_WEB_URL` is blank, the app shows the local shell-ready placeholder screen.

## 3. Install dependencies

```bash
cd apps/owner-mobile
npm install
```

## 4. Generate the legacy Android project

```bash
npm run sync
```

If the Android platform folder has not been created yet, run:

```bash
npx cap add android
```

## 5. Open native projects

```bash
npm run open:android
```

## 6. Current shell scope

- loads the existing owner admin URL via Capacitor `server.url`
- keeps the main web app outside this app project untouched
- includes a placeholder asset staging folder for icon and splash work
- reserves a native-bridge structure for back button, external link, and telephone link handling

For iOS development, use the canonical project under `apps/mobile/ios` and run `npm run ios:sync` from the repository root.

## 7. Next implementation step

For this legacy shell, after the final owner URL is confirmed, the next pass should:

- add Android WebView back handling
- add Android external link interception
- add `tel:` link handoff to the device dialer
- validate login session persistence inside the Android app container
