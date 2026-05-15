# PetManager Product Notes

## Product intent
- Build a production-ready mobile-first grooming shop SaaS MVP from the local prototypes.
- Treat `petmanager-v3.jsx` and `petmanager-landing.jsx` as the source of truth for IA, flow, and UX tone.

## Working rules
- Prioritize end-to-end completion over placeholder scaffolding.
- Keep Korean-first UX copy natural and operationally practical.
- Optimize all primary app surfaces for a max-width of 430px.
- Preserve extensibility for future notification automations and owner workflows.

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
- Owner schedule booking status is indicated by a small dot inside the card next to the booking text. Do not color the full card surface for status. Use restrained dot colors: green/teal for confirmed or active work, amber for pending, slate for completed, and muted neutral tones for inactive states.
- Selected, dragged, or auto-focused schedule booking cards may use only a thin low-opacity ring or slightly darker neutral border. Never use `border-2` or saturated focus rings for ordinary schedule cards.
- Dense schedule views should remain readable by preserving vertical time placement and non-overlap first; if density increases, assign bookings to available staff/time windows rather than visually stacking overlapping cards.
- Owner schedule board current-work anchor must be the earliest-starting booking among active work statuses (`진행 중`, `픽업 준비`) whose scheduled time window contains the current time. Expired active-status bookings must not become anchors. The timeline should snap to that booking near the top when entering the board or when scrolling near it.
- In the staff weekly schedule edit modal, keep "기본 근무 설정" collapsed by default. Show its weekday/time controls only after the owner clicks the dropdown header, and keep weekday work/off selection color-coded.
- Staff weekly schedule table baseline: tabs sit above the table; the active tab uses the same neutral selected style as schedule summary chips (white background, thin neutral border, light shadow), and inactive tabs are plain text with subtle hover. The date navigation sits in its own bordered surface row below the tabs.
- Staff weekly schedule columns are `스태프명` plus `월 화 수 목 금 토 일`. Staff cells show name in bold and role/service as smaller muted text underneath.
- Weekly schedule work cells use soft green fill with green border/text and show the time range centered. Off cells use soft gray fill with gray-blue border/text and show `휴무` centered.
- Preserve the airy row rhythm: white table background, light row dividers, rounded 8px schedule cells, generous horizontal gaps between day cells.

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
