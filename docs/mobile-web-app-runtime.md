# Mobile Web/App Runtime

This repository owns the mobile owner experience.

## Local Runtime

- PC web: separate `D:\petmanager` repository
- Mobile web: `D:\petmanager-app`, `http://127.0.0.1:3100/owner/mobile`
- Mobile app shell: `D:\petmanager-app\apps\owner-mobile`
- Mobile app API/web base: `http://127.0.0.1:3100`

Use this repo for every mobile web/app change:

```powershell
cd D:\petmanager-app
npm run server:up
npm run mobile:android
```

Do not use the PC web project for mobile owner UI work.

## Production Runtime

Production should keep the same ownership split:

- PC web deploy: `D:\petmanager`
- Mobile web deploy: `D:\petmanager-app`
- Mobile app API/web URL: the same production URL as mobile web

Recommended domain shape:

- PC web: `https://www.example.com` or `https://pc.example.com`
- Mobile web/app: `https://mobile.example.com` or `https://app.example.com`

The installed Android/iOS app should point `EXPO_PUBLIC_OWNER_API_BASE_URL` to the mobile web/app production URL, not to the PC web URL.

## Rule

PC and mobile may share Supabase data and server APIs, but they must not share owner UI rendering code. Mobile web and the native app should share the mobile runtime in this repository.
