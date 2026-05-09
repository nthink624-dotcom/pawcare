# Auth Session Implementation Plan

## Purpose

This plan defines the safety rules and implementation order before wiring real Supabase Auth into the owner mobile app.

The app must use the existing Petmanager server/API and existing Supabase project. It must not create an app-only database or a separate app-only Supabase project.

This step is documentation only. It does not install `@supabase/supabase-js`, implement login, call an API, create an access token, connect Settings summary to real data, or add any write path.

## Required Environment Variables

Auth environment:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_ENV_NAME=development|preview|production
EXPO_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=false
```

API environment:

```env
EXPO_PUBLIC_OWNER_DATA_PROVIDER=mock|real
EXPO_PUBLIC_OWNER_API_BASE_URL=
EXPO_PUBLIC_OWNER_API_STAGE=development|preview|production
EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false
EXPO_PUBLIC_OWNER_DEV_SHOP_ID=
```

Optional compatibility name:

```env
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Recommended app interpretation:

- Prefer `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as the public auth key.
- Never use `SUPABASE_SERVICE_ROLE_KEY` in the app.
- Keep API stage and Supabase stage explicit so development builds do not accidentally point at production.
- Development builds may use local or preview API.
- Release builds should point at production API and production Supabase.
- This stage separation does not create a separate app database.

## Environment Safety Guardrails

Values that may be public in Expo:

- Supabase project URL
- Supabase anon/publishable key
- Owner API base URL
- Stage names
- Non-secret feature flags
- Development shop ID if it is not sensitive

Values that must never be public or bundled:

- Supabase service role key
- Database passwords
- API secrets
- Access tokens
- Refresh tokens
- Admin setup keys
- Billing, Alimtalk, or push provider secrets

Required guards:

- Block production Supabase in development unless `EXPO_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=true`.
- Block production API in development unless `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=true`.
- Reject `EXPO_PUBLIC_*TOKEN*` values that look like manually supplied access tokens.
- Do not log access tokens or refresh tokens.
- Do not write session contents to docs, scripts, fixtures, snapshots, or git-tracked files.

The first implementation checkpoint adds `src/services/authEnvConfig.ts` for this validation layer only. It reads Supabase auth env values, blocks secret-like public env keys, blocks production Supabase outside production unless explicitly allowed, and does not create a Supabase client.

The next checkpoint adds `src/services/supabaseAuthClient.ts` as a guarded client factory. It uses `authEnvConfig` before creating a client, keeps session persistence disabled until storage is implemented, and does not call any login or session APIs.

Session storage preparation adds `src/services/authSessionStorage.ts`. It provides a SecureStore-backed adapter shape and a memory adapter for tests, but it is not connected to Supabase Auth until the approved session implementation step.

## Session Storage Recommendation

The app needs to keep users logged in after restart without exposing session secrets.

Recommended Expo approach:

- Use `expo-secure-store` for refresh token and session-sensitive values.
- Keep access token in memory whenever possible.
- Restore or refresh session on app start through Supabase Auth.
- Clear secure storage on logout.

AsyncStorage guidance:

- Avoid storing refresh tokens in plain AsyncStorage if `expo-secure-store` is available.
- Use AsyncStorage only for non-sensitive preferences such as remembered login ID or selected shop ID.
- If Supabase client persistence requires an AsyncStorage-like adapter, implement a SecureStore-backed adapter first and document any fallback explicitly.

Session shape in app:

```ts
type AuthSession = {
  userId: string;
  ownerId: string;
  email: string | null;
  accessToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
};
```

The refresh token should not be exposed through `AuthSession` unless a later implementation proves it is necessary.

## Login Flow

Initial login target:

- Email/password login only.
- Social login remains out of scope until separately approved.

Planned flow:

1. User enters owner login ID and password in `LoginScreen`.
2. App normalizes the login ID.
3. App builds the same owner auth email used by the web: `<loginId>@owner.petmanager.local`.
4. App calls Supabase Auth password login.
5. If login fails, show a Korean mobile-friendly error.
6. If login succeeds, convert Supabase session into `AuthSession`.
7. Store only the minimum session material needed for restore.
8. Set app session state.
9. Enter existing main tabs.
10. Keep all real data loading disabled until the next approved step.

The mock login path must remain available while real auth is being introduced.

## Access Token Delivery Flow

The existing API expects:

```http
Authorization: Bearer <access_token>
```

Planned app flow:

1. `realAuthSessionProvider.getAccessToken()` resolves the current valid access token.
2. If the token is missing or expired, the provider attempts one safe refresh.
3. If refresh fails, it returns `null` or raises an auth-required error.
4. `createAuthSessionTokenResolver()` converts the auth session into:

```ts
{
  accessToken: string;
  ownerEmail: string | null;
}
```

5. Settings summary preview passes the access token into the read-only owner data provider.
6. `realOwnerDataProvider` calls only:
   - `GET /api/owner/shops`
   - `GET /api/bootstrap?shopId=...`
7. The response is normalized into `OwnerBootstrapDto`.
8. Only `getSettingsSummary()` is used in the first real read-only integration.

Do not pass access tokens through public env, query params, logs, docs, or mock fixtures.

## Session Restore Flow

App start behavior:

1. `useAppSession()` calls `authSessionProvider.restoreSession()`.
2. The real provider reads Supabase persisted session state from secure storage.
3. If a valid session exists, return `AuthSession`.
4. If the session is expired but refreshable, refresh it once.
5. If restore succeeds, show the main app tabs.
6. If restore fails, show `LoginScreen`.
7. Do not call owner API during restore unless a later step explicitly enables Settings summary read-only loading.

Restore failure should not crash the app. It should fall back to unauthenticated state.

## Logout Flow

Mock and real logout should stay separated internally but share the same UI action.

Mock logout:

- Clear mock session.
- Return to `LoginScreen`.

Real logout:

1. Call Supabase `signOut()`.
2. Clear local in-memory session.
3. Clear secure session storage.
4. Clear any selected-shop value only if product behavior requires it.
5. Return to `LoginScreen`.

Logout must not call write APIs, update customer data, update reservation data, or change settings.

## Failure And Exception Handling

Login failure:

- Show a Korean error message.
- Do not call owner API.
- Do not expose raw provider internals unless needed for development logging.

Missing Supabase env:

- In development, show a setup error.
- In normal mock mode, allow mock-only flow to continue.

Token expired:

- Attempt refresh once.
- If refresh fails, clear session and show login-required state.

Network error:

- Show retryable error where applicable.
- Avoid infinite retry loops.

Session missing:

- Return `null` from restore.
- Show `LoginScreen`.

401 or 403 from owner API:

- Treat as auth, ownership, or suspended-account failure.
- During the first read-only phase, show Settings-only `ErrorState`.
- Keep Today, Reservations, and Customers on mock data.

No owned shops:

- Show setup/account message.
- Do not call `/api/bootstrap`.

Response shape mismatch:

- Fail adapter normalization.
- Show Settings-only error.
- Keep other tabs mock.

## Implementation Order

Recommended order:

1. Add auth env config reader and safety checks.
2. Add Supabase auth client factory.
3. Add secure storage adapter decision and dependency plan.
4. Implement `realAuthSessionProvider` with restore-only mocked tests first.
5. Implement password sign-in.
6. Implement sign-out.
7. Keep `mockAuthSessionProvider` as the default path until real auth is explicitly enabled.
8. Add tests proving no owner API call occurs without a valid session.
9. Add tests proving access token is attached only to read-only owner API calls.
10. Connect Settings summary read-only path.
11. Verify Today, Reservations, and Customers remain mock.
12. Only after that, plan broader read-only surfaces.

## Verification Commands

Before and after implementation:

```bash
npm run check:provider
npm run check:owner-data-state
npm run check:viewmodels
npm run typecheck
git diff --check
```

Additional source checks:

- No `SUPABASE_SERVICE_ROLE_KEY` in app code.
- No service role key string in app env examples.
- No `.from()` calls in app code.
- No `insert`, `update`, `delete`, or `upsert`.
- No `POST`, `PATCH`, `PUT`, or `DELETE` added for owner data.
- No access token in docs, scripts, fixtures, logs, or committed env files.

## Not Implemented In This Step

This document does not implement:

- `@supabase/supabase-js`
- `expo-secure-store`
- Supabase Auth client
- Real login
- Session persistence
- Session restore
- Logout behavior
- Actual access token generation
- Settings summary real connection
- Any API call
- Any Supabase direct database query
- Any write/mutation feature
- Any change to `D:\petmanager`

## Next Step

The next implementation step should be a small env and dependency planning checkpoint:

1. Decide whether to install `@supabase/supabase-js` and `expo-secure-store`.
2. Add app auth env config with production safety checks.
3. Add tests for missing env and production-block behavior.
4. Keep mock login and mock data as the default during that checkpoint.
