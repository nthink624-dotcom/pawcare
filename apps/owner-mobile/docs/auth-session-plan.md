# Owner Mobile Auth Session Plan

## Purpose

The owner mobile app must use the existing Petmanager server/API and the existing Supabase project. It must not create an app-only database or a separate app-only Supabase project.

This plan replaces the earlier manual access token trial path with a safer session-based direction:

1. The owner logs in from the app.
2. The app receives a Supabase session and access token.
3. The app sends that access token to the existing API with `Authorization: Bearer <access_token>`.
4. The existing API verifies ownership and shop access.
5. The first real read-only screen remains Settings summary.

This document is planning only. It does not implement login, session storage, API calls, writes, or Supabase direct database access.

## Existing Web References

Read-only files checked from `D:\petmanager`:

- `src/components/auth/login-form.tsx`
- `src/lib/auth/owner-credentials.ts`
- `src/lib/supabase/client.ts`
- `src/lib/api.ts`
- `src/app/owner/page.tsx`
- `src/app/api/owner/shops/route.ts`
- `src/app/api/bootstrap/route.ts`
- `src/server/owner-api-auth.ts`
- `src/app/auth/callback/route.ts`
- `src/lib/env.ts`
- `src/lib/server-env.ts`

Important web behavior:

- Owner login ID is converted to an auth email with `buildOwnerAuthEmail(loginId)`.
- Password login uses `supabase.auth.signInWithPassword({ email, password })`.
- The owner page recovers the session with `getSession()`, `refreshSession()`, and `getUser()`.
- API calls use `Authorization: Bearer <access_token>`.
- `/api/owner/shops` verifies the token with `auth.getUser(token)` and returns shops owned by `owner_user_id`.
- `/api/bootstrap?shopId=...` calls `requireOwnerShop()` before returning owner bootstrap data.
- The server uses service-role Supabase access internally, but the app must not use service role or direct database writes.

## Recommended App Auth Flow

The app should add an owner auth service that mirrors the web login behavior with React Native-safe storage.

Planned flow:

1. User enters owner login ID and password on `LoginScreen`.
2. App normalizes the login ID using the same rule as the web.
3. App builds the Supabase auth email as `<loginId>@owner.petmanager.local`.
4. App calls Supabase password login.
5. App stores the Supabase session using mobile-safe storage.
6. App exposes an `OwnerSession` with:
   - `accessToken`
   - `refreshToken`
   - `userId`
   - `email`
   - `expiresAt`
7. App calls the existing API with `Authorization: Bearer <accessToken>`.
8. The first read-only API target is Settings summary only.

The app should keep the existing mock provider as the default until auth and Settings summary read-only loading are intentionally enabled.

## Supabase Client Scope

The app may use the Supabase auth client only for authentication/session management.

Allowed:

- `supabase.auth.signInWithPassword`
- `supabase.auth.getSession`
- `supabase.auth.refreshSession`
- `supabase.auth.getUser`
- `supabase.auth.signOut`
- Auth state listener if needed

Not allowed in this phase:

- Supabase table queries from the app
- `.from()`
- `insert`, `update`, `delete`, `upsert`
- Supabase service role key
- App-only Supabase project
- App-only database schema

## Expected App Dependencies

Implementation will likely need these app-side dependencies in a later step:

- `@supabase/supabase-js`
- A React Native-compatible session storage option, preferably `expo-secure-store` for sensitive session values

If Supabase requires AsyncStorage-compatible persistence for the chosen setup, decide explicitly between:

- `expo-secure-store` wrapper for session-sensitive data
- `@react-native-async-storage/async-storage` only if the risk is accepted and documented

No dependency is added in this planning step.

## Required App Environment Variables

The app should separate API target and Supabase auth target by environment, while still using the existing server and existing Supabase project.

Auth:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_SUPABASE_ENV_NAME=development|preview|production
EXPO_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=false
```

API:

```env
EXPO_PUBLIC_OWNER_DATA_PROVIDER=mock|real
EXPO_PUBLIC_OWNER_API_BASE_URL=
EXPO_PUBLIC_OWNER_API_STAGE=development|preview|production
EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false
EXPO_PUBLIC_OWNER_DEV_SHOP_ID=
```

Meaning:

- Development app can point to local or preview API.
- Released app points to production API.
- This does not mean a new database is created.
- All real data still comes from the existing Petmanager server and existing Supabase structure.

## API Read Flow After Login

For Settings summary read-only:

1. Resolve session through the app auth service.
2. If no valid access token exists, show login-required state.
3. Call `GET /api/owner/shops` with `Authorization: Bearer <accessToken>`.
4. Choose `EXPO_PUBLIC_OWNER_DEV_SHOP_ID` if set and owned.
5. Otherwise choose the first owned shop.
6. Call `GET /api/bootstrap?shopId=...` with the same bearer token.
7. Normalize the response to `OwnerBootstrapDto`.
8. Build `SettingsSummaryViewModel`.
9. Render only Settings summary from real data.

Other tabs must remain mock during the first auth/session integration:

- Today
- Reservations
- Reservation detail
- Customers
- Customer detail

## Provider Boundary Direction

The manual access token resolver should be treated as a paused development artifact. The next auth implementation should prefer a session-based token resolver:

```ts
type OwnerSessionTokenResolver = () => Promise<{
  accessToken: string;
  ownerEmail: string | null;
} | null>;
```

The Settings summary preview loader can receive this resolver and pass the session access token into `selectOwnerDataProvider()` or its successor. The token must come from Supabase session state, not from code, public env, docs, or manual entry.

Longer term, the provider selector can be renamed or narrowed so the app clearly distinguishes:

- mock provider
- session-backed read-only provider
- future write-capable actions, which remain separate and disabled for now

## Login Screen Plan

The current mock login flow should not be replaced all at once.

Recommended implementation order:

1. Add app auth types and auth state model.
2. Add Supabase auth client factory with environment safety checks.
3. Add session restore hook.
4. Keep mock login as default unless auth mode is explicitly enabled.
5. Add password login handler matching web login ID behavior.
6. On login success, store session and enter the existing main tabs.
7. On logout, call `supabase.auth.signOut()` and clear local session state.
8. Do not add social login in the first pass unless separately approved.

The app should reuse Korean-first error messages, but adapt them for mobile. Login errors should never expose raw tokens or sensitive response details.

## Settings Summary First Target

Settings summary remains the first read-only target because it has the lowest operational risk:

- It mainly validates `shop`, `services`, notification settings, and customer page settings.
- It avoids reservation status transitions.
- It avoids customer edit/delete paths.
- It lets the app verify auth, shop ownership, and bootstrap adapter shape before broader data surfaces.

Only `getSettingsSummary()` should be called from real data in the first implementation.

## Safety Guardrails

Required guardrails:

- Default app provider remains mock.
- Real data requires explicit app configuration.
- Production API is blocked in development unless explicitly allowed.
- Production Supabase is blocked in development unless explicitly allowed.
- Access token comes only from Supabase session.
- Access token is never stored in tracked files.
- Access token is never logged.
- API calls use `GET` only for the first read-only phase.
- Direct Supabase database calls from the app are not allowed.
- Writes remain out of scope.

Blocked work:

- Reservation status change
- Customer create/edit/delete
- Settings save
- Push notification
- Alimtalk
- Supabase direct client table queries
- New app database or app Supabase project

## Failure Handling

No Supabase env:

- Show a login setup error in development.
- Keep mock provider available for normal mock-only app checks.

Login failure:

- Show Korean auth error.
- Do not call owner API.

Session missing or expired:

- Attempt refresh once.
- If still missing, show login-required state.

401 or 403 from API:

- Treat as login, ownership, or suspended-account issue.
- Show Settings-only error during first read-only phase.
- Do not switch other tabs to real data.

No owned shops:

- Show an owner account/shop setup message.
- Do not call `/api/bootstrap`.

Response shape mismatch:

- Fail in adapter.
- Show Settings-only error.
- Keep mock data in other tabs.

Network failure:

- Show `ErrorState` with retry.
- Do not retry automatically in a loop.

## Verification Plan

Before implementation:

```bash
npm run check:provider
npm run check:owner-data-state
npm run check:viewmodels
npm run typecheck
git diff --check
```

During implementation, add tests or scripts for:

- missing Supabase env
- login ID to owner auth email conversion
- session restore success
- session refresh success
- missing session blocks API call
- bearer token is attached to `/api/owner/shops`
- bearer token is attached to `/api/bootstrap`
- Settings summary can use session-backed provider
- Today/Reservations/Customers remain mock
- no write/mutation methods exist

## Not Implemented In This Step

This plan does not implement:

- Supabase app dependency installation
- Real login
- Session persistence
- API calls
- Settings summary real connection
- Social login
- Logout behavior
- Writes or mutations
- Push notifications
- Any change to `D:\petmanager`

## Next Step

The next implementation step should be a small auth/session scaffold inside `apps/owner-mobile`:

1. Add app auth/session types.
2. Add Supabase auth client factory with environment safety checks.
3. Add a session token resolver interface.
4. Add mock-only tests proving no API call occurs without a real session.
5. Keep Settings summary real read-only connection disabled until the session resolver is verified.
