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
