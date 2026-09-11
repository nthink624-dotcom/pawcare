# Owner mobile landing embed contract

- Route: `/demo/owner-mobile`
- Data: server-built Development fixture from `buildOwnerDemoBootstrap()` only. The route does not read an authenticated session, customer API, or remote operational rows.
- UI: the route renders the production `OwnerApp` component with `isPreviewDemo`; the embed wrapper blocks user mutation controls while retaining the exact production layout.
- Parent signal: listen for `{ source: "petmanager-owner-mobile-embed", version: 1, status: "ready" | "error", message?: string }`. The parent must verify `event.origin` against the configured mobile app origin.
- Loading/error DOM: `[data-petmanager-embed="owner-mobile"][data-petmanager-embed-state="loading|ready|error"]`.
- URL: configure the PC project with the mobile deployment origin plus `/demo/owner-mobile`; never derive a deployed URL from localhost.
- Framing: production defaults allow `https://petmanager.co.kr` and `https://www.petmanager.co.kr`. Add environment-specific origins through the space-separated `PETMANAGER_EMBED_FRAME_ANCESTORS` build variable. Local port 3000 origins are allowed only in development.
- CSP: the route emits `Content-Security-Policy: frame-ancestors ...`. If the parent origin changes, update the environment variable and rebuild the mobile app before embedding.
