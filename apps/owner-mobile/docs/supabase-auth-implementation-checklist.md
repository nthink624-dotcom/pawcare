# Supabase Auth Implementation Checklist

## Purpose

This checklist defines the final safety scope before wiring real Supabase Auth into the owner mobile app.

The first real auth implementation is only meant to let an owner sign in from the app, restore the Supabase session, sign out, and expose the session access token to the existing read-only provider boundary. The app must keep using the existing Petmanager server/API and the existing Supabase project. No app-specific database or app-specific Supabase project should be created.

The first read-only data target after auth is still Settings summary only. Reservations, customers, today home, writes, push notifications, and Alimtalk remain out of scope.

## Required Environment Variables

App Supabase Auth:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUPABASE_ENV_NAME`
- `EXPO_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV`

Existing owner API:

- `EXPO_PUBLIC_OWNER_API_BASE_URL`
- `EXPO_PUBLIC_OWNER_API_STAGE`
- `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV`
- `EXPO_PUBLIC_OWNER_DEV_SHOP_ID`

Notes:

- Supabase URL and anon/publishable key are public client values, but they must still pass the existing env guards.
- `EXPO_PUBLIC_OWNER_DEV_SHOP_ID` is development-only convenience for selecting a shop after auth.
- Access tokens must come from the Supabase session at runtime, not from code, docs, logs, or env files.

## Hard Bans

- Do not use a Supabase `service_role` key in the app.
- Do not bundle secret keys, private keys, passwords, or server-only credentials.
- Do not store access tokens in source code, committed env files, docs, test output, screenshots, or logs.
- Do not add direct Supabase DB queries from the app.
- Do not add write/mutation behavior.
- Do not call reservation status update, customer edit/delete, settings save, notification, push, or Alimtalk flows.
- Do not use production Supabase or production API from development without an explicit allow flag.
- Do not switch the full app data provider to real mode as part of the first auth implementation.

## First Implementation Scope

Allowed:

- `realAuthSessionProvider.signIn()`
- `realAuthSessionProvider.restoreSession()`
- `realAuthSessionProvider.signOut()`
- `realAuthSessionProvider.getSession()`
- `realAuthSessionProvider.getAccessToken()`
- Runtime access token handoff through the existing token resolver shape

Not allowed yet:

- Settings summary real API connection
- Reservation list/detail real data connection
- Customer list/detail real data connection
- Today home real data connection
- Any write/mutation feature
- Push notifications or Alimtalk
- Direct Supabase table access

## Expected Auth Flow

Sign in:

1. Validate auth env with the existing auth env guard.
2. Create the Supabase Auth client with anon/publishable key only.
3. Submit email/password to Supabase Auth.
4. Convert the returned session into `AuthSession`.
5. Store only the active runtime session in provider state.
6. Avoid logging credentials, access token, refresh token, JWT, or raw session payload.

Restore session:

1. Validate auth env before creating the client.
2. Restore the Supabase session using the client-managed session storage.
3. Convert the restored session into `AuthSession`.
4. If there is no session, an expired session, or an invalid token, return `null`.
5. Keep the mock login fallback behavior intact until real auth is explicitly enabled.

Sign out:

1. Call the Supabase Auth sign-out path only after the approved implementation step.
2. Clear provider `currentSession`.
3. Clear local session storage through the auth client/storage adapter.
4. Return to unauthenticated app state.
5. Avoid logging tokens or raw session payloads if sign-out fails.

## Test Order

1. Env guard tests:
   - Missing Supabase URL fails clearly.
   - Missing anon/publishable key fails clearly.
   - service role or secret-looking key fails clearly.
   - Production Supabase in development fails unless explicitly allowed.
   - Public token-like env values are blocked.

2. Existing mock auth tests:
   - Mock login still works.
   - Mock logout still works.
   - AppNavigator mock-only behavior remains intact until explicitly changed.

3. Real auth failure tests:
   - Invalid credentials fail clearly.
   - Missing env fails before auth call.
   - Network failure returns a safe error state.
   - No token or invalid session maps to unauthenticated.

4. Real auth success tests:
   - Valid email/password returns `AuthSession`.
   - `getSession()` returns the restored/signed-in session.
   - `getAccessToken()` returns the runtime token.
   - Token is not printed to console, logs, screenshots, docs, or test output.

5. Restore tests:
   - App restart restores session when valid.
   - No session returns LoginScreen.
   - Expired or invalid session returns LoginScreen.

6. Sign-out tests:
   - Sign-out clears `currentSession`.
   - Sign-out clears local session storage.
   - `getSession()` and `getAccessToken()` return `null` after sign-out.

7. Token resolver boundary test:
   - The auth token resolver can supply an access token to a future real provider.
   - No real API call is made in this auth-only step.

## Rollback And Stop Criteria

Rollback or stop immediately if:

- Mock login flow breaks.
- App startup or navigation breaks.
- Access token, refresh token, password, JWT, or raw session payload appears in logs, docs, committed files, screenshots, or test output.
- Development accidentally connects to production Supabase/API without explicit allow flags.
- Any write/mutation code appears.
- Direct Supabase DB query code appears.
- Settings, reservations, customers, today home, push, or Alimtalk are connected earlier than approved.
- Typecheck or existing provider/view model checks fail and cannot be fixed within the auth boundary.

## Verification Commands

Run before and after the first real auth implementation:

```bash
npm run check:provider
npm run check:owner-data-state
npm run check:viewmodels
npm run typecheck
git diff --check
```

Also search for forbidden implementation drift:

```bash
signInWithPassword
supabase.auth
auth.getSession
auth.signOut
service_role
POST
PATCH
PUT
DELETE
.from(
.insert(
.update(
.upsert(
```

Any match must be reviewed in context. Auth method names are expected only after the approved implementation step; direct DB and write/mutation calls remain banned.

## Next Suggested Step

Implement real Supabase Auth in `realAuthSessionProvider` behind the existing env guards and dependency boundaries, while keeping the app data provider mock by default. The implementation should stop after auth sign-in, restore, sign-out, `getSession()`, and `getAccessToken()` are working. Settings summary real read-only connection should remain a separate later step.
