# Owner Mobile Shell Run & Build

## 1. Purpose

This project wraps the existing owner admin web page in a separate Capacitor shell. It does not modify the main web app.

## 2. Configure the target URL

1. Create `apps/owner-mobile/.env`.
2. Add the owner admin URL:

```env
OWNER_WEB_URL=https://your-owner-admin-url.example.com
```

If `OWNER_WEB_URL` is blank, the app shows the local shell-ready placeholder screen.

## 3. Install dependencies

```bash
cd apps/owner-mobile
npm install
```

## 4. Generate native projects

```bash
npm run sync
```

If Android and iOS platform folders have not been created yet, run:

```bash
npx cap add android
npx cap add ios
```

## 5. Open native projects

```bash
npm run open:android
npm run open:ios
```

## 6. Current shell scope

- loads the existing owner admin URL via Capacitor `server.url`
- keeps the main web app outside this app project untouched
- includes a placeholder asset staging folder for icon and splash work
- reserves a native-bridge structure for back button, external link, and telephone link handling

## 7. Next implementation step

After the final owner URL is confirmed, the next pass should:

- add Android WebView back handling
- add Android/iOS external link interception
- add `tel:` link handoff to the device dialer
- validate login session persistence inside the app container
