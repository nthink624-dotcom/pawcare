# Media Production Rollout Checklist

This checklist is for enabling PetManager photo/media infrastructure without mixing demo data, bloating `/api/bootstrap`, or creating unexpected storage cost.

## Scope

This rollout covers:

- owner/customer photo metadata
- Supabase Storage bucket `petmanager-media`
- client-compressed uploads
- generated variants: thumbnail, preview, optimized, provider-ready
- notification media attachments
- media send history
- recent sent images
- monthly media usage tracking
- temporary retention cleanup

This rollout does not yet include:

- owner-facing upload UI
- customer-facing image gallery UI
- real Ssodaa image-message mapping in the relay server
- paid plan enforcement UI

## Required Migration Order

Apply to local/development first, then production after verification.

Development apply runbook:

- `docs/media-development-migration-apply-runbook.md`

Generated apply bundles:

- Development: `supabase/generated/media_development_apply.sql`
- Production: `supabase/generated/media_production_apply.sql`

1. `supabase/migrations/202605180002_owner_scale_indexes.sql`
   - performance indexes for owner scale work
   - required before onboarding many shops
2. `supabase/migrations/202605180003_media_assets_and_notification_attachments.sql`
   - Storage bucket
   - `media_assets`
   - `media_variants`
   - `notification_media_attachments`
   - `media_send_attempts`
3. `supabase/migrations/202605180004_media_cost_controls.sql`
   - `media_assets.source_byte_size`
   - `media_assets.expires_at`
   - `shop_media_usage_months`
   - monthly usage increment function
4. `supabase/migrations/202605180005_shop_media_limits.sql`
   - per-shop media limits
   - retention days
   - enforcement mode

Do not apply these manually in production without recording the same SQL in `supabase/migrations`.

## Environment Targets

Development project:

- Supabase ref: `qefxdtmdtvnzgupmjlom`
- used by local development unless the owner explicitly approves otherwise

Production project:

- Supabase ref: `ysxykikqnneuhypybjry`
- used by `https://www.petmanager.co.kr`

Before any remote Supabase write, state:

- target project ref
- target table or migration
- target shop, if applicable
- date/time
- whether it is schema-only or data-changing

## Vercel Environment Variables

Required for existing production app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Recommended for media cleanup:

- `MEDIA_CLEANUP_CRON_SECRET`

If `MEDIA_CLEANUP_CRON_SECRET` is not set, cleanup currently falls back to `NOTIFICATION_CRON_SECRET`.

## Preflight Checks

Run locally before deploy:

```bash
npm run check:supabase-env
npm run check:media-architecture
npm run typecheck
npm run build
```

Expected result:

- Supabase env check passes for the intended local/development project.
- Media architecture check passes.
- TypeScript passes.
- Next build passes.

## Post-Migration Read-Only Verification

After applying the media migrations to any Supabase project, run this SQL in that project's SQL Editor:

```text
supabase/verification/media_schema_readiness.sql
```

Expected result:

- every `exists` value is `true`
- `storage.petmanager-media` exists and is not public
- all media tables exist
- all expected columns exist
- all expected indexes exist
- `public.increment_shop_media_usage` exists

If any row returns `false`, do not deploy UI entry points for media upload yet.

## Development Verification Status

Last verified: 2026-05-19

Development target:

- Supabase project: `petmanager-dev`
- Supabase ref: `qefxdtmdtvnzgupmjlom`

Completed:

- Media schema migration applied.
- `supabase/verification/media_schema_readiness.sql` returned all `true`.
- REST schema check passed.
- API smoke test passed for upload intent, Storage upload, complete, provider-ready variant, signed URL, media list, notification attachment, delivery payload, delivery result, recent sent media, and cleanup dry-run.

Development smoke artifacts:

- Shop: `shop-4d57f170`
- Media asset: `466e03b6-fafb-4150-83ba-0e889ce6ab91`
- Notification: `11b78a03-2fec-42aa-85e1-0dfbdc282606`

Development follow-up completed:

- `shops.booking_slot_interval_minutes`
- `shops.booking_slot_offset_minutes`

Production remains untouched.

## Production Verification Status

Last verified: 2026-05-19

Production target:

- Supabase project: `petmanager`
- Supabase ref: `ysxykikqnneuhypybjry`

Completed:

- `supabase/generated/media_production_apply.sql` applied by owner in Supabase SQL Editor.
- `supabase/verification/media_schema_readiness.sql` returned all `true`.

Notes:

- The production rollout is schema-only.
- Existing owner, customer, appointment, payment, and auth data were not intentionally modified by this rollout.
- Owner-facing upload UI is still not enabled.

## Production Apply Instructions

Before applying production SQL, confirm:

- Target project is `petmanager` with Supabase ref `ysxykikqnneuhypybjry`.
- Vercel Production Supabase URL points to `ysxykikqnneuhypybjry`.
- Production backup/export policy is acceptable for this schema-only rollout.
- No owner-facing media upload UI is enabled yet.

Apply this file in the production Supabase SQL Editor only after approval:

```text
supabase/generated/media_production_apply.sql
```

Suggested SQL Editor title:

```text
prod_20260518_media_apply
```

Immediately after success, run:

```text
supabase/verification/media_schema_readiness.sql
```

Suggested verification title:

```text
prod_20260518_media_schema_readiness
```

## Bootstrap Safety

`/api/bootstrap` must not load media lists.

Forbidden in bootstrap:

- `media_assets`
- `media_variants`
- `notification_media_attachments`
- `media_send_attempts`

Media should be loaded only through dedicated media APIs.

## Dedicated Media APIs

Read:

- `GET /api/owner/media/assets`
- `GET /api/owner/media/signed-url`
- `GET /api/owner/media/recent-sent`
- `GET /api/owner/media/usage`
- `GET /api/owner/media/variants/policy`
- `GET /api/owner/media/notification-delivery-payload`

Write:

- `POST /api/owner/media/upload-intents`
- `POST /api/owner/media/complete`
- `POST /api/owner/media/variants/upload-intents`
- `POST /api/owner/media/variants/complete`
- `POST /api/owner/media/notification-attachments`
- `POST /api/owner/media/notification-delivery-results`

Cleanup:

- `GET /api/media/cleanup-expired`
- `POST /api/media/cleanup-expired`

## Storage And Cost Defaults

Launch default:

- one customer-send image target: about 250 KB
- before/after set target: about 500 KB
- temporary send image retention: 30 days
- monthly soft limit: 150 MB per shop
- hard blocking: disabled by default
- enforcement mode: `warn`
- original phone camera files: not stored by default

## Production Empty-State Expectations

When no media exists:

- `/api/owner/media/assets` returns an empty `items` array.
- `/api/owner/media/recent-sent` returns an empty array.
- `/api/owner/media/usage` returns zero usage with configured limits.
- `/api/bootstrap` remains unaffected.

## Rollback Strategy

If UI is not yet connected, rollback is simple:

- leave schema in place
- stop calling media endpoints
- keep cleanup endpoint dry-run

If uploaded media exists:

- do not drop media tables
- do not delete the Storage bucket manually
- disable UI entry points first
- export or review `media_assets` before cleanup

## Open Items Before Real Image Sending

Before enabling actual customer image sends:

- confirm Ssodaa image-message API contract
- update the relay server to map `mediaAttachments`
- decide whether Ssodaa needs provider-side media upload or accepts signed image URLs
- test one image send in development
- record provider media id and provider media URL through `notification-delivery-results`
