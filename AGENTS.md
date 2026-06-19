# PetManager Product Notes

## Product intent
- Build a production-ready mobile-first grooming shop SaaS MVP from the local prototypes.
- Treat `petmanager-v3.jsx` and `petmanager-landing.jsx` as the source of truth for IA, flow, and UX tone.

## Working rules
- Prioritize end-to-end completion over placeholder scaffolding.
- Keep Korean-first UX copy natural and operationally practical.
- Optimize all primary app surfaces for a max-width of 430px.
- Preserve extensibility for owner-triggered notification and owner workflows.
- Notification delivery for customer-facing appointment events is owner-action/manual only by default. Do not add background cron, scheduled auto-send, or automatic reminder dispatch unless the owner explicitly re-approves that product direction.
- Alimtalk usage is accounted per shop inside PetManager, not by separate Ssodaa accounts. Ssodaa balance is the platform pool; each shop has an internal credit balance, sends must be blocked when the shop has no remaining credits, and successful sends consume one shop credit with a ledger event. Failed provider sends must refund the reserved credit. Monthly/plan-included Alimtalk credits reset at each paid period and unused included credits do not carry over. Separately purchased paid credits must not expire or reset unless the owner explicitly requests a refund, adjustment, or policy change.

## Implementation defaults
- Frontend: Next.js App Router + TypeScript + Tailwind CSS.
- Backend: Supabase with migrations, seed data, and server-side data access.
- Validation: Zod.
- Forms: React Hook Form for substantial forms.
- Scheduling logic must enforce real booking availability based on hours, closures, service duration, and concurrent capacity.

## Owner web UI baselines
- Date navigation on owner web work surfaces should follow the schedule screen pattern: left chevron button, centered plain date text button, right chevron button.
- Do not use a bordered date chip or calendar icon for the staff weekly schedule date range. The center date text may be clickable to return to the current week.
- Keep staff weekly schedule cells compact and fixed height (`h-9`) unless the owner explicitly approves a new size.
- Owner schedule bookings must never overlap in time for the same staff member. Demo, mock, seeded, dragged, or manually created bookings must be placed only in available non-overlapping staff time windows.
- Owner schedule board visual baseline: keep the board quiet and operational. Use light neutral gray staff columns, subtle horizontal time grid lines, compact staff headers, and no saturated background panels.
- Owner schedule summary chips and tabs should use a neutral selected state: white background, thin `#dbe2ea`-family border, very light shadow, dark text. Do not use filled green pills for selected schedule summary/tabs.
- Owner schedule booking cards should be white with a soft neutral border, 8px radius, minimal or no shadow, and compact text. Avoid strong colored card backgrounds, thick borders, or heavy ring effects.
- PetManager has exactly two reusable status indicator shapes: `점 인디케이터` and `좌측 엣지 인디케이터`.
- `점 인디케이터` is a small filled dot for compact rows and badges: `h-2 w-2 rounded-full`.
- `좌측 엣지 인디케이터` is the colored left border edge used on cards, schedule items, calendar items, and staff weekly schedule cells. Implement it with the shared `pm-wrap-indicator` class on the parent card/cell. The parent keeps a neutral 1px border on all sides, but its left border becomes a 3px status-colored edge via `border-left-color` and `border-left-width`. It should look like the card's own left edge is accented and clipped by the card radius, not like a detached inner vertical line, dot, pill, bracket, gradient, or colored full-card surface.
- Locked visual/code name: `PM_STATUS_LEFT_EDGE`. This is the canonical PetManager status-card shape. Reference capture: `docs/assets/status-left-edge-indicator.png`.
- `PM_STATUS_LEFT_EDGE` required CSS contract: parent element has `position: relative`, `overflow: hidden`, `border: 1px solid #dbe2ea`, `border-left-width: 3px`, `border-left-color: var(--pm-wrap-indicator-color)`, `border-radius: 8px`, white background, and no pseudo-element/child span for the indicator. The left edge must be part of the card border itself.
- Do not alter the `PM_STATUS_LEFT_EDGE` shape without explicit owner approval. Forbidden regressions: interior vertical line, dot-only status on schedule cards, detached rail, bracket rail, pill chip, thick border, colored full-card background, gradient, heavy shadow, `border-2`, or saturated focus ring.
- Status indicator colors are fixed globally across pages and both indicator shapes: calm blue-gray `#607080` for confirmed/active work/근무/success, amber `#b98121` for pending/승인대기/연차/반차/변경/warning, burgundy `#a04455` for 휴무/취소/거절/failure, slate `#64748b` for 완료/completed, and neutral `#b9c3cf` only for unknown/inactive states.
- Reuse `src/components/owner-web/status-indicators.ts` for status indicator shape and color classes. Do not hard-code alternative indicator colors in schedule, calendar, staff, or customer screens.
- Owner schedule staff columns and staff filter options must come only from saved staff members. Do not add synthetic columns/options such as `미배정`. If exactly one staff member exists, the 담당 filter must be fixed to that staff member and must not show `전체 스태프`.
- Selected, dragged, or auto-focused schedule booking cards may use only a thin low-opacity ring or slightly darker neutral border. Never use `border-2` or saturated focus rings for ordinary schedule cards.
- Dense schedule views should remain readable by preserving vertical time placement and non-overlap first; if density increases, assign bookings to available staff/time windows rather than visually stacking overlapping cards.
- Owner schedule board current-work anchor must be the earliest-starting booking among active work statuses (`진행 중`, `픽업 준비`) whose scheduled time window contains the current time. Expired active-status bookings must not become anchors. The timeline should snap to that booking near the top when entering the board or when scrolling near it.
- Owner PC web and owner mobile web must treat appointment status as one shared source of truth through the same appointment APIs. Owner mobile status changes must sync back to PC views, and PC views must periodically refresh visible schedule data for external changes.
- Grooming start and pickup-ready status changes require an owner-captured photo before the status update. This applies equally to PC web, mobile web, demo seeds, manual API calls, and future owner surfaces.
- In the staff weekly schedule edit modal, keep "기본 근무 설정" collapsed by default. Show its weekday/time controls only after the owner clicks the dropdown header, and keep weekday work/off selection color-coded.
- Staff weekly schedule table baseline: tabs sit above the table; the active tab uses the same neutral selected style as schedule summary chips (white background, thin neutral border, light shadow), and inactive tabs are plain text with subtle hover. The date navigation stays compact in the weekly table header/toolbar area with small chevron buttons and plain date-range text. Do not move it into a large separate bordered date row.
- Staff weekly schedule columns are `스태프명` plus `월 화 수 목 금 토 일`. Staff cells show name in bold and role/service as smaller muted text underneath.
- Weekly schedule cells are white, compact, fixed-height `h-9`, rounded 8px, centered text, and use the shared left accent edge instead of colored full-cell fills. Work uses calm blue-gray `#607080`, off uses burgundy `#a04455`, annual/half/pending use amber `#b98121`. Do not use soft green/gray full-surface schedule cells for this table.
- Preserve the airy row rhythm: white table background, light row dividers, rounded 8px schedule cells, generous horizontal gaps between day cells, and no status dots inside staff weekly schedule cells.

## Database environment rule
- Operate only two database environments by default: local Supabase for development/testing, and production Supabase for the deployed service.
- Do not use or maintain a separate Supabase Dev project in the normal workflow unless the owner explicitly reintroduces it.
- Treat `supabase/migrations` as the source of truth for schema changes. Avoid manual SQL dashboard edits except for emergencies, and backfill any emergency SQL into a migration immediately.
- Local development must not point at production Supabase by default. Before any remote Supabase write, state the target project, table, shop, and date.
- Follow `docs/supabase-environment-separation.md` for details.

## File Size & Component Structure
- React UI files should generally stay under 500 lines.
- Files over 500 lines are not automatically wrong, but they must be treated as structure review candidates.
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
- Detailed rules are in `docs/engineering/file-structure-standard.md`.
