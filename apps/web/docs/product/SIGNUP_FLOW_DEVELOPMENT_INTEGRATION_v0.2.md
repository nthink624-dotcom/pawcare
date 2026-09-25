# SIGNUP_FLOW_DEVELOPMENT_INTEGRATION v0.2

## Development access

- Actual route: `http://127.0.0.1:3000/signup` after restarting the local Development server with this source.
- Verification-only server used for this packet: `http://127.0.0.1:3011/signup`.
- Desktop capture: `D:\petmanager\tmp\signup-flow-development-desktop.png`
- Mobile capture: `D:\petmanager\tmp\signup-flow-development-mobile.png`

## Connected flow

1. Service and detailed pricing is collected once. Photo parsing is optional and manual entry always remains available.
2. Required terms, account/KCP identity information, and shop information reuse the existing signup controls.
3. A final review screen submits account, shop, and canonical service prices in one request.
4. Post-signup initial setup asks only for business hours/closures and staff/schedules.

## Persistence and network boundary

- Direct-entry service rows remain only in React browser memory until final confirmation.
- A selected photo is sent only to `POST /api/auth/signup/price-guide-preview`; the route validates size, MIME and magic bytes, creates a request-memory data URL, calls Vision with `store: false`, and does not write to Supabase Storage or a database.
- When `OPENAI_API_KEY` is absent, the route returns `503 VISION_UNAVAILABLE`. The UI displays `판독 불가` and opens direct entry; it never displays a fixture as success.
- Final confirmation sends one JSON request to `POST /api/auth/signup`. The server validates service name, price, duration, species, breed group, and weight band again.

## Atomic draft and failure contract

- Draft migration: `supabase/migrations/202608270001_atomic_owner_signup_draft.sql`.
- `complete_owner_signup_v1` writes shop, owner profile, primary membership, canonical services, and initial owner staff in one Postgres transaction.
- Supabase Auth user creation happens before that RPC. RPC failure triggers immediate Auth-user deletion. A failed deletion records `compensation_pending`; a successful compensation records `failed_compensated`.
- `signupRequestId` plus a server-HMAC payload hash provides idempotency. Same request/same hash reuses the completed result; same request/different hash returns `409 PAYLOAD_MISMATCH`.
- Existing duplicate email and CI/DI checks remain before Auth creation; database unique constraints remain the concurrent-write backstop.

## Verification

- `npm run typecheck`: pass.
- Targeted ESLint for all changed TS/TSX files: pass.
- Failure-injection tests: 4/4 pass (completed retry reuse, payload mismatch 409, RPC-failure compensation, compensation-pending record).
- `npm run build`: pass, including 86/86 reliability tests and the media-architecture gate.
- Browser: actual `/signup` first stage rendered at desktop and 390px mobile widths.
- Accessibility: axe WCAG 2 A/AA, 0 violations on the mobile pricing/manual-entry state.
- Missing Vision key: verified `POST /api/auth/signup/price-guide-preview` returns 503 and the page displays the explicit unavailable state.

## Not applied

- The atomic migration was not applied to Development or Production.
- No Production deployment, Production DB write, Storage upload, or real Auth user creation was performed.
- Until the migration passes the Security P0 gate and is applied to Development, final signup intentionally returns `503 ATOMIC_SIGNUP_MIGRATION_REQUIRED` before creating an Auth user.

## Remaining P0

- Security review and Development-only application of the draft migration, including rollback rehearsal and direct database duplicate/concurrency tests.
- Add durable distributed abuse/rate limiting to the public pre-signup Vision endpoint before enabling a paid Vision key.

## Owner decision

- None required for the flow. Enabling the paid Vision key remains an operational release gate, not a UX decision.
