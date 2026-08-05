# PC/Legacy Backend Boundary

## Current authority

- The deployed product is the Next.js application in `D:\petmanager`; Vercel deploys it as a Next.js project.
- Its route handlers under `src/app/api` are the primary PC, mobile, and production API implementation.
- `backend/` is a retained Express server for legacy local development only. It is not the production authentication authority. If it is started, its owner-auth endpoints must follow the same contract as the Next.js API.
- Do not configure a PC or mobile client to use a different authentication contract from the primary Next.js API.

## Owner email authentication contract

Owner accounts sign up, sign in, recover an account, and reset a password with a real email address.

- Canonical identifier: `auth.users.email`.
- Compatibility field: `owner_profiles.login_id` remains only as a database column name and stores the same trimmed, lowercase email.
- Never generate or accept an owner username, `loginId`, `check-login-id`, or an internal address such as `@owner.petmanager.local` / `@owner.pawcare.local`.
- Owner-facing forms label the field `이메일`, use `type="email"` and `autocomplete="email"`.

Shared owner-auth API payloads:

```text
POST /api/auth/login       { email, password }
POST /api/auth/signup      { email, password, ...verified identity fields }
GET  /api/auth/check-email?email=
POST /api/auth/find-email
POST /api/auth/reset-password { email, ... }
```

`find-email` and `reset-password` are the only account-recovery purposes. The user proves their phone identity for recovery; this is not an email-inbox verification flow.

## Local development

- Primary local server: `npm run dev` (`http://localhost:3000`).
- The legacy Express server is optional: `npm run dev:backend` (`http://localhost:4000`). It must never be used to revive the old username or virtual-email flow.
- Local env files point to the Development Supabase project. Do not commit secrets or copy production credentials to local development.

## Change checklist

1. Change schema only through `supabase/migrations` when a schema change is actually needed.
2. Keep `auth.users.email` and `owner_profiles.login_id` equal after normalization.
3. Update `D:\petmanager-shared\docs\data-contracts.md` and coordinate the same API fields with `D:\petmanager-app`.
4. Run `npm run check:owner-auth-guards`, `npm run typecheck`, and `npm run typecheck:backend` for owner-auth changes.
