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
