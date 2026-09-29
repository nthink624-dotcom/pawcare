# PetManager Owner Mobile Shell

This app is a separate Capacitor shell that loads the canonical owner mobile route inside a native iOS/Android container.

The native shell start URL is `https://app.petmanager.co.kr/owner/mobile`. Set `OWNER_MOBILE_WEB_URL` in a local `.env` file to this direct route when you are ready to test. Do not use the public-site root `https://www.petmanager.co.kr`; it redirects to the app host and can leave the iOS WebView blank.

See [docs/run-build.md](./docs/run-build.md) for setup, sync, and build steps.
