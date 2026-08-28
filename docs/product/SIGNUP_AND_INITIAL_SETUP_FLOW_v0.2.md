# SIGNUP_AND_INITIAL_SETUP_FLOW v0.2

> Superseded by `SIGNUP_AND_INITIAL_SETUP_FLOW v0.3`. The owner moved service pricing before personal/account information on 2026-08-27.

Status: local/development review draft  
Owner decision date: 2026-08-27  
Scope: PC signup, shared backend contract, PC/mobile initial-setup UX specification  
Excluded: Production deployment, database migration, real owner data changes, external execution

## 1. Final product rule

- The owner registers service pricing exactly once during signup.
- The post-signup guide never asks for service pricing again.
- Signup prioritizes a price-guide photo. If the owner has no photo or extraction is unavailable, the same step provides a minimal manual-entry path.
- AI output is always a draft. Nothing is written to the canonical price guide until the owner reviews and confirms it.
- No signup-only service table, onboarding copy, or customer-facing copied price rows may be created.
- After signup, the initial setup guide contains only:
  1. business hours and closed days;
  2. staff and work schedules.

## 2. Exact signup placement

The price step is the final signup step, after shop information and after the account/shop have been created successfully.

1. Terms agreement
2. Account information and identity verification
3. Shop information
4. **Service and detailed pricing**
5. Owner home

The account/shop creation happens before step 4 because photo upload and extraction require an authenticated owner, a durable `shopId`, and private media ownership checks. The owner still experiences step 4 as part of signup: the first owner work screen is not opened until the price step is confirmed or the manual path is completed.

If initial sign-in cannot create a session, login must preserve a return path to the service-pricing step. It must not silently skip to the schedule.

## 3. Photo-first flow

```text
Select 1–5 price-guide images
  → upload private source media (`price_guide_source`)
  → request AI extraction
  → show editable draft next to source image
  → owner checks service name, price, duration, breeds, and weight bands
  → explicit confirmation
  → save to canonical `services.price_guide`
  → continue to owner home
```

Rules:

- Accepted source files: JPEG, PNG, WebP; up to 5 images; 20 MB each.
- Source images remain private owner assets.
- Unreadable values stay blank and are marked as requiring confirmation.
- The model must not invent prices, durations, breeds, species, or weight ranges.
- Extraction failure and missing-key states are errors, not success states.
- On failure, preserve uploaded source images and expose `직접 입력하기` immediately.
- The owner must be able to switch between photo and manual entry without creating another service record.

## 4. Minimal manual entry

When there is no photo or extraction is blocked, require only enough data to create a usable canonical entry:

- service name;
- base price;
- expected duration;
- breed or species scope, if applicable;
- weight band, if applicable.

The owner can add detailed rows later in service management. Signup does not require exhaustive formatting.

## 5. Canonical data mapping and duplicate removal

| Signup/AI field | Canonical destination | Rule |
| --- | --- | --- |
| shop/account identity | `owner_profiles`, `shops`, owner-shop membership | existing signup transaction |
| uploaded source images | private `media_assets` with `usage_type=price_guide_source` | durable source only; not a price copy |
| service name | canonical `services.name` and/or `price_guide.sections[].items[].label` | owner-confirmed value only |
| base price | canonical `services.price` and detailed cell `price` | no independent onboarding price |
| expected time | canonical `services.duration_minutes` and detailed cell `durationMinutes` | owner-confirmed value only |
| breed/species | `services.price_guide.sections[].species/note` | no copied customer menu field |
| weight band | `services.price_guide.sections[].weightBands` and item cells | canonical detailed guide only |
| customer booking menu | read-only projection from canonical service/detail-guide rows | exposure settings store visibility/order/source links only |

The current system seeds seven placeholder services and one default detailed price guide during account creation. That placeholder behavior conflicts with the one-time signup import if it is treated as real owner data. The production integration must replace or reconcile those placeholders in place after owner confirmation; it must not append a second imported collection.

No database migration is required for v0.2 because the existing `services.price_guide` JSON structure and private media assets can carry the approved data.

## 6. Post-signup two-step guide

### Step 1 — 영업시간·휴무일

- Show prepared default business hours.
- Primary action: `이대로 사용`.
- Secondary action: `시간 수정`.
- The owner changes only days or hours that differ from the shop.

### Step 2 — 직원·근무표

- Show the owner as the prepared first staff member.
- Primary action: `이대로 사용`.
- Secondary action: `직원·근무표 수정`.
- Additional staff and different schedules are optional corrections.

Removed from this guide:

- shop information;
- service/detailed pricing;
- booking-operation standards;
- customer booking page;
- notification checks and test booking.

PC and mobile must use the same two-step order and shared server data. Mobile UI implementation belongs to `D:\petmanager-app`; this PC task provides only the mobile visual/contract specification.

## 7. Current implementation audit

| Area | State | Detail |
| --- | --- | --- |
| Authenticated source photo upload | Implemented | private `price_guide_source` media assets |
| AI extraction API and editable guide response | Implemented | OpenAI vision-based extraction; preview only |
| Explicit owner confirmation before canonical save | Implemented in service-management onboarding | `onApply` saves only after confirmation |
| Failure surfaced to owner | Implemented | request errors are displayed; manual mode exists |
| Direct-entry fallback | Implemented in service-management onboarding | detailed guide remains editable |
| Signup step 4 routing and completion gate | **Not implemented** | current signup redirects directly to `/owner` |
| Canonical reconciliation of seeded placeholders | **Not implemented** | must replace/reconcile, never append duplicate imported data |
| Post-signup 2-step guide | Implemented locally in v0.2 | guide version 4: hours, staff only |
| PC/mobile v0.2 preview | Implemented locally | `/dev/signup-and-initial-setup-preview` |
| Local image AI execution | **Key-blocked** | local has `DEEPSEEK_API_KEY`; current image parser requires `OPENAI_API_KEY` |
| Production | Not touched | prohibited in this review scope |

## 8. Key-blocked behavior

DeepSeek text credentials do not make the existing image parser available. The current parser uses a vision-capable OpenAI model. Until an approved vision key/provider is connected:

- the UI must say photo analysis is unavailable;
- it must not show fabricated extracted rows;
- it must offer direct entry using the same canonical save destination;
- local/development preview may demonstrate layout with clearly labelled sample data only.

## 9. Review URLs

- Combined signup + setup preview: `/dev/signup-and-initial-setup-preview`
- Actual two-step setup guide preview: `/dev/initial-setup-guide-preview`

## 10. Acceptance checklist

- [ ] The signup sequence visibly ends with service/detailed pricing.
- [ ] A shop cannot create an onboarding-only service copy.
- [ ] AI results remain drafts until explicit confirmation.
- [ ] Missing keys and extraction failures never appear as success.
- [ ] Direct entry reaches the same canonical destination.
- [x] The post-signup guide contains only hours and staff.
- [x] The PC and mobile preview use the same two-step order.
- [ ] Signup completion gate and seeded-placeholder reconciliation are implemented after operations review.
