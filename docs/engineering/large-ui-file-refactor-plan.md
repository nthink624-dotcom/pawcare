# Large UI File Refactor Plan

This plan exists before further UI edits to files over the project threshold in `docs/engineering/file-structure-standard.md`.

## src/components/owner/owner-app.tsx
- Line count: about 3900 lines
- Current responsibility: owner home shell, appointment lists, modal routing, appointment detail/editing, customer/pet detail surfaces, shop profile editing, stats, and several presentational card variants
- Risk reason: UI, state transitions, API mutations, notification actions, local animation state, and modal composition are mixed in one file
- Suggested split candidates: modal router, appointment detail sheet, today reservation sections, customer/pet detail cards, shop profile form, stat detail sheet, repeated appointment cards
- Functional risk: High
- Safe to split now: No
- Deferred reason: current pass is fixing build/lint/runtime failures; broad extraction could change owner workflow behavior

## src/components/owner/owner-settings-panel.tsx
- Line count: about 1650 lines
- Current responsibility: shop settings, business hours, booking policy, customer page preview/settings, notifications, services, and image/settings form state
- Risk reason: operational settings and preview UI are tightly coupled
- Suggested split candidates: business hours editor, booking policy section, notification settings section, service menu editor, customer page preview, customer page settings form
- Functional risk: High
- Safe to split now: No
- Deferred reason: settings changes affect booking availability, notification defaults, and customer page data

## src/components/auth/signup-form.tsx
- Line count: about 1490 lines
- Current responsibility: signup flow, identity checks, terms, social completion paths, validation, and UI
- Risk reason: auth and validation behavior are intertwined with rendering
- Suggested split candidates: identity verification step, credentials step, terms step, social provider helper UI, shared field groups
- Functional risk: High
- Safe to split now: No
- Deferred reason: auth and billing onboarding behavior should be split in a dedicated pass with regression checks

## src/components/customer/customer-booking-page.tsx
- Line count: about 980 lines
- Current responsibility: customer booking flow state, service selection, pet/guardian forms, slot selection, confirmation, and submission
- Risk reason: booking availability UX and mutation flow are coupled
- Suggested split candidates: service selector, guardian/pet form, slot picker, confirmation summary, submit status
- Functional risk: Medium
- Safe to split now: No
- Deferred reason: booking flow needs dedicated interaction regression after extraction

## src/components/admin/owner-admin-screen.tsx
- Line count: about 940 lines
- Current responsibility: admin owner search/list/detail/actions/billing controls
- Risk reason: admin billing/status actions live beside dense UI tables
- Suggested split candidates: owner list, owner detail panel, billing action panel, status badge, filters toolbar
- Functional risk: Medium
- Safe to split now: No
- Deferred reason: admin action safety should be covered by focused tests before extraction
