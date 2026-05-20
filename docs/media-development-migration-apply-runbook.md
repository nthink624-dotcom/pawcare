# Media Development Migration Apply Runbook

This runbook exists so PetManager media migrations are applied in the right order.

Do not apply production first.

Korean step-by-step guide:

- `docs/media-development-apply-guide-ko.md`

## Current Development Target

Local `.env.local` should point to the development Supabase project:

- project ref: `qefxdtmdtvnzgupmjlom`
- stage: `development`
- site URL: `http://127.0.0.1:3000`

Production is:

- project ref: `ysxykikqnneuhypybjry`
- site URL: `https://www.petmanager.co.kr`

## Order

1. Confirm local/development target.
2. Apply migrations to development Supabase.
3. Run read-only schema verification on development Supabase.
4. Run local app checks.
5. Only then consider production.

## 1. Confirm Target

Run:

```bash
npm run check:supabase-env
npm run media:migration-plan
npm run media:schema-rest-check
```

Expected:

- `.env.local` stage is `development`
- Supabase ref is `qefxdtmdtvnzgupmjlom`
- production ref `ysxykikqnneuhypybjry` is not the local target
- before migration, `media:schema-rest-check` may report missing media tables
- after migration, `media:schema-rest-check` should pass

## 2. Apply To Development Supabase

Apply these files to the development Supabase project in this exact order:

1. `supabase/migrations/202605180002_owner_scale_indexes.sql`
2. `supabase/migrations/202605180003_media_assets_and_notification_attachments.sql`
3. `supabase/migrations/202605180004_media_cost_controls.sql`
4. `supabase/migrations/202605180005_shop_media_limits.sql`

If using Supabase SQL Editor:

- open the development project, not production
- confirm the URL/ref is `qefxdtmdtvnzgupmjlom`
- either paste and run each migration file one at a time, or generate a single bundle with `npm run media:build-migration-bundle`
- the generated bundle is `supabase/generated/media_development_apply.sql`
- stop immediately if any file fails

If using Supabase CLI later:

- link/authenticate to development first
- do not use production DB password or production access token for this step

## 3. Verify Development Schema

Run this read-only SQL in the same development project:

```text
supabase/verification/media_schema_readiness.sql
```

Expected:

- every row has `exists = true`
- `storage.petmanager-media` exists
- all media tables exist
- all expected columns exist
- all expected indexes exist
- `public.increment_shop_media_usage` exists

Then run:

```bash
npm run media:schema-rest-check
```

Expected:

- every media table is reachable through the development REST API
- `storage.petmanager-media` is reachable

## 4. Local App Checks

Run:

```bash
npm run check:media-architecture
npm run typecheck
npm run build
```

Expected:

- all pass
- `/api/bootstrap` does not query media tables
- media routes appear in the build output

## 5. Smoke Test

After development schema verification passes, follow:

```text
docs/media-api-smoke-test.md
```

Use only test media in development.

## Production Gate

Production migration is allowed only after:

- development migration applied
- `media_schema_readiness.sql` returns all true on development
- local build passes
- smoke test plan is understood
- owner explicitly approves the production target

Before production write, state:

- target project: `ysxykikqnneuhypybjry`
- target migrations
- affected shop: schema-only, all shops
- date/time
- rollback expectation
