# PetManager Unified Agent Instructions

## Purpose
- This is the single canonical instruction file for the PetManager workspace.
- The same file is synced into both project roots:
  - `D:\petmanager\AGENTS.md`
  - `D:\petmanager-app\AGENTS.md`
- Determine the active project by the current working directory before making changes.

## Project Boundaries
- `D:\petmanager` is the PC/admin web project and the shared backend/API/Supabase authority.
- `D:\petmanager-app` is the mobile web and hybrid mobile app project only.
- `D:\petmanager-shared` is the shared source for env files, agent instructions, checklists, and coordination notes.

## Hard Routing Rules
- If the active workspace is `D:\petmanager-app`, work only on mobile web and hybrid mobile app surfaces.
- If the user asks for PC/admin web changes while in `D:\petmanager-app`, do not implement. Tell the user in Korean that the request belongs in `D:\petmanager`.
- If the active workspace is `D:\petmanager`, work only on PC/admin web, shared backend/API, Supabase, migrations, and shared data contracts.
- If the user asks for mobile web/app UI, native app shell, Android Studio, Capacitor, or app-only screen changes while in `D:\petmanager`, do not implement. Tell the user in Korean that the request belongs in `D:\petmanager-app`.
- Do not move PC code into `petmanager-app`.
- Do not move mobile app code into `petmanager`.
- PC and mobile must stay consistent through Supabase data, migrations, API contracts, and environment variable parity.

## Shared Folder Rules
- `D:\petmanager-shared` is the canonical source for local env and agent instruction files.
- Env source files:
  - `D:\petmanager-shared\env\petmanager.env.local` -> `D:\petmanager\.env.local`
  - `D:\petmanager-shared\env\petmanager-app.env.local` -> `D:\petmanager-app\.env.local`
- Sync env files with:
  ```powershell
  D:\petmanager-shared\sync-env.ps1
  ```
- Sync this unified AGENTS file with:
  ```powershell
  D:\petmanager-shared\sync-agents.ps1
  ```
- The project-root `.env.local` and `AGENTS.md` files must still exist because local tools read them from each project root. Treat them as synced copies from `D:\petmanager-shared`.
- Never commit real `.env.local` secrets to git.

## Product Intent
- Build a production-ready grooming shop SaaS with a PC/admin web product and a mobile-first owner/staff app experience.
- Keep Korean-first UX copy natural, practical, and operational.
- Preserve extensibility for owner workflows, notification workflows, and future app store deployment.

## Implementation Defaults
- Frontend: Next.js App Router + TypeScript + Tailwind CSS.
- Backend: Supabase with migrations, seed data, and server-side data access.
- Validation: Zod.
- Forms: React Hook Form for substantial forms.
- Scheduling logic must enforce real booking availability based on business hours, closures, service duration, staff availability, and concurrent capacity.
- Customer-visible grooming price menus must be read-only projections of the detailed price guide source. Do not create independent customer-facing price/time rows, fallback service prices, demo rows, or stale copied values. If a detailed price guide item changes, every customer-facing service menu, booking flow, and mobile/app surface must reflect the updated source item through the shared Supabase-backed data contract.
- Service menu exposure settings may store only presentation concerns such as order, visibility, and source linkage. Price, duration, species, breed group, and service item values must always come from the detailed price guide source row.

## Mobile Web/App Rules (`D:\petmanager-app`)
- This project is strictly for mobile web and the hybrid mobile app.
- Optimize primary app surfaces for a max-width of 430px.
- Mobile app pages must stay clean, simple, white-based, and app-like.
- Owner and staff can use the same app, but the layout must adapt by login role.
- Owner mode may show all staff filters and shop-level controls.
- Staff mode should show only that staff member's relevant reservations unless explicitly approved otherwise.
- Do not add PC/admin desktop surfaces here.
- Do not reintroduce old demo/mobile flows after they have been removed from the active product path.
- Mobile app data should come from the shared Supabase-backed backend and remain consistent with PC.
- Camera/photo flows are mobile-critical. Do not remove or bypass required grooming photo capture unless explicitly requested.

## PC/Admin Web Rules (`D:\petmanager`)
- This project is strictly for PC/admin web, shared backend/API, Supabase, migrations, and shared data contracts.
- Owner schedule bookings must never overlap for the same staff member.
- Schedule boards should stay quiet and operational: white/neutral cards, light grid lines, compact staff headers, and no saturated full-card backgrounds.
- Date navigation on owner web work surfaces should use the schedule pattern: left chevron, centered plain date text, right chevron.
- Staff weekly schedule cells should remain compact and fixed height (`h-9`) unless explicitly approved otherwise.
- Staff weekly schedule edit modal: keep `�⺻ �ٹ� ����` collapsed by default. Show weekday/time controls only after the owner opens the dropdown header.
- Staff weekly schedule columns are `��������` plus weekday columns (`��`, `ȭ`, `��`, `��`, `��`, `��`, `��`). Staff cells show name in bold and role/service as smaller muted text underneath.

## Status Indicator Rules
- PetManager has exactly two reusable status indicator shapes:
  - `���� ��`: a small filled dot for compact rows and badges, usually `h-2 w-2 rounded-full`.
  - `���� ���� �ε�������`: a colored left border edge used on cards, schedule items, calendar items, and staff weekly schedule cells.
- The canonical card indicator is `PM_STATUS_LEFT_EDGE`.
- `PM_STATUS_LEFT_EDGE` CSS contract:
  - parent element has `position: relative`
  - `overflow: hidden`
  - neutral `1px` border on all sides
  - `border-left-width: 3px`
  - `border-left-color: var(--pm-wrap-indicator-color)`
  - `border-radius: 8px`
  - white background
  - no pseudo-element or child span for the indicator
- Do not alter `PM_STATUS_LEFT_EDGE` without explicit owner approval.
- Forbidden regressions: interior vertical line, detached rail, bracket rail, pill chip, thick border, colored full-card background, gradient, heavy shadow, `border-2`, saturated focus ring, or dot-only status on schedule cards.
- Fixed status colors:
  - calm blue-gray `#607080`: confirmed, active work, �ٹ�, success
  - amber `#b98121`: pending, ���δ��, ����, ����, ����, warning
  - burgundy `#a04455`: �޹�, ���, ����, failure
  - slate `#64748b`: �Ϸ�, completed
  - neutral `#b9c3cf`: unknown or inactive only
- In PC/admin web, reuse `src/components/owner-web/status-indicators.ts` for status indicator shapes and colors. Do not hard-code alternative indicator colors in schedule, calendar, staff, or customer screens.

## Appointment Status And Photo Rules
- Owner PC web and owner mobile web must treat appointment status as one shared source of truth through the same appointment APIs.
- Mobile status changes must sync back to PC views.
- PC views must periodically refresh visible schedule data for external changes.
- Grooming start and pickup-ready status changes require an owner/staff-captured photo before the status update.
- This applies to PC web, mobile web, demo seeds, manual API calls, and future owner/staff surfaces unless the owner explicitly changes the product rule.
- The schedule board current-work anchor must be the earliest-starting active booking whose scheduled time window contains the current time.
- Active work statuses include `���� ��` and `�Ⱦ� �غ�`.
- Expired active-status bookings must not become anchors.

## Staff And Schedule Data Rules
- Owner schedule staff columns and staff filter options must come only from saved staff members.
- Do not add synthetic columns/options such as `�̹���` unless explicitly requested for that specific surface.
- If exactly one staff member exists, the ��� filter should be fixed to that staff member and should not show `��ü ������`.
- Dense schedule views should preserve vertical time placement and non-overlap first.
- If density increases, assign bookings to available staff/time windows rather than visually stacking overlapping cards.

## Notification And Alimtalk Rules
- Customer-facing appointment notifications are owner-action/manual by default.
- Do not add background cron, scheduled auto-send, or automatic reminder dispatch unless the owner explicitly approves that product direction.
- Alimtalk usage is accounted per shop inside PetManager, not by separate Ssodaa accounts.
- Ssodaa balance is the platform pool.
- Each shop has an internal credit balance.
- Sends must be blocked when the shop has no remaining credits.
- Successful sends consume one shop credit with a ledger event.
- Failed provider sends must refund the reserved credit.
- Monthly/plan-included Alimtalk credits reset at each paid period and unused included credits do not carry over.
- Separately purchased paid credits must not expire or reset unless the owner explicitly requests a refund, adjustment, or policy change.
- Alimtalk relay/template environment values must stay identical between local development and Vercel production by default.
- When a Ssodaa template code is approved or changed, update local env source files and Vercel Production environment variables in the same work session, then run the relevant Alimtalk environment check.`r`n- After any Alimtalk env change in `D:\petmanager`, run `npm run sync:alimtalk-relay-env`, restart the local relay process, and verify relay diagnostics before claiming local Alimtalk verification is complete.
- Ssodaa templates must be created, edited, and submitted for review directly in Ssodaa unless the owner explicitly asks PetManager to register them.
- PetManager admin Alimtalk screens are for checking/connecting approved template codes, comparing bodies/buttons, testing sends, and diagnosing relay status. Do not reintroduce an in-app template registration workflow without explicit owner approval.
- Never claim an Alimtalk template change is complete just because code was edited. A complete template change requires all of the following in the same work session: approved Ssodaa template code, shared env source update, env sync, local server/relay restart or production redeploy, Alimtalk env consistency check, and relay/template diagnostics passing.
- Do not rely on template aliases such as `grooming_completed` as real Ssodaa template codes. If the approved template code is missing, block/queue the send and report the missing mapping instead of falling back to an old alias/template.
- For local Alimtalk verification, ensure both the Next.js server and `backend/alimtalk-relay` are running. If relay diagnostics fail, say that Ssodaa body/status verification is unavailable and do not state that the latest template is verified.

## Database Environment Rules
- Operate only two database environments by default: local Supabase for development/testing and production Supabase for deployed service.
- Do not use or maintain a separate Supabase Dev project unless the owner explicitly reintroduces it.
- Treat `supabase/migrations` as the source of truth for schema changes.
- Avoid manual SQL dashboard edits except for emergencies.
- Backfill any emergency SQL into a migration immediately.
- Local development must not point at production Supabase by default.
- Before any remote Supabase write, state the target project, table, shop, and date.

## File Size And Component Structure
- React UI files should generally stay under 500 lines.
- Files over 500 lines are structure review candidates.
- Files over 800 lines require a split/refactor plan before UI changes.
- Do not split large files blindly by line count.
- Split only by clear responsibility:
  - page shell
  - toolbar
  - list
  - list item/card
  - detail panel
  - form
  - modal/bottom sheet
  - status badge
  - presentational component
- Prefer extracting presentational components first.
- When extracting components, do not change API calls, state logic, validation, routing, billing, auth, notification, or data models.
- If splitting or UI changes may affect behavior, stop and report it as deferred.
- Detailed rules live in `docs/engineering/file-structure-standard.md` when present.
