# Settings Summary Real API Dry-Run Checklist

## Purpose

This checklist is the final preflight before trying a dev-only read-only API dry-run for the Settings summary.

This step does not run the API, does not store an access token, and does not connect login/session. The default app flow must continue to use the mock provider. The real provider path is only allowed for a developer who explicitly opts in and only for the Settings summary preview.

## Required Environment Variables

Use these values only for a local development dry-run. Do not commit local env files that include project-specific values.

```env
EXPO_PUBLIC_OWNER_DATA_PROVIDER=real
EXPO_PUBLIC_OWNER_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_OWNER_API_STAGE=development
EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false
EXPO_PUBLIC_OWNER_DEV_SHOP_ID=
```

Environment rules:

- `EXPO_PUBLIC_OWNER_DATA_PROVIDER=real` is required to enter the real provider candidate path.
- `EXPO_PUBLIC_OWNER_API_BASE_URL` must point to a development API, such as local Next API or a separate local backend.
- `EXPO_PUBLIC_OWNER_API_STAGE` must be `development` or `preview` for this dry-run.
- `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV=false` must remain the default.
- `EXPO_PUBLIC_OWNER_DEV_SHOP_ID` is optional. If omitted, `/api/owner/shops` chooses the first owned shop.
- Production API URLs must not be used in development unless a separate approval explicitly changes the dry-run scope.

## Manual Access Token Injection

The access token must not be placed in code, docs, public env vars, or tracked files.

Allowed approach for the later dry-run:

- Pass the token through a dev-only runtime resolver that matches `ManualAccessTokenResolver`.
- Keep the token in memory only during the local run.
- Do not write the token to `src`, `scripts`, `docs`, `package.json`, `.env`, logs, screenshots, or test fixtures.
- Do not use `EXPO_PUBLIC_*TOKEN*` or `EXPO_PUBLIC_*ACCESS_TOKEN*` for the token.
- Confirm `assertNoPublicAccessTokenEnv()` runs before any real provider fetch path.

Blocked approaches:

- Hardcoding a token in TypeScript, JavaScript, Markdown, or shell scripts.
- Committing `.env` or `.env.local` with token values.
- Logging the token or including it in thrown error messages.
- Reusing a production token for a development dry-run.

## Call Scope

Only the Settings summary preview may use the real provider path.

Allowed:

- `selectOwnerDataProvider()` only inside the Settings summary preview loader path.
- `provider.getSettingsSummary()` after the bootstrap payload is loaded and normalized.
- `SettingsScreen` rendering the resulting `SettingsSummaryViewModel`.

Blocked:

- `provider.getAppointmentRows()`
- `provider.getTodayHome()`
- `provider.getAppointmentDetail()`
- `provider.getCustomerSummaries()`
- `provider.getCustomerDetail()`
- Any Today, Reservations, or Customers screen real provider wiring.
- Any whole-app provider switch to real mode.

The Today, Reservations, and Customers tabs must keep using the mock `ownerDataProvider`.

## HTTP Method And Endpoint Scope

Allowed endpoints:

- `GET /api/owner/shops`
- `GET /api/bootstrap?shopId=...`

Allowed method:

- `GET` only

Blocked methods and operations:

- `POST`
- `PATCH`
- `PUT`
- `DELETE`
- Supabase direct client calls
- `.from()`, `insert`, `update`, `delete`, `upsert`
- Any reservation status change, customer edit/delete, settings save, Alimtalk, or push notification path

Before dry-run, run source checks for mutation patterns and confirm `realOwnerDataProvider` still uses only `method: "GET"`.

## Failure Handling Plan

Expected failures must stay inside the Settings summary preview path and must not crash the whole app.

Token missing:

- Stop before fetch.
- Show `ErrorState` in the Settings route.
- Keep Today, Reservations, and Customers on mock data.

API base URL missing:

- Stop before fetch.
- Show `ErrorState` in the Settings route.
- Do not silently fall back to mock in explicit real mode.

Shop ID missing:

- Call `GET /api/owner/shops`.
- Use `EXPO_PUBLIC_OWNER_DEV_SHOP_ID` if provided.
- Otherwise choose the first owned shop.
- If no shops are returned, show `ErrorState`.

401 or 403:

- Treat as authentication or ownership failure.
- Show `ErrorState`.
- Do not retry automatically with another token.
- Do not expose the token in logs.

Response shape mismatch:

- Fail during adapter or DTO normalization.
- Show `ErrorState`.
- Record only the missing field category, not the full sensitive payload.

Network failure:

- Show `ErrorState`.
- Allow retry through the existing retry path.
- Keep other tabs on mock provider data.

Production API blocked:

- Fail before fetch when `EXPO_PUBLIC_OWNER_API_STAGE` or base URL indicates production while `EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV` is not explicitly allowed.

## Pre-Dry-Run Verification Commands

Run these before any actual API dry-run:

```bash
npm run check:provider
npm run check:owner-data-state
npm run check:viewmodels
npm run typecheck
git diff --check
```

Also confirm source safety with searches for:

- `POST`, `PATCH`, `PUT`, `DELETE`
- `.insert(`, `.update(`, `.delete(`, `.upsert(`
- `createClient(`, `createBrowserClient(`, `SupabaseClient`
- `EXPO_PUBLIC_*TOKEN*=`, `EXPO_PUBLIC_*ACCESS_TOKEN*=`
- raw JWT-like strings

## Dry-Run Entry Criteria

Proceed only if all are true:

- The current path is `D:\petmanager-app`.
- The current branch is `owner-mobile-shell`.
- The working tree has no unrelated changes.
- Only `apps/owner-mobile` files are involved.
- The API base URL points to a development API.
- The access token is supplied through dev-only runtime injection.
- No token appears in git diff, logs, docs, or screenshots.
- Settings summary is the only real provider target.
- Today, Reservations, and Customers remain mock.
- GET-only checks pass.
- All verification commands pass.

## Rollback And Recovery

If the dry-run fails or behaves unexpectedly:

- Remove or unset `EXPO_PUBLIC_OWNER_DATA_PROVIDER=real`.
- Clear the dev-only access token from memory.
- Restart the Expo web process.
- Confirm the Settings tab returns to mock summary.
- Confirm Today, Reservations, and Customers still show mock data.
- Do not change backend, Supabase schema, Vercel settings, or existing web code as part of rollback.

## Not Implemented In This Step

This checklist does not implement or run:

- Real API calls
- Real access token usage
- Login/session wiring
- Whole-app real provider switching
- Reservation, Today, or Customer real data
- Writes or mutations
- Supabase direct client
- Settings save
- Alimtalk or push notifications

## Next Step

After this checklist is reviewed and committed, the next implementation step can be a separately approved dev-only dry-run script or UI path that injects a temporary in-memory token and calls only `getSettingsSummary()` through the existing Settings summary preview loader.
