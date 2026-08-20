# Core Reliability Invariants

These rules protect PetManager's highest-risk operational data. They are not optional UI preferences.

## 1. One appointment source

The calendar, reservation-management view, daily schedule board, PC web, and mobile web must project the same canonical `appointments` rows returned by the shared backend.

Required behavior:

- Fetch the visible date or month range when the screen opens or the range changes.
- Refresh visible data periodically while the page is visible.
- Refresh again when the browser window regains focus or the tab becomes visible.
- Merge the response into the latest client state, not a stale render closure.

Forbidden regression:

- Calendar-only or reservation-management-only appointment arrays in production.
- Demo/fallback rows mixed into authenticated Supabase appointment data.
- A screen that never refreshes after bootstrap.

## 2. Range merges reconcile durable IDs

A row can move across a requested date boundary. Removing only rows whose old date is inside the refreshed range is insufficient.

Failure example:

1. Appointment `A` exists locally on August 31.
2. The server moves `A` to September 1.
3. A September refresh appends the new `A` but preserves the old August `A` because its old date is outside September.
4. The same appointment appears twice.

Required behavior:

- Remove stale rows inside the refreshed range.
- Also remove any existing row whose durable `id` appears in the response.
- Append the authoritative response and sort deterministically.
- Apply the same rule to grooming records.

Regression coverage: `tests/server/calendar-owner-api.test.mjs`.

## 3. Same-staff overlap is a database invariant

Availability checks improve UX but cannot protect two requests that arrive at nearly the same time.

Required behavior:

- PostgreSQL serializes active appointment overlap checks per `shop_id` and `staff_id` inside the transaction.
- Active statuses are `confirmed`, `in_progress`, and `almost_done`.
- Owner creation, customer creation, rescheduling, reassignment, and reactivation all pass through the same database invariant.
- A conflict returns `선택한 담당자에게 같은 시간 예약이 있습니다.`.

Canonical migration: `supabase/migrations/20260803145206_serialize_staff_appointment_overlap_checks.sql`.

Never replace this with only a client check or a plain `select exists` trigger. Those approaches have a concurrent-write race.

## 4. Photo collections are append-preserving

`media_asset_id` is the durable identity. Signed URLs are temporary display values.

Required behavior:

- Adding photos merges new asset IDs after the existing canonical IDs.
- Deduplicate without reordering existing IDs.
- Partial signed-URL responses retain the prior URL for unresolved assets.
- Legacy persistent URLs remain until explicitly migrated or deleted.
- Multiple-file uploads preserve input order and use bounded concurrency.
- A failed save restores the previous complete collection.

Forbidden regression:

- `setImages(latestUploadOnly)` after an add operation.
- Rebuilding IDs from only successfully resolved signed URLs.
- Truncating an existing collection because one request returns fewer items.

Regression coverage: `tests/server/profile-image-collection.test.mjs`.

## 5. Photo loading avoids N+1 signed-URL requests

Photo lists must call the batch signed-URL endpoint once for unresolved asset IDs and reuse URLs before their safety TTL expires. A read failure may be retried once because the operation is idempotent.

Do not issue one `/api/owner/media/signed-url` request per photo.

## 6. Production errors remain recoverable

The root application error boundary must remain present. It must offer retry and a safe route back to the owner entry surface while recording a tagged console error for diagnosis.

Canonical boundary: `src/app/error.tsx`.

## 7. A completed grooming service has one connected outcome

The operational status, photos, record, customer result, and revenue row are projections of one completed appointment. They must not become separate local-only records.

Required behavior:

- `in_progress`, `almost_done`, and `completed` do not require a photo. `almost_done` is the pickup-ready notification state before grooming completion.
- Before/after photos are optional outcome attachments. Owners may add either photo at completion, but missing photos must never block pickup-ready or completion.
- Completion upserts one `grooming_records` row keyed by `appointment_id` and derives actual duration from the appointment's actual timestamps.
- Treatment notes, special notes, next recommended visit date, before/after media IDs, and final appointment price remain on that record.
- A database trigger synchronizes exactly one `shop_revenue_entries` row through `grooming_record_id`.
- Customer result links use an appointment-scoped `action: "result"` token; customer-shared photo URLs require that same token.
- The result page works without an app install, account, or login.

Forbidden regression:

- Empty photo validation functions or UI-only photo enforcement.
- Creating a second customer-facing grooming record, photo album, or revenue amount for the same appointment.
- Using the base service price when the appointment has a `final_service_price` snapshot.
- Returning `customer_shared` signed media URLs without a valid result token.

Canonical migration: `supabase/migrations/20260803162637_grooming_record_outcomes.sql`.

Regression coverage: `tests/server/reliability-guardrails.test.mjs`.

## 8. Profitability is derived from completed work, not a second ledger

Time profitability joins the existing completed grooming record, appointment timing snapshot, pet snapshot, assigned staff, and linked revenue row. It must not create a second editable revenue source.

Required behavior:

- Expected time comes from the completion snapshot, then the appointment window, then the detailed service duration.
- Actual time comes from `grooming_records.actual_duration_minutes`.
- Gross, discount, and net revenue remain attributable to the one `shop_revenue_entries` row linked by `grooming_record_id`.
- Breed, weight, service name, original price, and expected duration are snapshotted on completion so later profile or price-guide edits do not rewrite history.
- Price recommendations require at least three timed records for the same breed, rounded weight, and service segment.
- Missing actual time is reported as a data-quality gap, never replaced with an invented duration.

Forbidden regression:

- Calculating hourly revenue from scheduled time while labeling it actual.
- Using the current pet/service profile as the only historical value after a snapshot exists.
- Presenting a price increase from fewer than three comparable completed records.

Canonical API: `GET /api/owner/profitability`.

## 9. External data imports are previewed and idempotent

Required behavior:

- Preview parses the file without writing customer data.
- Guardians merge by normalized phone number; pets merge within that guardian by normalized pet name.
- The same source file cannot create the same imported visit twice.
- Imported visits become standard `grooming_records` rows with `record_source = 'external_import'`, so customer history, revenue, and profitability use one shared source.
- Imported price guides are saved as an inactive detailed-price-guide draft and never overwrite the active guide automatically.
- Raw workbook files and raw PII rows are not retained in import audit tables.
- Import audit tables have RLS enabled and no `anon` or `authenticated` table privileges.

Forbidden regression:

- One API write per browser-parsed row with no preview or retry identity.
- Creating a separate customer-history store only for migrated records.
- Activating an imported price guide or exposing it to customer booking before owner review.

Canonical migration: `supabase/migrations/20260803172356_profitability_and_external_data_imports.sql`.

Regression coverage: `tests/server/profitability-and-import.test.mjs` and `tests/server/reliability-guardrails.test.mjs`.

## Required verification

Run all of the following before deployment:

```powershell
npm run test:reliability
npm run typecheck
npm run lint
npm run build
```

`npm run build` invokes `test:reliability` automatically. A reliability test failure is a deployment blocker, not a test to skip.

Database migrations must also be applied and verified in the intended Supabase environment before claiming the database invariant is active there.
