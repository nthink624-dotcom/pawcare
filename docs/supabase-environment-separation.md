# Supabase Environment Rule

## Decision

PetManager uses two database environments only:

1. Local Supabase DB
   - Used for development, test accounts, seed data, screenshots, and destructive experiments.
   - Local UI work must point here by default.
   - It is safe to reset and reseed.

2. Production Supabase DB
   - Used by the real deployed service.
   - Contains real owner, customer, booking, billing, and notification data.
   - Never use production service-role credentials from the local development app by default.

Do not operate a separate Supabase Dev project in the normal workflow. If a Supabase Dev project already exists, treat it as unused unless the owner explicitly reintroduces it.

## Source Of Truth

Database schema changes must live in `supabase/migrations`.

Do not apply schema changes by manually pasting SQL into multiple Supabase dashboards. If emergency SQL is run in production, create a matching migration file immediately afterwards so the repository remains the source of truth.

## Normal Workflow

1. Create or edit a migration under `supabase/migrations`.
2. Apply it to the local Supabase DB.
3. Test app behavior locally.
4. Apply the same migration once to the production Supabase DB.

This keeps the workflow to two environments: local first, production second.

## Environment Files

### `.env.local`

Local development must use local Supabase values:

```env
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_ENV_NAME=development
SUPABASE_ENV_NAME=development
NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=false
ALLOW_PROD_SUPABASE_IN_DEV=false

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
SUPABASE_SERVICE_ROLE_KEY=<local service role key>
```

### Production hosting environment

Production deployment must use production Supabase values:

```env
NEXT_PUBLIC_SITE_URL=https://www.petmanager.co.kr
NEXT_PUBLIC_SUPABASE_ENV_NAME=production
SUPABASE_ENV_NAME=production
NEXT_PUBLIC_ALLOW_PROD_SUPABASE_IN_DEV=false
ALLOW_PROD_SUPABASE_IN_DEV=false

NEXT_PUBLIC_SUPABASE_URL=<production Supabase URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
SUPABASE_SERVICE_ROLE_KEY=<production service role key>
```

## Safety Rules

- Local development must not point to production Supabase unless the owner explicitly asks for a one-off inspection or fix.
- Do not insert test bookings, test users, or seed data into production Supabase.
- Before any write to a remote Supabase project, state which project, shop, date, and table will be changed.
- Use `demo-shop` only for code-level mock/demo screens. It is not a production database tenant.
- `/demo/*` routes read mock data and may not reflect production Supabase data.

## Important Files

- `docs/supabase-environment-separation.md`: this operating rule.
- `supabase/migrations/*`: schema source of truth.
- `supabase/seed/*`: local seed data only.
- `.env.local`: local development connection.
- `.env.local.example`: template for local development.
- `.env.example`: generic template.
- `src/lib/env.ts`: browser/runtime environment resolution.
- `src/lib/server-env.ts`: server environment resolution and safety flags.
- `src/lib/supabase/client.ts`: browser Supabase client.
- `src/lib/supabase/server.ts`: admin and auth Supabase clients.
- `src/server/bootstrap.ts`: decides whether data comes from mock data or Supabase.
- `src/lib/mock-data.ts`: `demo-shop` mock dataset.
