# PetManager PC/Mobile Data Contracts

_Last updated: 2026-09-08_

## Source Of Truth

- `D:\petmanager` is the source of truth for PC/admin web, shared backend/API, Supabase schema, migrations, and shared data contracts.
- `D:\petmanager-app` follows these API and data contracts for owner/staff mobile web and hybrid app surfaces.
- Mobile-specific UI can differ, but API payloads, database field names, status semantics, and notification rules must stay compatible with PC/backend.

## Shared API Surface

Mobile and PC should use the same backend contracts for these routes unless a change is explicitly coordinated:

- `/api/owner/media/*`
- `/api/customer-page-settings`
- `/api/staff-members`
- `/api/notifications/visit-reminders`
- `/api/owner/call-integrations`
- `/api/owner/call-events`
- `/api/webhooks/calls/{integrationId}`
- `/api/appointments`
- `/api/bootstrap`
- `/api/customer-benefits/quote`
- `/api/customer-bookings`
- `/api/owner/profitability`
- `/api/owner/data-import`
- `/api/owner/price-guide-photo-import`

## Marketing First-Touch Acquisition Contract

- `POST /api/marketing/acquisition` accepts only `landing_view` or `landing_cta_click`, the fixed signup CTA identifier, and the allowlisted fields `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`. Unknown query fields are ignored; recognized malformed or duplicate values are rejected.
- `acquisition_id` is a server-generated random UUID stored in an HttpOnly, SameSite=Lax first-party cookie. It must not encode or derive from an owner, email, phone, shop, device, IP address, referrer, or landing URL.
- First-touch source values are immutable. A later visit may add an idempotent event but cannot update the original direct/UTM classification or UTM values.
- UTM values are normalized to lowercase ASCII slugs and bounded to 64 characters for source/medium and 128 characters for campaign/content/term. Email-like, phone-like, URL/markup-like, oversized, or otherwise free-form values fail closed and are not stored.
- PASS verification may add `identity_verified` only after the existing verified-result boundary. Atomic owner signup binds the acquisition to the exact completed `signup_request_id`, Auth user, and shop; a replay with the same tuple is idempotent and any stale or cross-shop tuple is rejected before mutation.
- Post-signup milestones use only `record_bound_marketing_acquisition_milestone_v1` with the exact bound owner/shop and a hashed authoritative event key. The contract supports setup completion, test booking, day-7 activation, and paid conversion, but a product route must not emit one until its canonical event and rule are defined.
- `marketing_acquisitions`, `marketing_acquisition_bindings`, and `marketing_acquisition_events` are backend-only. RLS is enabled, direct `public`/`anon`/`authenticated` access is revoked, and service-role RPCs use unique event keys to prevent duplicate events.
- Until migration `20260908090000_marketing_acquisition_first_touch.sql` is separately applied, signup and PASS continue normally and attribution reports `schema_missing`; clients must not invent a local success record.

## Owner Email Authentication Contract

### Secure signup price-guide import contract

- `/api/auth/signup/price-guide-token` issues a short-lived, one-time analysis token bound to the anonymous signup session, IP hash, and session-scoped device identifier. The analysis endpoint rejects requests without this token.
- `/api/auth/signup/price-guide-preview` accepts one JPEG, PNG, or WebP image only after MIME/magic and real-decoder validation. It rejects oversized dimensions, excess pixels, animation, truncated containers, and trailing polyglot data.
- The preview route applies an 8.5MB multipart hard limit before `formData()` or a complete request buffer is created. The image itself remains limited to 8MB; the separate 512KB allowance is multipart envelope overhead. Missing, false, or chunked `Content-Length` requests are still bounded by the stream reader and a 15-second body deadline.
- The server auto-rotates and re-encodes the image to bounded JPEG without EXIF/GPS before any provider call. Input and sanitized buffers are zeroed on every success/failure path after use.
- Distributed request claims are stored in `signup_price_guide_analysis_requests` using only HMAC subject hashes, SHA-256 file hash, cost counters, safe failure codes, and encrypted short-TTL structured-result cache. Original images, AI raw responses, unconfirmed drafts, raw IP/device identifiers, and provider error bodies are forbidden.
- The public analysis contract supports `429` with `Retry-After`, concurrent request limits, daily cost limits, duplicate-file cache reuse, and a provider circuit breaker.
- `DELETE /api/auth/signup/price-guide-preview?reason=` is the authenticated cleanup contract for `confirmed`, `cancelled`, `retake`, `manual`, and `abandoned` transitions. The client must complete this purge before confirming or leaving the service-price step; a purge failure is fail-closed and retryable rather than being reported as success.
- `signup_price_guide_analysis_requests` uses `tombstoned` as the sanitized cleanup state. Purge immediately nulls IP/session/device/file hashes, cache links, and encrypted cache content. Expired cache, stale processing rows, failure/timeout, cancellation, retake, confirmation, and abandonment all enter this cleanup path. Tombstones retain only non-identifying failure/cost evidence briefly and are deleted after `cleanup_after`.
- `cleanup_signup_price_guide_analysis_v2` and `cleanup_signup_price_guide_security_meter_v1` run inside each distributed v2 claim and can be retried by the service role. The encrypted analysis cache TTL is 5 minutes, stale processing TTL is 2 minutes, and a sanitized tombstone is deleted after 1 hour; meter retention follows the separate meter TTL rules below.
- The reviewed rollback contract is `supabase/rollback/20260827031414_secure_signup_ai_price_guide_metering.rollback.sql`. It blocks while analysis is processing, revokes and drops the v2 analysis RPCs, purges all analysis artifacts, removes the separate meter state, and deliberately does not restore the purge-bypassable v1 gate.
- Preview rows are editable browser state only. Only rows explicitly confirmed by the owner are included in the final signup payload and written to the canonical detailed price-guide source inside the signup transaction.
- `claim_owner_signup_v5` serializes each `signupRequestId`, and `mark_owner_signup_auth_created_v5` records the one Auth user created for that request. `complete_owner_signup_v5` verifies the Auth email and absence of unexplained partial signup data, then delegates the verified KCP identity, phone-trial claim, shop/profile/membership/canonical services/default owner staff, subscription, and idempotent result to the existing v4 provisioning transaction; signup does not initialize Alimtalk credits.
- Supabase Auth creation remains an external boundary. Any database/KCP/Credit failure requires Auth compensation; a failed compensation is recorded as `compensation_pending` and must never be presented as successful signup.
- Development fixture mode requires `SIGNUP_PRICE_GUIDE_FIXTURE_MODE=true`, is unavailable in Production, and must be visibly labelled. A real Vision E2E is not complete until `OPENAI_API_KEY` is connected in Development.

Owner authentication uses a real email address and password. Social login is not supported. Owner signup consent is stored in `owner_profiles.agreements`.

- Completed owner signups store `agreed_at`, `terms_version`, and the selected agreement values.
- `auth.users.email` is the canonical login identifier. The legacy `owner_profiles.login_id` column remains for schema compatibility and must contain the same normalized (trimmed, lowercase) email address.
- Do not generate, store, or expose internal owner email aliases such as `@owner.petmanager.local` or `@owner.pawcare.local`.
- PC and mobile use these shared payloads: `POST /api/auth/login` `{ email, password }`; `POST /api/auth/signup` `{ email, password, ...verified identity fields }`, which returns an immediate session after successful KCP verification; `GET /api/auth/check-email?email=`; `POST /api/auth/find-email` `{ identityVerificationToken }`; `POST /api/auth/reset-password` with `email`; and `PATCH /api/owner/account/email` `{ shopId, email, currentPassword }`.
- Email lookup must use only the completed KCP/PortOne identity-verification token. The server derives name, birth date, phone number, CI, and DI from that verified result; clients must not send or compare self-entered identity details.
- Identity verification purposes use `find-email` and `reset-password`. The request/verify identity routes accept `email` when the reset flow needs the development profile lookup.
- Owner-facing screens must label the field `이메일`, use `type="email"` and `autocomplete="email"`, save a remembered email only by explicit user choice, and link to `/login/find-email`. They must not retain old ID input labels or `/login/find-id` paths.
- Phone identity verification remains the account identity proof for signup, email lookup, and password reset. It does not prove ownership of an email inbox.
- KCP identity verification is the required account proof. Signup does not send or require an email confirmation link, and the owner is signed in immediately after signup completes.
- Every PortOne identity attempt is created by the server. `POST /api/auth/request-verification-code` returns the server-generated `verificationRequestId`, a PortOne-compatible `providerIdentityVerificationId`, and a one-time `verificationState`; the database stores only the SHA-256 state hash and its five-minute expiry.
- `POST /api/auth/verify-pass` must reject the request before calling PortOne unless the request id, purpose, provider id, state hash, allowed status, expiry, and unconsumed state all match the same `owner_identity_verifications` row. A completed-result retry may rotate a verification token only for that same exact unexpired binding.
- PortOne SDK waits and identity API fetches are bounded. Timeout, cancellation, mismatched callback, and stale/replayed binding errors use Korean recovery guidance and never trigger a new provider verification automatically.
- Owner signup accepts only the current server `OWNER_SIGNUP_TERMS_VERSION`; a client-supplied historical or arbitrary legal version is rejected and cannot be persisted.
- Owners may correct the login email in PC settings. The server must verify the currently logged-in owner, shop ownership, and current password, then update `auth.users.email`, `auth.users.user_metadata.login_id`, and `owner_profiles.login_id` to the same normalized email in one protected operation. Email changes do not use a confirmation-mail flow.

## Owner Signup Service Pricing Contract

- `POST /api/auth/signup` accepts `signupRequestId` (UUID) and either canonical `priceGuideDocument` or legacy `servicePrices` together with the verified owner/account/shop payload.
- Each legacy service price row contains `id`, `name`, `price`, `durationMinutes`, `species` (`dog | cat | all`), `breedGroup`, and `weightBand`.
- The canonical v2 signup payload is `priceGuideDocument: PriceGuideV2`. `servicePrices` is legacy compatibility input only. When `priceGuideDocument` is present, the server ignores any client-provided `servicePrices`, validates the v2 document, and regenerates the compatibility rows itself.
- `PriceGuideV2` is strict and contains `schemaVersion: 2`, `source`, `overallNote`, `rows`, `surcharges`, and `aiReview`; it may additionally carry the backward-compatible `tableGroups` photo-layout metadata described below. Declared nested keys are strict, nullable values use `null`, and undeclared fields are rejected.
- `source` is one of `ai_imported` (initial AI photo extraction output; when reviews exist, it remains this way while any review is unresolved and none is corrected), `owner_corrected` (an AI-derived document after any review is marked `수정했어요`; once reached, this state is retained), `vision` (AI photo extraction), `fixture` (local test fixture), `manual` (owner-entered), `owner_confirmed` (owner-confirmed canonical document; an AI-derived document reaches this only when every item in a non-empty AI review set is marked `맞아요` and no correction exists), or `legacy` (adapter output from an older service row).
- Each `rows[]` item contains `serviceName`, `species` (`dog | cat | all | unknown`), `breedNames`, `breedGroup`, `sizeClass` (`small | medium | large | extra-large | all | unknown`), `minKg`, `maxKg`, optional `weightBandLabel`, `priceKind` (`fixed | starting | range | unknown`), `priceMinKrw`, `priceMaxKrw`, `durationMinutes`, and `note`. `weightBandLabel` preserves the exact visible source row label when a photo uses a band such as `2kg 이하`; nullable fields remain `null`, and unknown values must not be guessed.
- Optional `tableGroups[]` preserves the photographed table axes without turning empty cells into services. Each group contains the exact `sourceLabel`, explicit `species`, `breedNames`, `sizeClass`, ordered `weightBands` (`label`, `minKg`, `maxKg`, `note`), ordered `serviceNames`, and `note`. Existing stored v2 documents may omit `tableGroups`; new photo-analysis responses include it so group headings, breed examples, weight-only note rows, and dynamic service columns survive review.
- A photo-analysis `rows[]` entry represents one actually visible, non-empty price cell. Empty intersections and UI text such as `확인 필요` are never serialized as synthetic rows, group names, weight bands, or service names.
- When a single numeric price is visible but the card does not state whether it is fixed, starting, or a range, preview may retain that number in `priceMinKrw` with `priceKind: unknown`; `priceMaxKrw` remains absent. Explicit owner selection of a storable price kind and all other strict required fields is still required before save or publication.
- Each `surcharges[]` item contains `condition`, `amountKrw`, `percent`, and `note`. Each `aiReview[]` item contains `targetId`, `field`, `rawText`, `confidence` (`medium | low`), `userConfirmed`, and `userCorrected`; final signup rejects any review for which both confirmation flags are false.
- Preview documents may keep `durationMinutes: null`, but final signup requires every row to have an actual integer duration from 5 to 1,440 minutes. Clients and servers must not invent `60` minutes or any other default.
- The compatibility `services.price` is only a representative value: `fixed`, `starting`, and `range` all use the actual `priceMinKrw`; `unknown` or a missing minimum is not storable. Full starting/range meaning and `priceMaxKrw` remain in the canonical v2 JSON rather than being concatenated into one number.
- The signup route passes the complete canonical document as each `p_services[].price_guide`. The signup SQL preserves it through `v_service -> 'price_guide'` into `services.price_guide` (`jsonb`); the compatibility projection must not replace or flatten that JSON.
- Local code/tests can verify parsing, validation, compatibility projection, RPC payload shape, and the checked-in SQL mapping without contacting a database. Actual persistence and post-login read-back are verified only by an explicitly authorized write/read test against the 연습 DB; until then they must be reported as unverified, not passed.
- Service pricing is collected once before personal/account information and is not asked again in post-signup initial setup.
- Before final signup, editable price rows stay in browser memory. A selected price-guide photo may be sent to `POST /api/auth/signup/price-guide-preview` for request-scoped AI parsing; the original image and any unencrypted editable draft are never written to Supabase Storage or a database, while only an AES-256-GCM-encrypted structured preview result may be kept in `signup_price_guide_analysis_requests` for duplicate-file reuse for up to 5 minutes. The owner-confirmed canonical document is written only by final signup to `services.price_guide`.
- Final signup revalidates all service rows server-side. Auth user creation is followed by one Postgres transaction for shop, owner profile, primary membership, canonical `services`, and initial owner staff; a failed database transaction triggers Auth-user compensation deletion.
- `signupRequestId` is idempotent. Reuse with a different HMAC payload hash returns `409`; completed identical requests reuse the completed result; unresolved compensation is recorded as `compensation_pending` for operator recovery.
- Distinct normalized emails may create distinct owner/shop accounts with the same KCP-verified canonical phone. Phone, CI, or DI duplication alone must not block signup; email/Auth uniqueness remains canonical.
- Trial eligibility is server-only. The server canonicalizes the verified phone and derives current and lookup-required previous purpose-scoped HMAC aliases. The signup route calls `complete_owner_signup_v5`; after its Auth-identity and partial-data checks, the existing v4 provisioning transaction atomically creates the owner/shop/service records, claims the phone trial, creates `owner_subscriptions`, and stores the idempotent result.
- `owner_trial_identity_claims` and `owner_trial_identity_aliases` store no raw phone, email, user/shop ID, CI, or DI. The claim has no account/shop foreign key so account deletion cannot reset eligibility. Key rotation keeps previous aliases required until every claim has the new alias and the retirement check reports missing 0.
- The first successful claim returns `trial: { eligible: true, days: 14 }`, `billingRequired: false`, `nextAction: initial_setup`. Later successful signups for the same identity return `trial: { eligible: false, days: 0 }`, `billingRequired: true`, `nextAction: billing`.
- Clients must not send or infer `trialEligible`, `trialDays`, or `billingRequired`. PC and mobile consume the same main signup response and route billing-required signups to the canonical owner billing flow.
- Signup creates the canonical single `single_monthly_v1/1m` subscription entitlement with product version `2026-08-v1` and an immutable `29,000 KRW` price snapshot. Legacy `monthly` remains a historical 19,000 KRW/500-credit code and must not be reused or rewritten for new sales. Signup must not create/reset Alimtalk credit balances or events; notification access follows active subscription entitlement rather than plan credits or additional top-ups.
- New Alimtalk top-up sales are disabled: owner purchase CTAs are absent and purchase/confirm APIs return 410 before auth/body/provider work. The PortOne webhook may reconcile only legacy `alimtalk-credit-purchase` payments with a PAID timestamp before `2026-08-27 00:00 KST`; later payments must never grant credits.
- If any of `owner_subscriptions.current_plan_code`, `featured_plan_code`, or `auto_renew_plan_code` is `single_monthly_v1`, the row must carry the exact `2026-08-v1 / 29000 / KRW` snapshot. Subscription payment ledger rows for the code carry the same immutable snapshot and reject later mutation.
- Post-signup initial setup uses the current authorized shop's persisted data as its only completion source: valid enabled business hours, at least one persisted staff member with a role and valid default work schedule, then at least one active canonical customer-service option.
- `/api/bootstrap` exposes this derived, shop-scoped state as `initialSetupReadiness` (`shopId`, `steps.hours`, `steps.staff`, `steps.pricing`, `completed`, `nextStep`). A missing or mismatched `shopId` fails closed as incomplete. URL query parameters and browser storage never mark setup complete.
- A successful final service save must be followed by an authoritative essential-bootstrap read before setup entry points disappear. Save or refresh failure keeps the current shop incomplete and preserves the recovery path.

## Customer Breed Pricing Group Contract

The customer booking flow may derive a temporary price-guide group from the breed entered during booking. It is a display and booking-option filter only; it must not write to `pets.pricing_group`.

- The source is each active detailed price-guide section's `note` field, using comma-separated representative breed names.
- The matched section's `species + title` identifies the eligible customer service group.
- `/api/customer-benefits/quote` and `/api/customer-bookings` receive the entered `breed` and independently apply the same group filter before resolving a service option and price.
- When no confident representative-breed match exists, the customer sees the normal configured service menu so an unknown spelling never blocks booking.
- Staff or owner confirmation in the reservation detail remains the authority for body size, care difficulty, and the saved `pets.pricing_group` value.

## Customer Booking Price And Weight Contract

Customer booking price and duration are resolved from the detailed price guide in this order: representative breed group, entered/stored body weight, then grooming item.

- `POST /api/customer-benefits/quote` and `POST /api/customer-bookings` accept `weightKg` as a required positive number alongside `breed` and `customerServiceOptionId`.
- The backend independently resolves the matching detailed price-guide weight band and uses that exact cell's price and `durationMinutes`.
- If no registered weight band matches, the backend must not fall back to the first band or invent a price/time.
- Customer profile pet responses include the existing database `pets.weight` value so a repeat booking can reuse it.
- Customer booking keeps `appointments.service_id` linked to the canonical active source service. It must never create a per-booking inactive service row.
- The selected detailed price-guide option is retained in `appointments.discount_snapshot` through `customerServiceOptionId`, `customerServiceOptionName`, and `customerServiceOptionDurationMinutes`.
- The resolved price remains in the existing appointment price and discount snapshot fields. The resolved duration defines `start_at` and `end_at`, so later schedule, grooming-record, and rebooking flows preserve the booked duration without a copied service row.
- Customer self-bookings are created as `confirmed` immediately. Do not reintroduce customer `pending`, manual approval controls, or approval-waiting copy.

## AI Booking Recommendation Contract

AI booking recommendations are a product-wide policy shared by PC, mobile, and booking APIs. They are not configurable in the owner settings screen. Existing `shops.reservation_policy_settings` AI keys remain readable only for backward compatibility and do not change customer booking behavior.

Rules:

- AI may rank only slots already returned by the deterministic availability calculation. It must not create, move, or cancel reservations.
- Customer booking always displays every deterministic valid slot. It displays AI-selected valid slots first under `AI 추천 시간` (or `추천 시간` for a safe rule fallback), then the remaining slots under `다른 예약 가능한 시간`.
- The API returns up to four valid rule-ranked recommendations when slots exist; DeepSeek may rerank those valid choices, and failure or timeout falls back to the rule ranking without blocking self-booking.
- The customer screen distinguishes `ai` recommendations from the safe `rule` fallback and never labels an unavailable slot as recommended.
- Recommendations prefer booking times adjacent to existing work to reduce idle gaps.
- A customer booking with no staff selection is assigned to an eligible staff member with the fewest booked minutes, then the fewest bookings, for that date.
- A customer-selected staff member is never changed by staff balancing.

## Required Database Contracts

The shared backend contract includes these tables, views, columns, and storage resources:

- `media_assets`
- `media_variants`
- `petmanager-media` storage bucket
- `staff_members.profile_message`
- `staff_members.profile_image_urls`
- `staff_members.profile_image_asset_ids`
- `appointment_change_events`
- `staff_schedule_overrides`
- `pet_staff_notes`
- `shop_alimtalk_credit_summaries`

## Admin Work Control Plane Contract

### Owner pilot pre-payment benefit

- General owner signup remains a 14-day, card-free trial. An operator-confirmed pilot enrollment replaces that window with exactly 30 total days from the existing `owner_subscriptions.trial_started_at`; it never adds 30 days to the 14-day trial.
- `owner_pilot_benefit_claims` and `owner_pilot_benefit_grants` are separate from the legacy post-payment early-partner claim/grant tables. They never auto-combine with the first-payment benefit.
- A verified feedback or issue grant is an integer of at least 3 days. The resulting pilot free-access window is always recomputed from the original start and may never exceed 60 total days.
- `grant_owner_pilot_pre_payment_benefit_v1` locks the exact `user_id + shop_id` subscription, rejects any paid ledger row, enforces exact idempotent replay, updates the trial end, and appends the reasoned grant in one transaction.
- Only the authenticated admin server route may inspect or request these grants. `anon` and `authenticated` have no table or function privileges; missing migration state fails closed and disables grant controls.
- The checked-in migration and admin surface are source-only until an owner-approved Development/Production migration apply. No source-only test proves a real benefit was granted.

### Owner pilot 20-shop cohort authority

- `owner_pilot_cohort_memberships` is the stable `shop_id + owner_user_id` authority for at most 20 pilot shops. Its lifecycle is `planned | active | paused | completed | excluded`; positions are never automatically recycled and legacy non-members are unchanged.
- `owner_pilot_cohort_membership_events`, `owner_pilot_feedback_events`, and `owner_pilot_first_paid_benefit_grants` are separate idempotent ledgers. Exact-key replay is resolved before mutable state checks, while a changed request using the same key fails closed.
- Every non-empty pilot feedback submission is recorded without severity, duplicate, known-issue, or reproducibility scoring. Only an active, unpaid member with an initial pilot claim and at least 3 available days receives an extension; otherwise intake remains recorded with zero granted days. The original-start total never exceeds 60 days.
- The first confirmed `single_monthly_v1` payment for a non-excluded cohort shop guarantees one 30-day paid-period extension. If the legacy early-partner trigger already supplied the same payment's 30 days, the cohort ledger records that source instead of adding another 30 days.
- Authenticated owner bootstrap may expose the non-sensitive `pilotCohort` projection for its authorized shop. Public and staff-scoped bootstrap responses do not expose it; no admin reason, email, feedback text, or fingerprint is included.
- Feedback content is trimmed and SHA-256 fingerprinted by the authenticated admin server route. Raw feedback text is not persisted by the cohort contract. Recognition/ranking remains `not_decided`/`not_evaluated`; no score or first-place reward is inferred.
- Migration `20260907091000_owner_pilot_cohort_authority.sql` is source-only until a separately approved database apply. PC and mobile consumers must treat `schemaReady: false` or an absent optional projection as a legacy non-member state, not as granted eligibility.

### Tester feedback fast lane

- `POST /api/owner/tester-feedback` is the shared mobile/PC Hanmadi write path. It accepts strict JSON `{ shopId, requestId, category, body, screenKey, appVersion, screenshot? }`; category is `inquiry | improvement | bug`, screen keys use the shared allowlist, and `requestId` is a UUID reused for the same logical retry.
- Every authenticated representative owner may submit. The server binds the exact `owner_shop_memberships` owner row before mutation; `owner_pilot_cohort_memberships` is read only to derive the tester emphasis tag and is never an intake gate. A client flag, Play tester status, shop name, or device property is never authorization.
- An optional screenshot requires explicit `consent: true`, a server-issued `feedback_screenshot` media asset owned by the same owner/shop, private visibility, ready status, JPEG/PNG/WebP, and at most 5 MiB. Feedback storage keeps only the media reference plus canonical type/size, consent time, and a one-way receipt fingerprint. It never auto-attaches customer, pet, appointment, gallery, audio, device, log, URL, or token data. Admin removal deletes exact storage objects, variants, and media metadata before marking the receipt deleted; partial failure is retry-safe and fail-closed.
- The route stores only the tenant/actor identifiers needed for authorization, required feedback body, category, allowlisted screen key, bounded app version, server timestamps, status, and one-way replay/deduplication fingerprints. Customer, guardian, pet, appointment, photo, audio, raw device/log, token, referrer, and free-form URL fields are not accepted or attached.
- Exact request replay is idempotent, changed-payload replay fails closed, matching content is suppressed for 10 minutes, and limits are 5 submissions per hour and 20 per 24 hours for one owner+shop.
- Mobile receives only a compact acknowledgement (`id`, `category`, `screenKey`, `appVersion`, `status`, `createdAt`, `testerEmphasis`, `screenshotAccepted`, `replayed`). Admin-only `GET/PATCH /api/admin/tester-feedback` provides newest-first listing, category/status filtering, status changes, screenshot preview/removal, and explicit tester access decisions.
- Tester access is projected from the same stable `shop_id + owner_user_id` cohort row. `tester_access_review_due_at` is seeded from the existing trial/pilot period; after that timestamp the computed state is `awaiting_owner_decision` and access remains allowed. Only explicit `extend_3_days`, `end`, or `convert` actions mutate the decision ledger. The projection never cancels, charges, or changes subscription/payment rows. D-3, D0, and each three-day overdue reminder use deterministic in-app notice keys.
- Migration `20260908025208_tester_feedback_intake.sql` is source-only until a separately approved database apply. Missing schema must return a recoverable unavailable state rather than a false success.

- `marketing_work_items` is the current operational projection; `marketing_work_events` is the append-only event ledger.
- `marketing_work_approvals`, `marketing_work_artifacts`, and `marketing_work_outbox` remain separate audit, safe-artifact, and delivery contracts.
- Persisted rows are operational-only (`source_type = operational`). Demo fixture/replay data never writes to the operational ledger.
- Server ingestion is idempotent, preserves out-of-order events, and updates the current projection only when the source timestamp is not older.
- `anon` and `authenticated` have no direct table or ingest-function privileges. The server-only gateway token and Supabase service role must never reach a browser.
- Stored summaries are non-identifying. Raw prompts, terminal output, customer identifiers, credentials, and secret values are forbidden.
- Work-state changes keep `execution_enabled = false` and `external_execution = false`; they cannot trigger advertising, publishing, messaging, deployment, or budget changes.

## Data Deletion And Recovery Contract

- `shops.deleted_at`, `shops.deleted_by_actor`, and `shops.deleted_reason` represent a withdrawn shop retained for recovery. PC, mobile, public booking, and bootstrap projections must exclude shops whose `deleted_at` is set.
- Owner withdrawal must soft-delete the owned shop before deleting the related Auth user. If Auth deletion fails, the shop soft-delete must be rolled back.
- `data_deletion_audit` is an internal, append-only backend table. It records hard deletes and shop soft-delete/restore events with the target table, row ID, shop ID, actor identifier, timestamp, reason when available, and a protected row snapshot.
- `anon` and `authenticated` have no direct privileges on `data_deletion_audit`; mobile and PC must not query or mutate it directly.
- Hard `TRUNCATE` is forbidden for protected operational tables. Destructive smoke/capture scripts must run only against a dedicated `SUPABASE_ENV_NAME=test` project, never development or production.

## Appointment Status And Change Payload

Mobile may send or consume these fields through the shared appointment/status flows:

- `mediaAssetIds`
- `notifyCustomer`
- `visitReminderOffsetMinutes`
- `pickupReadyEtaMinutes`
- `staffId`
- `preserveStatus`
- `enforceShopCapacity`
- `allowOutsideShopHours`
- `groomingRecord.treatmentNotes`
- `groomingRecord.specialNotes`
- `groomingRecord.nextRecommendedVisitDate`

Rules:

- Appointment state is shared between PC owner web and mobile owner/staff app.
- `appointments.memo` is the customer request memo. `appointments.staff_memo` is a separate owner/staff-internal appointment memo and must never be exposed through customer booking, result, or shared-link projections.
- The PC/shared-backend migration authority for `appointments.staff_memo` is `D:\petmanager\supabase\migrations\20260818100210_appointment_staff_memo.sql`; mobile consumes the shared field through the PC backend contract and does not own this schema migration.
- `pending` is a legacy/external appointment status accepted by the shared DTO and preserved by PC bootstrap; it is never generated by customer booking or any status-update mutation. Existing `pending` rows may move only to `confirmed`, `cancelled`, or `rejected`; an unchanged `pending` request is a no-op and every non-pending row rejects a transition to `pending`. Unknown stored statuses fail closed.
- A server-only status RPC compares the exact previous status and commits the status row, required completion record/media links, and status history in one transaction. A concurrent or linked-write failure leaves the status unchanged; customer notifications run only after that commit.
- Status updates that require media on PC must use the same requirement on mobile.
- `appointment_change_events` records status/detail changes that need to be visible across surfaces.
- Capacity and shop-hour enforcement flags are backend contracts; mobile should not reinterpret them independently.
- `in_progress`, `almost_done`, and `completed` do not require media. `almost_done` is the pickup-ready notification state before grooming completion.
- Mobile may offer `사진 찍고 시작` and `바로 시작`, but media remains optional. Missing before/after photos must not block pickup-ready or grooming completion.
- Completion upserts exactly one `grooming_records` row for the appointment. `style_notes` stores the customer-visible treatment summary, `memo` stores customer-visible care/special notes, and `internal_memo` stores owner/staff-only notes that must never be exposed through customer result APIs or links.
- `grooming_records.actual_duration_minutes` is derived from `appointments.actual_started_at` and `appointments.actual_completed_at`; clients must not calculate a different persisted value.
- `grooming_records.next_recommended_visit_date` stores the owner/staff-selected recommended return date.
- The completion record uses the appointment's `final_service_price` snapshot when present and synchronizes one linked `shop_revenue_entries` row through `grooming_record_id`.

### Customer booking atomic persistence

- A Supabase-backed customer booking is one server-only atomic RPC request. Guardian, primary pet, appointment, and every `appointment_pet_participants` row commit together or all roll back.
- Every linked guardian, pet, service, staff member, appointment participant, notification, and media asset must have the same `shop_id`; cross-shop identifiers are rejected by database constraints or tenant triggers.
- The RPC keeps only HMAC/SHA-256 request fingerprints for replay protection. It never persists raw request identity data in the idempotency record.
- A provider `paymentId` may be claimed once only. A non-null provider order ID is globally unique, while an unpaid booking keeps that field null. The stored claim is bound to the exact shop, provider order ID, and canonical booking payload hash; reuse with any different booking is rejected.
- Notification and media rows may only reference a guardian/pet pair that matches the referenced appointment; matching a shop alone is not sufficient.
- Customer-facing booking success remains immediately `confirmed`. This does not authorize a pending-approval customer flow.

### Grooming record draft contract

- `grooming_record_drafts` stores at most one unfinished draft per `appointment_id` and must not create customer history, notifications, or revenue entries.
- Draft fields are `treatment_notes`, `special_notes`, `internal_notes`, `next_recommended_visit_date`, and the selected `after_media_asset_id`.
- Owner/manager accounts may edit a draft inside their shop. Staff accounts may edit only appointments assigned to their linked staff member.
- Clients save the same draft immediately to versioned local storage, debounce authenticated server persistence, and recover the newer of the local and server timestamps.
- A completed grooming record clears a base-only server draft. A failed completion keeps the draft and selected uploaded photo recoverable; an unfinished AI care-report draft follows the survival rule below.
- `anon` and `authenticated` have no direct table privileges. The shared owner API and service role are the only database write authority.

### AI care report contract

- AI care reports extend `grooming_record_drafts` and `grooming_records`; they do not create a second customer-history record.
- The only writable and projectable report value is `{ "reportText": string }`. `reportText` is the complete, smooth customer-facing report body; headings, section labels, bullets, and parallel detail fields are not part of the new contract.
- `POST /api/owner/care-reports` accepts either `sourceText` for first generation or `currentReportText` plus `revisionRequest` for revision. Its response object contains only `reportText`; revision replaces the entire current body.
- Typed/transcribed source and revision requests are generation inputs only. The API does not persist them, atomic facts, citations, categories, observations, provider prompts, or provider error bodies.
- `care_report_ai_draft` stores only `{ "reportText": string }` for new drafts and is never customer-visible. A new draft write clears legacy `care_report_observations`, `care_report_voice_transcript`, and `care_report_generation_id` values and clears prior owner confirmation.
- The owner/staff member must review and explicitly confirm the edited body. A confirmed report is copied as `{ "reportText": string }` to `grooming_records.care_report_data` with its confirmation timestamp and photo-consent state.
- An unfinished care-report draft survives grooming completion. Once a confirmed report has been copied to the final record, the server draft may be deleted.
- Customer result APIs may project the normalized `reportText` only when `care_report_owner_confirmed_at` is present. They must never expose legacy observations, voice transcripts, unconfirmed AI output, token usage, cost, or provider errors.
- Before/after photos appear in an AI care report only when `care_report_photo_consent = true` and the existing result-token/media-visibility checks also pass.
- `care_report_sent_at` is set only when an owner-confirmed report is included in a successfully sent customer completion notification.
- AI copy must be observation-only: no medical diagnosis, disease conclusion, medication instruction, or treatment claim. AI never sends automatically; owner confirmation remains mandatory.
- AI generation treats the owner/staff member's typed or transcribed source as the grounding text. A general impression such as `오늘 작업 전체적으로 괜찮았어` is valid input and may be rewritten naturally without inventing details.
- The provider must preserve supported actions, reactions, cautions, numbers with units, body sides, and negation. It must reject or fail closed on PII, unsupported medical claims, invented measurements, changed sides, and reversed negation.
- Iterative generation treats `currentReportText` as the owner-visible working body, applies the latest `revisionRequest`, and preserves unaffected owner edits. Neither value is saved separately from the resulting `reportText`.
- Customer and owner history surfaces render the normalized body once, without empty placeholders or legacy section labels.
- Existing records containing `oneLineSummary`, `treatmentSummary`, `conditionSummary`, `groomingResponse`, `homeCareTips`, or `nextVisitGuide` remain unchanged at rest. Read projections join their non-empty values in that order into one `reportText`; no new write may recreate those keys.
- Verified service, actual duration, current weight, and next recommended date remain separate product facts. They are not automatically concatenated into `reportText` merely to make the AI response look complete.
- Internal shop notes, unconfirmed assumptions, and unrelated historical visit details are never AI input for customer copy.
- Weight comparisons use only the same pet's actual measurements, rounded to 0.1kg. They must never be described as a breed average.
- Weight alone cannot produce `normal`, `overweight`, `underweight`, diet, or weight-loss instructions. Such wording is allowed only when the owner source explicitly includes a body-condition or weight-management assessment; otherwise the AI may state only the measured change and same-pet recent-record comparison.

#### Care report draft and publish actions

- PC and mobile use the same `PATCH /api/owner/care-reports` contract with `action: "save_draft" | "publish" | "publish_basic"`.
- `save_draft` accepts `reportText` plus `photoConsent`, persists `{ "reportText": string }` in `grooming_record_drafts`, clears owner confirmation, and keeps the customer result in `케어리포트 작성 중` state.
- `publish` accepts the same `reportText`, copies `{ "reportText": string }` to `grooming_records`, records `care_report_owner_confirmed_at`, and makes that exact body visible through the existing appointment-scoped customer result link.
- `publish_basic` makes the same result link complete without an AI call. It publishes one body composed only from verified appointment and grooming facts and may later be replaced by an owner-reviewed report without sending a second Alimtalk.
- `publish` requires the appointment's completed `grooming_records` row. The final report update and `grooming_record_drafts` cleanup execute in one database transaction; if the completed record is missing, the API returns a conflict and must not report a false publish success.
- `publish` does not send a second Alimtalk by itself. The customer continues to use the result link delivered with the grooming-completion notification.
- PC and mobile must both expose `임시저장` and `리포트 보내기` actions and allow an unfinished draft to be reopened from a completed appointment.
- Immediately after grooming completion, PC and mobile offer `리포트 보내기` and `기본 기록만`. The completion status and actual completed time are persisted before this choice; neither care-report authoring nor AI generation may delay the measured completion time.
- Drafts are server-backed and appointment-scoped, so work started on PC can be resumed on mobile and vice versa. Clients may keep a local recovery copy but must not treat it as the cross-device source of truth.

## Customer Grooming Result Link Contract

- Completion notifications issue a signed booking access token with `action: "result"` and the completed `appointmentId`.
- The result link opens `/m?t={token}` and must work without an app install, account, or login.
- Result tokens are appointment-scoped and expire after 365 days. They may display only the completed appointment, customer-shared/public before/after media linked to that appointment and pet, and the same pet's limited weight trend described below.
- `/api/customer-lookup` token responses include `access.action: "result"`, the matching grooming record, `resultMediaAssets` containing only `id`, `appointmentId`, `groomingRecordId`, and `mediaKind`, and `weightHistory` containing only `measuredAt` and `weightKg`.
- `weightHistory` is available only for a valid `action: "result"` token. It uses positive `grooming_records.pet_weight_snapshot` values for the same pet, ordered oldest to newest and limited to the latest 12 actual measurements. If no historical snapshot exists, one current `pets.weight` value may be returned with the completed result timestamp; the server must never synthesize multiple historical points. It must not expose another visit's appointment, service, memo, care report, price, or staff data.
- `/api/media/public-signed-urls` requires the same result token before returning signed URLs for `customer_shared` grooming media. Untokened public media lookup is restricted to `visibility = "public"`.

## Time Profitability Contract

`GET /api/owner/profitability?shopId={shopId}&range=30d|90d|365d` is the shared owner profitability source. Owner and manager accounts may access it; staff accounts may not access shop-wide staff revenue comparisons.

Canonical completed-work snapshot fields on `grooming_records`:

- `actual_duration_minutes`
- `expected_duration_minutes`
- `original_price`
- `discount_amount`
- `price_paid`
- `pet_breed_snapshot`
- `pet_weight_snapshot`
- `pricing_group_snapshot`
- `service_name_snapshot`
- `staff_id`

Rules:

- Actual duration comes from the completed appointment's actual timestamps. Imported legacy history may use a known external actual duration when no PetManager appointment exists.
- Expected duration comes from the completion snapshot, then the appointment window, then the detailed price-guide service duration.
- `shop_revenue_entries` remains the one revenue ledger. Profitability must not create a separate editable revenue total.
- Breed, weight, service name, expected duration, original price, discount, and final paid amount are historical snapshots and must not change when current pet/service settings change.
- Price-increase recommendations require at least three timed records for the same breed, rounded weight, and service segment.
- Records without actual time are excluded from hourly calculations and returned as a data-quality count. Clients must not invent actual time.
- `durationRecommendations` is a read-only array returned by the profitability API. Each item contains `key`, `shopId`, `serviceId`, `serviceName`, `roundedWeightKg`, `weightLabel`, `sampleCount`, and `observedAverageMinutes`.
- A duration recommendation groups only by the authenticated shop, the durable current `services.id`, and whole-kilogram `pet_weight_snapshot`. It requires at least three unique completed appointments in the same group.
- Each included row must have exactly one linked grooming record, a current matching service, `appointments.status = completed`, valid `actual_started_at` and `actual_completed_at`, and a persisted `actual_duration_minutes` equal to the rounded elapsed timestamp duration. Cancelled rows, missing or invalid actual timestamps, mismatched duration/service values, missing weight snapshots, unknown services, unlinked imports, and ambiguous duplicate appointment records are excluded.
- Duration recommendations never overwrite or persist the detailed price guide's owner-configured baseline duration. When a group has fewer than three eligible rows or recommendation loading fails, clients keep the configured duration and present no computed average as fact.

## External Data Import Contract

`POST /api/owner/data-import` accepts authenticated owner/manager multipart requests with `shopId`, `source`, `mode`, and `file`.

- `source`: `teepee` | `generic`
- `mode`: `preview` | `commit`
- accepted files: `.xlsx` | `.csv`
- maximum size: 10MB
- maximum parsed rows: 5,000

Rules:

- Preview performs no customer-data writes.
- Guardians merge by normalized phone number. Pets merge within one guardian by normalized pet name.
- Commit reparses the uploaded file server-side and does not trust client preview rows as write payloads.
- A `(shop_id, source, file_sha256)` batch is idempotent. A completed file cannot duplicate imported visits.
- Imported visits are standard `grooming_records` with `record_source = "external_import"`, `external_source`, and `external_record_key`; they feed the same customer history, revenue trigger, and profitability analysis as native records.
- Missing historical services may be created only as inactive history-link services. They must not appear in customer booking.
- Imported price rows become an inactive detailed-price-guide draft. They never overwrite or activate the current price guide automatically.
- `shop_data_import_batches` and `shop_data_import_rows` store fingerprints, counts, linked IDs, statuses, and error codes only. Raw workbook files and raw PII rows are not retained.
- The two audit tables have RLS enabled and no `anon` or `authenticated` table privileges. PC/backend service-role code is the write authority.
- Mobile may consume completed imported customer/history data through existing shared APIs, but must not implement a separate importer or direct Supabase writes.

### Price guide photo import contract

- PC creates a crypto-random, PII-free `clientCorrelationId` before requesting a `price_guide_source` upload intent. The server deterministically binds that correlation to exactly one task media asset and object lifecycle; legacy mobile callers may omit the field during the compatibility window.
- `POST /api/owner/price-guide-photo-import` accepts authenticated owner/manager JSON requests with `shopId`, exactly one `mediaAssetId`, and its server-issued cleanup proof when the caller supports the correlation contract.
- Every source asset must belong to the current shop and use `media_kind = "price_guide_source"`, `visibility = "private"`, and `retention_policy = "archive"`.
- Before any provider extraction call, the server deletes the exact source object and variants, verifies object absence, hard-deletes `media_assets`/`media_variants`, and verifies metadata residue zero. The response exposes only one-way correlation/asset/object fingerprints, `hardPurged`, and zero residue counts; raw media IDs, object paths, cleanup proofs, photos, provider payloads, and credentials are not part of the cleanup receipt.
- AI extraction is a preview only. It must preserve visible rows and columns, leave unreadable values blank, flag uncertain cells, and never invent a price, duration, species, or breed group.
- Structured rate-card extraction keeps group headings, parenthetical breed examples, weight-band labels/notes, and service-column order separate. A group heading such as `소형견 (말티즈, 요크셔)` may be presented with a product display label, but the breed terms remain breeds and must never become service names.
- The detailed price guide is updated only after the owner compares the source photo with the extracted result and explicitly confirms it.
- PC is the current onboarding surface. Mobile may later reuse the same shared API contract, but must not introduce a separate photo-import schema or direct Supabase write.

## Staff Profile Contract

Database field:

- `staff_members.profile_message`

Frontend/API field:

- `profileMessage`

Name and message rules:

- Prefer `displayName` as the customer-visible staff name when present.
- Fall back to `name` when `displayName` is empty.
- If `profileMessage` is empty, show: `아이 성향에 맞춰 차분하게 미용해드려요.`
- Owner web, owner app, and staff app must all read staff profile data from `staff_members`.
- Keep the existing save flow for `displayName`, `profileImageUrl`, `profileImageUrls`, `profileImageAssetIds`, `titlePrefix`, `position`, and `chipColorIndex`.

PC/backend implementation notes:

- `/api/staff-members` exposes `profileMessage` from `staff_members.profile_message` with the fallback above.
- `/api/bootstrap` exposes the same staff profile fields and fallback.
- Staff read payloads may include `profileImageFallbackKey: "petmanager-default-profile"`. This is an output-only hint for the bundled non-gendered default image when the uploaded profile URL is missing or cannot be displayed; it is not a persisted preference and must not replace `profileImageUrl`, `profileImageUrls`, or `profileImageAssetIds`.
- Consumers must keep the stable staff `id`, try the current signed/normalized uploaded `profileImageUrl` first, and use the fallback key only when that image is absent or fails to load. The fallback must never expose a storage object path or imply a gender choice.
- Shared frontend helper: `src/lib/staff-display.ts`.

## Shop Identity Edit Contract

Customer-visible shop identity fields are shared across PC owner web, owner mobile web, and hybrid app surfaces.

Limited fields:

- `shops.name`
- `shops.address`
- `shops.phone`
- `shops.customer_page_settings.shop_name`
- `shops.customer_page_settings.address_detail`
- `shops.customer_page_settings.additional_contact`

Rules:

- `/api/settings` and `/api/owner/shops` enforce the same server-side monthly edit limit.
- `/api/customer-page-settings` also enforces the same limit for customer-visible shop name, address detail, and additional contact changes.
- A single successful save that changes one or more limited fields counts as one shop identity edit group.
- Each shop may create at most two identity edit groups per Korea calendar month.
- When the limit is exceeded, APIs return HTTP `429` with a Korean user-facing message directing the owner to 1:1 문의.
- Successful changes are recorded in `shop_identity_change_events`; multiple fields changed in the same save share `metadata.change_group_id`.
- `shop_identity_change_events` is backend-only: RLS is enabled and `anon`/`authenticated` have no direct table privileges.
- Mobile must not implement a separate local limit. It should surface the backend error message as-is.

## Owner Support Request Contract

Owner 1:1 support requests use the shared Supabase tables `owner_support_requests`, `owner_support_messages`, `owner_support_attachments`, and `owner_support_notifications`. Mobile must never write these tables directly.

Shared API:

- `GET /api/owner/support-requests?shopId={shopId}&limit=20` returns `{ requests }` in newest-first order.
- `POST /api/owner/support-requests` accepts `shopId`, `category`, `title`, `contact`, `ownerName`, `ownerPhone`, `ownerEmail`, `message`, and `context`.
- `PATCH /api/owner/support-requests` accepts `shopId` and `requestId`, then records that the owner opened the request/reply.

Authorization and access rules:

- Every request must include the current Supabase access token as `Authorization: Bearer {accessToken}`.
- The server validates that the token holder can access `shopId`; staff accounts are rejected and owner/manager accounts may access only their own shop scope.
- `context` is diagnostic-only. The server keeps only `currentPath`, `route`, `device`, `platform`, `appVersion`, `appBuild`, `osVersion`, and `browser`; arbitrary payload fields must not be treated as durable support data.

Response fields:

- Canonical PC fields remain camelCase: `id`, `category`, `title`, `message`, `status`, `answeredAt`, `ownerLastReadAt`, `createdAt`, `messages`, and `attachments`.
- Mobile compatibility aliases are included on each request: `answer`, `reply`, `admin_reply`, `answered_at`, `created_at`, `read_at`, and `owner_read_at`.
- `answer`, `reply`, and `admin_reply` contain the latest admin answer when present, otherwise an empty string. `read_at` and `owner_read_at` are the same owner-read timestamp.

Mobile connection:

- Production mobile API base URL is `https://www.petmanager.co.kr`; configure `NEXT_PUBLIC_API_BASE_URL=https://www.petmanager.co.kr` and call `${NEXT_PUBLIC_API_BASE_URL}/api/owner/support-requests`.
- The native mobile shell may load from `https://app.petmanager.co.kr/login`, but its authenticated API requests must still use the canonical `www` origin above.
- Local mobile development may use `http://127.0.0.1:3000` when the PC/backend server is running locally.
- CORS accepts bearer-token requests from `http://localhost:3100`, `http://127.0.0.1:3100`, the existing `8086` development origins, and `capacitor://localhost`. Same-origin production web requests do not require CORS.

## Media Contract

- Owner/staff/customer media should be represented by `media_assets` and variants by `media_variants`.
- Storage object paths must belong to the `petmanager-media` bucket.
- API responses should prefer media asset IDs for durable references and signed URLs for display/use.
- Staff profile image arrays use `staff_members.profile_image_urls` and `staff_members.profile_image_asset_ids`, with `profileImageUrl` as the first visible image/fallback compatibility field.
- Authenticated owner/staff full bootstrap may include `petDisplayPhotos[]` with only `petId`, `url`, `source`, and `latestCompletedAt`. `source` is `latest_grooming_after`, `pet_profile`, or `fallback`.
- `latest_grooming_after` is selected from the single newest `grooming_records` row for the same shop and pet, ordered by `groomed_at desc` with record ID as the stable tie-break. Only a ready `grooming_after` asset linked to that exact record may be signed. If that newest record has no usable after photo, clients must use the current profile/fallback and must not search an older grooming record.
- Public bootstrap must not expose this projection. Staff bootstrap filters it to pets assigned to that staff member. Raw media IDs, object paths, buckets, cleanup proofs, and private-storage metadata are never projection fields.

## Notification And Alimtalk Contract

- Visit reminder automation uses `/api/notifications/visit-reminders`.
- Shop Alimtalk credits are accounted through `shop_alimtalk_credit_summaries` and related ledger data.
- Sends must be blocked when the shop has no remaining credits.
- Mobile should not introduce a separate Alimtalk balance model.

### Revisit Reminder Default

- `shops.notification_settings.revisit_reminder_default_days` is the shop-level default interval for revisit reminders.
- The value is an integer from `1` to `365`; legacy or missing values normalize to `45`.
- PC settings own this default. A new grooming completion draft initializes `next_recommended_visit_date` from the completion date plus this interval only when `revisit_enabled` is on.
- A saved per-grooming `next_recommended_visit_date` remains the source of truth for that visit. Owners may set it to `null` (`알림 안 함`) or override it with `날짜 지정`.
- Mobile must read the same shop notification setting and must not introduce a separate local default.


### Guardian Personal Alimtalk Settings

Customer-level Alimtalk preferences are stored in `guardians.notification_settings` and must be shared by PC, mobile web, and hybrid app.

Canonical customer-level keys:

- `enabled`: master on/off for customer-facing Alimtalk sends.
- `booking_confirmed_enabled`: reservation confirmation.
- `booking_cancelled_enabled`: reservation cancellation.
- `booking_rescheduled_enabled`: reservation change confirmation.
- `appointment_reminder_10m_enabled`: all visit reminder variants. This single key controls direct/soon reminder, same-day reminder, and day-before reminder.
- `grooming_started_enabled`: grooming start.
- `grooming_almost_done_enabled`: pickup ready.
- `grooming_completed_enabled`: grooming complete.

Visit reminder notification types must share the same customer-level key:

- `appointment_reminder_10m`: direct/soon visit reminder.
- `visit_reminder_notice`: same-day visit reminder.
- `visit_schedule_notice`: day-before visit reminder.

Do not expose separate customer-level toggles for direct/today/tomorrow visit reminders unless the PC/backend contract is changed first. Mobile may label this group as `직전·오늘·내일 안내` or `방문 안내`, but it must save to `appointment_reminder_10m_enabled`.

`booking_rejected_enabled` is not a canonical customer-level key. Booking rejection remains a shop-level/legacy flow and must not be exposed as a separate guardian personal preference unless this contract is changed first.

PC/admin may own shop-level Alimtalk settings. Mobile customer detail may edit only customer-level preferences and must PATCH the same `guardians.notification_settings` object used by PC.

### Guardian Customer Classification

Customer classification is shop-scoped metadata on `guardians`; it is never an Auth, login, or owner/staff permission role.

- `customer_grade_override` is nullable. `null` means `자동`, so clients keep the canonical per-shop calculation: `주의` at two or more no-shows, `단골` at five or more appointments, otherwise `일반`.
- Non-null grade overrides are `normal` (`일반`), `loyal` (`단골`), and `attention` (`주의`). Saving `자동` must persist `null` so a user can return to the calculation later.
- `customer_member_type` is `guardian` (`보호자`), `proxy` (`대리인`), or `guest` (`비회원`) and defaults to `guardian`.
- PC customer management may create or PATCH these two fields through the authenticated, shop-scoped guardians API. Mobile and customer booking surfaces must not infer or change Auth roles from either field.

## Customer Discount Coupon Contract

Customer-facing discount coupons are stored in `shops.customer_page_settings.discount_coupons`.

Rules:

- `audience: "first_visit"` coupons are for customers without previous appointment history in the shop.
- `audience: "revisit"` coupons are for customers with previous appointment history in the shop.
- First-visit and revisit coupons must never be returned as applied benefits for the same identified customer.
- Before the customer is identified, entry surfaces may advertise both active first-visit and revisit promotions as conditional shop offers.
- `owner_label` is the `혜택명`. It is the customer-facing title. Customer entry, booking, PC, and mobile clients must display it verbatim (falling back to `name` only when empty) and must not replace it with generated copy based on `audience`.
- `audience` is the `혜택 대상`. Its only canonical values are `all` (`전체 고객`), `first_visit` (`첫 방문 고객`), and `revisit` (`재방문 고객`). It is not customer-facing display copy.
- Legacy `audience: "custom"` values must normalize to `all`; clients must not create new `custom` audience values.
- After customer lookup, clients should use the backend `visitType` value and show only matching visit-specific coupons plus general coupons.
- `/api/customer-lookup` may return `visitType: "first_visit" | "revisit"` for lookup responses.

Coupon benefit fields:

- `discount_type: "fixed" | "percent" | "service"`
- `discount_value`: monetary amount or percentage; `0` for `service`
- `service_benefit_name`: required when `discount_type` is `service` (for example, `발바닥 보습`)
- A `service` benefit does not reduce `finalAmount`. It is included in `eligibleCoupons`, `appliedCoupons`, and the appointment discount snapshot with `serviceBenefitName`.
- Eligible `service` benefits apply alongside the server-selected monetary discount combination.

Server authority rules:

- Visit type is resolved at guardian level inside one shop. A non-cancelled, non-rejected, non-noshow appointment for any pet owned by the guardian makes the customer a `revisit` customer.
- PC and mobile must not infer visit type from local storage, the currently selected pet, or locally cached appointments.
- `POST /api/customer-benefits/quote` is the shared customer benefit quote source. Input fields are `shopId`, `guardianName`, `phone`, `serviceId`, `customerServiceOptionId`, `breed`, `weightKg`, and `appointmentDate`.
- Quote responses include `visitType`, `customerRecognized`, `customerServiceOptionId`, `originalAmount`, `discountAmount`, `finalAmount`, `eligibleCoupons`, and `appliedCoupons`.
- The backend filters coupons by enabled/visible state, appointment date, guardian visit type, selected service scope, and per-customer usage before calculating a quote.
- `first_visit` and `revisit` coupons are mutually exclusive and can never appear together in `eligibleCoupons` or `appliedCoupons`.
- `exclusive` coupons apply alone. All eligible `stackable` coupons may combine. The backend automatically chooses the valid option with the largest discount and caps the total discount at the original service amount.
- Clients display the backend quote and must not submit a self-calculated discount amount.
- `POST /api/customer-bookings` recalculates or verifies the quote before creating the appointment. Payment completion also verifies the paid amount against the server quote.

Appointment discount snapshot fields:

- `appointments.customer_visit_type`
- `appointments.discount_coupon_ids`
- `appointments.discount_coupon_names`
- `appointments.original_service_price`
- `appointments.discount_amount`
- `appointments.final_service_price`
- `appointments.discount_snapshot`

These fields are immutable booking-time snapshots for shared PC/mobile display. Mobile must consume them from the appointment/bootstrap response and must not overwrite them directly.

## Pet Pricing Group Contract

Database field:

- `pets.pricing_group`

Frontend/API field:

- `pricingGroup` in pet create/update payloads
- `pricing_group` in bootstrap and persisted pet records

Rules:

- `pets.breed` is the customer-entered breed and must not be overwritten when an owner selects a price group.
- `pets.pricing_group` is owner-confirmed operational data used to select the correct detailed price guide group for price calculation.
- Owner web may edit weight, birthday, bite level, and pricing group after checking the pet in person.
- PC and mobile must show the same stored pricing group and must not infer or overwrite it from a breed string.

## Change Rule

When PC/backend changes any contract in this document:

1. Add or update the Supabase migration first when schema changes are required.
2. Update the PC/shared API implementation in `D:\petmanager`.
3. Update this document in `D:\petmanager-shared\docs\data-contracts.md`.
4. Coordinate the matching mobile change in `D:\petmanager-app`.

## Appointment Visit Weight Contract

- `GET /api/owner/appointment-visit-weight?shopId=...&appointmentId=...` returns `current` only when that exact appointment has an explicit server-recorded measurement. `recent` is the latest earlier explicit measurement for the same shop and pet and is reference-only.
- `PUT /api/owner/appointment-visit-weight` accepts `shopId`, `appointmentId`, `weightKg`, and a UUID `idempotencyKey`. The server derives the pet, measurement time, and authenticated actor after tenant and staff-assignment checks.
- `appointment_visit_weight_measurements` is append-only request history. Raw idempotency keys are never stored; the unique key is `(shop_id, appointment_id, sha256(idempotencyKey))`.
- Pet profile `pets.weight`, fixtures, care drafts, and earlier grooming records must never be labeled as today's weight. On completion, the latest explicit current-appointment measurement is copied to `grooming_records.pet_weight_snapshot`; otherwise the snapshot remains null unless that same appointment already has a canonical snapshot.
- PC and mobile must use this API and the same `AppointmentVisitWeightResponse` field names. Saving a weight is explicit and independent from starting or completing an appointment, and it never sends a customer notification.

## Owner Account Deletion Contract

- `POST /api/owner/account-deletion` is a server-only PC/backend contract. It requires a bearer session, the current password, explicit confirmation, and a UUID idempotency key; it never accepts an owner or shop identifier from the client.
- The service-role-only deletion RPCs persist only a SHA-256 idempotency-key hash and temporary backend request state. Raw passwords, access tokens, login identifiers, IP addresses, and row JSON are forbidden in deletion request and ledger data.
- Successful terminal deletion revokes all sessions, removes non-retained personal data and media, then soft-deletes the Supabase Auth user. A success response is forbidden before the terminal Auth call succeeds.
- An active payment/refund/dispute state must block deletion. A historical payment or dispute record without an approved legal basis and retention end date also blocks deletion; clients must show a neutral recovery message and must not delete around that block.
- `data_deletion_audit` is a redacted backend event ledger. It must not store pre-delete JSON, raw identifiers, or actor identifiers.

## Signup Price Guide Security Meter Contract

Price-guide image analysis uses two separate persistence classes.

- `signup_price_guide_analysis_requests` is purgeable request state. Original image bytes, sanitized buffers, provider raw responses, encrypted result cache, file hashes, and IP/session/device binding hashes must be cleared on confirmation, cancellation, retake, manual fallback, abandonment, failure, timeout, or retention expiry.
- `signup_price_guide_security_meter_buckets` is a non-identifying abuse and cost ledger. It stores only period-scoped HMAC bucket identifiers, aggregate request counts, reserved provider cost, actual provider cost, failure counts, period boundaries, and expiry timestamps.
- Meter bucket identifiers are derived server-side with `SIGNUP_PRICE_GUIDE_METERING_SECRET`, a UTC period label, and a monthly rotation key. Raw IP, session, device, static binding hash, file hash, token JTI, image content, AI response, and customer data are forbidden in the meter table.
- Analysis purge must never delete or decrement IP/session/device request counts or actual provider cost. An unconsumed cost reservation may be released; a provider failure/timeout is conservatively charged at the reserved estimate.
- Canonical limits are 10 accepted requests per IP 10-minute bucket, 6 per signup session UTC day, 8 per device UTC day, and the configured provider UTC-day cost cap. These limits survive token replacement and analysis purge.
- Meter TTLs are period end plus 1 hour for IP/session/device/circuit buckets and UTC day end plus 35 days for provider cost audit. Cleanup deletes only expired meter rows.
- Only service-role RPCs may access either table. Both tables require RLS enabled and no `public`, `anon`, or `authenticated` table/function privileges.
- Rollback is fail-closed: it blocks while analysis is processing, purges analysis artifacts, removes v2 RPCs and meter state, and does not restore the purge-bypassable v1 claim path.

## Owner Signup Phone Trial Contract

- Owner email remains the unique account/login identifier. A normalized owner mobile phone number may belong to multiple owner accounts.
- The server canonicalizes Korean mobile numbers by removing punctuation and whitespace and converting `+82 10...`/`82 10...` to `010...` before persistence and trial evaluation.
- The 14-day owner trial is granted at most once for each normalized phone number. Existing owner profiles are treated as prior claims without changing or revoking any existing subscription or trial history.
- A later account using the same normalized phone is provisioned normally with its own auth user, shop, owner profile, membership, defaults, and subscription, but its subscription starts in `expired` state with `trial_started_at = trial_ends_at` (zero trial days).
- Trial claiming, identity-verification consumption, auth-user insertion, and owner shop/profile/membership/default/subscription provisioning are one PostgreSQL transaction. Any failure rolls back the complete signup and leaves the verification reusable until a successful retry.
- `owner_trial_phone_claims` is backend-only entitlement state. RLS is enabled and `public`, `anon`, and `authenticated` have no table access. Clients must not decide trial eligibility locally.
- CI/DI hashes remain searchable identity attributes but are not unique account constraints; email uniqueness remains enforced.



## Reservation Operating Defaults Contract

예약 운영 기준은 매장별 입력 항목이 아니라 펫매니저의 제품 공통 기본값입니다.

- 고객 예약은 승인 대기 없이 즉시 `confirmed`로 확정됩니다.
- 고객에게는 오늘부터 60일 이내의 예약 가능 날짜만 노출합니다.
- 예약 가능 시간은 15분 단위로 계산하고 기준 오프셋은 0분입니다.
- 화면 문구 `예약 가능 시간`의 시작·끝 값은 모두 예약 시작 시각의 포함 경계입니다.
- 예약 종료는 영업 마감과 정확히 같을 때 허용하며, `reservation_policy_settings.booking_close_grace_minutes`의 0/15/30/60분만큼만 마감 뒤로 연장할 수 있습니다. 기존 매장은 0분이고 15분 표시는 권장일 뿐 자동 적용하지 않습니다.
- 담당자 근무 종료가 영업 마감과 정확히 같을 때만 마감 여유를 함께 적용합니다. 조기 퇴근·휴무 담당자에게는 연장하지 않습니다.
- 같은 담당자에게 같은 시간대의 활성 예약은 1건만 허용합니다.
- 예약 생성과 일정 수정은 `staff_id`, `status`, `start_at`, `end_at`, 고객 요청 `memo`, 내부 담당자 `staff_memo`를 정본 `appointments` 행의 단일 `INSERT` 또는 `UPDATE`에 함께 저장합니다. 예약을 미지정 상태로 먼저 만든 뒤 담당자를 붙이는 다단계 쓰기는 허용하지 않습니다.
- 화면의 가능 시간 계산은 안내용 사전 검사입니다. 최종 겹침 보장은 `appointments_prevent_staff_overlap` trigger가 `public.prevent_overlapping_staff_appointments()`의 매장·담당자별 트랜잭션 직렬화를 호출해 수행하며, 생성과 수정에 동일하게 적용합니다.
- 겹침 guard 함수는 `SECURITY INVOKER`를 유지합니다. `public`, `anon`, `authenticated`에는 직접 `EXECUTE`를 노출하지 않고 서버 `service_role`만 명시적으로 허용합니다.
- AI 예약 시간 최적화는 항상 적용하며 매장별 ON/OFF 설정을 제공하지 않습니다.
- 고객 변경·취소는 알림톡의 보안 예약관리 링크에서만 가능하며 예약 시작 2시간 전까지 허용합니다.
- `approval_mode`, 과거 취소 정책 키, AI 최적화 설정 키는 구버전 호환 필드일 뿐 제품 동작을 바꾸지 않습니다.
- 재방문 알림 기본 45일은 예약 운영 기준과 분리된 알림 설정입니다.

## Owner Initial Setup Operations Gate

- The canonical readiness source is `initialSetupReadiness` derived from persisted bootstrap data for the same `shop.id`; a missing value, shop mismatch, readiness load error, or any incomplete step fails closed.
- Completion requires at least one valid enabled business-hours range, at least one persisted active staff member with saved work days and valid start/end times, and at least one active canonical detailed-price-guide option with a valid price and confirmed duration. Route visits, query strings, and browser storage are never completion evidence.
- Until readiness is complete, owner operations writes and customer booking availability/intake are blocked with `매장 준비를 먼저 완료해 주세요`. Initial setup writes for operating hours, staff, services/price guide, and customer service source overrides remain available, as do support, account, legal, logout, and account-deletion paths.
- While incomplete, `PATCH /api/settings` accepts only `shopId`, `businessHours`, `bookingAvailableStartTime`, `bookingAvailableEndTime`, `regularClosedDays`, `regularClosedCycle`, `regularClosedAnchorDate`, and `temporaryClosedDates`. It updates only those shop columns; notification, identity, reservation-policy, and other operational fields are rejected before any mutation. Completed shops retain the existing full settings contract.
- Blocked operations include appointment creation/change, owner schedule creation, public availability, customer booking creation/change/rebooking, payment completion before provider lookup, customer/pet records, staff schedule overrides, care/grooming writes, visit weight, staff notes, notifications, and data import.
- Owner push-token registration/deactivation and notification media attachment/delivery-result writes are notification operations and use the same server-side gate before mock or database work.
- Incomplete shops may create or complete media uploads and variants only for `staff_profile`, `price_guide_source`, and `feedback_screenshot`. Other media kinds are operational and return the canonical 409 before storage or metadata mutation; completion and variant routes resolve the stored asset kind authoritatively before allowing the setup-safe exception. Completed shops keep the existing media behavior.
- Public entry, booking, and shop-info pages show only the unavailable state while incomplete. A valid existing booking-management link may still read its reservation, but cancellation, change, and rebooking stay blocked.
- Completing setup never deletes or overwrites existing operational data. The gate lifts from the next authoritative bootstrap read, and completed shops retain the existing operation behavior.
## Public owner account deletion

- Canonical public path: `/account-deletion`.
- Canonical production URL: `https://www.petmanager.co.kr/account-deletion`.
- Mobile settings and public legal surfaces must link to that URL; they must not copy the deletion form or deletion logic.
- An unauthenticated visitor is sent to `/login?next=%2Faccount-deletion`. The login return-path allowlist accepts the exact deletion path and existing `/owner` routes only.
- The authenticated page calls the existing `POST /api/owner/account-deletion` contract with a bearer session, `currentPassword`, `confirmation: true`, and one UUID idempotency key per logical request.
- No email-only deletion request or account-existence lookup is exposed. The server remains authoritative for password reauthentication, billing/retention fail-closed checks, tenant-owned purge, global sign-out, and terminal Auth deletion.


## Mobile signup consent and shared dev v6 — 2026-09-18

- The mobile signup request sends termsVersion=2026-09-14 and marketingConsentVersion=2026-09-14-v1. The consent sheet renders the corresponding documents; prior-version session receipts are not accepted. Marketing consent remains optional.
- Shared signup uses complete_owner_signup_v6, wrapping existing v5/v4 provisioning in the same transaction with consent audit and optional first-signup benefit. Base eligible trial is 14 days; valid marketing opt-in adds 30 days (44 total); previously claimed identities receive no new base trial. Clients never supply entitlement decisions.
- Canonical signup-only migration: D:/petmanager/supabase/migrations/20260918025422_signup_v6_consent_prerequisites.sql. Applied only to petmanager-dev on 2026-09-18; production unmodified. Apply this exact migration independently, not the earlier broad pending billing draft.
- Consent event/grant tables are append-only and server-only with RLS. Replaying an existing consent event returns that event without restoring a subsequently withdrawn current consent state.
- The subscription snapshot CHECK accepts existing 2026-08-v1 and new 2026-09-v1 at 29000 KRW, with NULL rejected. No historical subscriptions, payment rows, billing triggers, or subscription primary keys are changed by this migration.
- Local PC and mobile target the same dev DB and share the existing auth-flow signature secret. A separate dev-only v1 trial HMAC secret was initialized after confirming zero existing alias/claim rows. This does not prove historical owner trial backfill.
- Verified: request-schema compatibility, dev v6 metadata/permissions/RLS, invalid-proof rejection through both local servers. Real KCP-to-account-completion E2E remains unverified.

## Mobile first-time initial setup (2026-09-18 local implementation)

- Signup `entry=initial_setup` opens hours immediately, then staff and service/pricing in order (no welcome or start-button screen) even when provisioning defaults already satisfy readiness. UI step progress is not an entitlement or readiness source.
- Mobile `PATCH /api/owner/initial-setup` accepts `{step: hours|staff, payload}` and forwards the required bearer through the canonical allowlisted transport. Hours targets canonical `PATCH /api/owner/initial-setup/hours`; staff targets the existing `/api/staff-members` contract.
- The canonical hours endpoint uses the existing strict `initialSetupShopSettingsSchema`, `requireOwnerShop`, `assertOwnerOrManager`, and `updateInitialSetupShopSettings`. Its write is restricted to business hours, booking time bounds, recurring closures and temporary closure dates. It never invokes full-settings policy normalization.
- Separate booking-window inputs are removed; initial setup derives the canonical booking bounds from earliest enabled opening and latest enabled closing. Regular closures have weekly, biweekly, monthly_1_3 and monthly_2_4 selectors, weekday selections and a required valid biweekly anchor. Nonweekly selected days must remain enabled for open weeks. Monthly cycles use weekday occurrence numbers, with the fifth occurrence open. The narrow endpoint preserves latest temporary closure dates and merges only cycle/anchor into existing raw reservation policy JSON, synchronizing top-level columns in the same updated_at-guarded write. Concurrent changes reject the write. Staff IDs, profiles and existing rows are preserved; only unsaved new rows can be cancelled.
- Each saved step is followed by authenticated canonical bootstrap readback. Completion requires owner/shop validation and consistent canonical readiness for all three steps. Completion then removes the entry marker and reloads the ordinary owner access/subscription gate.
- Session storage contains only an owner/shop-scoped step hint, never auth secrets or a fabricated completion flag. The hours step has an explicit temporary-save action: only business hours, derived booking bounds, recurring cycle/anchor and closed-day selections are stored under an owner/shop-scoped localStorage key for 24 hours. Partial values restore after reload; malformed/expired drafts are ignored, and confirmed server saving clears the hours draft. This draft never marks readiness complete. Other unsaved form values remain memory-only.
- Local implementation only: this contract entry does not assert deployment, actual signup-to-setup E2E, production DB changes, or device verification.

### Initial setup holiday calendar and additional recurring closures

- UI labels recurring closures as additional holidays: None (canonical weekly with empty regular_closed_days), biweekly, monthly_1_3, monthly_2_4. Existing weekly regular_closed_days are folded into disabled business-hour weekdays on initialization. Permanent weekly closures are controlled only through business-hour weekday toggles.
- Narrow hours endpoint additionally accepts optional temporaryClosedDateChanges={add:string[],remove:string[]}. Only this named field is extracted before the strict legacy hours schema. Both arrays contain unique, disjoint, real YYYY-MM-DD dates (max730 each).
- Date delta is merged onto the latest canonical temporary_closed_dates in both real and mock paths, taking precedence over preserveTemporaryClosedDates. Missing delta preserves current dates. The merged dates and hours/policy fields use the same updated_at guarded write; failed concurrency checks do not advance the wizard.
- Calendar selection stays local until explicit save. Temporary hours drafts include selected dates and their original baseline. Restore applies only the user's added/removed dates onto fresh bootstrap dates, preserving other writers' additions/deletions. Older drafts lacking a baseline cannot delete current server dates.
- Initial setup hides only the scrollbar chrome; native scrolling remains available. Recurring weekday controls use seven equal columns, 16/24 medium control typography; helper copy uses13/20 and labels14/20 medium.
- Verification: browser calendar multi-select/deselect and 390/1024/1440 layout, local tests and source review. No real DB holiday changes or deployment performed by this task.

### Unified weekday choice in initial setup

- The latest initial-setup UI has one weekday checkbox group. Unchecked days are weekly closed days when the selector is None; under monthly_1_3/monthly_2_4 they are recurring closure weekdays only for those occurrences. On serialization, monthly business_hours keeps all weekday entries enabled (with validated opening/closing times) and regular_closed_days carries the unchecked day set, so other weeks remain open. None preserves disabled business-hour days. Cycle switching does not change the checkbox selection.
- Canonical recurring closed days are folded into unchecked UI weekdays on load; temporary drafts retain this same UI meaning. Monthly unchecked-day time fields remain editable because they are needed for the open weeks. Booking bounds use the serialized business hours.
- Biweekly selection, separate recurring weekday controls, anchor input, and holiday explanatory paragraphs are removed from this initial-setup UI. Existing backend biweekly support is unchanged; legacy biweekly configuration is presented as None in this editor and only changes on explicit user save. Specific-date calendar and draft persistence remain.
- Verified local unit checks, mobile typecheck/lint, and designated Chromy window at390/1024/1440. No actual canonical server mutation or deployment executed for this UI change.

## Caller ID foundation (2026-09-21 local implementation)

- `call_integrations` stores a shop-scoped provider connection, explicit `line_type` (`landline` or `mobile`), and one-way webhook-token hash. A shop may connect separate wired and mobile business lines; the raw webhook token is returned only once by `POST /api/owner/call-integrations`; `GET` never returns it.
- `call_events` is an append-only server-ingested event ledger. It stores provider event ID, direction, event type, occurrence time, HMAC phone fingerprint, last four digits, match status, and an allowlisted metadata object. It never stores the raw caller number, recording, transcript, or unfiltered provider payload.
- `POST /api/webhooks/calls/{integrationId}` authenticates the one-time setup token, rejects oversized or malformed bodies, normalizes Korean `+82` numbers, matches only active guardians in the integration's shop, and is idempotent on `(integration_id, provider_event_id)`.
- `GET /api/owner/call-events?shopId=...` is owner/manager-only and returns only the call projection needed for an operations surface: last four digits, event status/time, match status, and matched guardian name/ID. Staff access is intentionally not included until the workflow and least-privilege review is complete.
- This foundation is provider-neutral. The KT 통화매니저 adapter, phone-line onboarding, provider payload mapping, and production secret installation remain separate provider/account/deployment work. The migration is source-only until a separately approved database apply.
