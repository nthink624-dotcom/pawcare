# Supabase Auth Success Dry-Run Checklist

## Purpose

This checklist defines the safe procedure for the first successful owner login dry-run.

The dry-run is only meant to verify that Supabase Auth `signInWithPassword` can return a valid session for an owner account and that the app auth provider can hold that session in memory. It must not connect Settings summary, reservations, customers, today home, or any existing API data flow.

No direct Supabase database query, API call, write, mutation, notification, push, or Alimtalk behavior is part of this step.

## Allowed Output

Only boolean or count-style status may be printed:

- Login success: `true` or `false`
- Session exists: `true` or `false`
- `getSession()` is null: `true` or `false`
- `getAccessToken()` is null: `true` or `false`
- Email exists: `true` or `false`
- User ID exists: `true` or `false`
- Restore success: `true` or `false`
- Sign-out success: `true` or `false`
- Existing API call count
- Supabase REST DB call count
- Non-auth mutation call count

Do not print raw values for email or user ID. Only print existence booleans.

## Forbidden Output

Never print or persist:

- Password
- Access token
- Refresh token
- JWT
- Supabase anon or publishable key
- Supabase URL
- Full session object
- Raw user object
- Authorization header
- Request headers
- Raw auth response body
- `.env.local` contents

Any accidental output of the above requires stopping the dry-run and rotating credentials if needed.

## Dry-Run Verification Items

Before running:

1. Confirm `apps/owner-mobile/.env.local` exists.
2. Confirm `.env.local` is ignored by git.
3. Confirm auth env guard passes.
4. Confirm `EXPO_PUBLIC_OWNER_DATA_PROVIDER=mock`.
5. Confirm production Supabase is not allowed from development unless the explicit allow flag is already intentionally set.
6. Confirm no API provider or Settings summary real provider is enabled.

During successful login dry-run:

1. Call `realAuthSessionProvider.signIn()` with the real owner email/password provided only at runtime.
2. Do not log the email/password.
3. Do not log the returned session or token.
4. Verify login success as a boolean.
5. Verify `getSession()` is not null as a boolean.
6. Verify `getAccessToken()` is not null as a boolean.
7. Verify email exists as a boolean.
8. Verify user ID exists as a boolean.
9. Verify `/api/owner` and `/api/bootstrap` call count remains `0`.
10. Verify Supabase `/rest/v1` call count remains `0`.
11. Verify non-auth `POST`, `PATCH`, `PUT`, `DELETE` count remains `0`.

After successful login:

1. Run `restoreSession()` if the current client/storage setup supports it.
2. Verify restore success as a boolean only.
3. Run `signOut()`.
4. Verify `getSession()` is null after sign-out.
5. Verify `getAccessToken()` is null after sign-out.
6. Verify no token/password/session/JWT was printed.

## Stop Criteria

Stop immediately if:

- Password is printed.
- Access token, refresh token, or JWT is printed.
- Full session or raw user object is printed.
- Supabase URL or anon/publishable key is printed.
- Authorization header is printed.
- `/api/owner` or `/api/bootstrap` is called.
- Supabase `/rest/v1` is called.
- Any non-auth `POST`, `PATCH`, `PUT`, or `DELETE` occurs.
- Settings summary real provider is triggered.
- Reservation, customer, today home, write, notification, push, or Alimtalk code path is triggered.
- Production Supabase guard blocks the run.
- Env guard fails.

If a stop criterion is hit, do not retry by weakening guards or changing env values. Report the exact guard or counter that stopped the run without exposing secrets.

## Required Verification Commands

Run the normal local checks after the dry-run:

```bash
npm run check:provider
npm run check:owner-data-state
npm run check:viewmodels
npm run typecheck
git diff --check
```

## Expected Report Shape

The success dry-run report should include only:

- Login success boolean
- Session exists boolean
- Access token exists boolean
- Email exists boolean
- User ID exists boolean
- Restore success boolean, if attempted
- Sign-out success boolean
- Session null after sign-out boolean
- Access token null after sign-out boolean
- Existing API call count
- Supabase REST DB call count
- Non-auth mutation call count
- Confirmation that no secret values were printed

The report must not include account email, user ID, token, URL, key, password, raw session, or request/response bodies.
