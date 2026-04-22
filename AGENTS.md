# PawCare Product Notes

## Product intent
- Build a production-ready mobile-first grooming shop SaaS MVP from the local prototypes.
- Treat `pawcare-v3.jsx` and `pawcare-landing.jsx` as the source of truth for IA, flow, and UX tone.

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
