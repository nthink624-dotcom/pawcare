# Native Bridge Structure

This folder documents the navigation policy that the native shells should enforce without changing the existing web app:

- internal owner-admin URLs stay inside the WebView
- `tel:` links open the system dialer
- other external links open outside the app
- Android back should prefer WebView history before exiting the app

Once the native platform folders are generated, the Android and iOS platform code should mirror the logic in `link-policy.ts`.
