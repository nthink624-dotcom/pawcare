# Supabase Auth Environment Cleanup Checklist

## Environment checks

1. Confirm local development uses `petmanager-dev` (`qefxdtmdtvnzgupmjlom`).
2. Confirm Vercel Production uses `petmanager` (`ysxykikqnneuhypybjry`).
3. In Vercel Production, verify `NEXT_PUBLIC_SUPABASE_URL`, the publishable/anon key, and `SUPABASE_SERVICE_ROLE_KEY` all belong to the Production project.
4. Set `NEXT_PUBLIC_SUPABASE_ENV_NAME=production`, `SUPABASE_ENV_NAME=production`, and `NEXT_PUBLIC_SITE_URL=https://www.petmanager.co.kr` for Production.
5. Run `npm run check:supabase-env` before debugging an authentication issue. It masks secret values.

## Owner email rule

Owners sign in with their real email address. `auth.users.email` is canonical and `owner_profiles.login_id` is a legacy column that stores the identical normalized email.

- Do not create, accept, or diagnose an owner login ID.
- Do not create or support `@owner.petmanager.local` or `@owner.pawcare.local` aliases.
- When an owner cannot sign in, first verify the submitted email, password, and the Supabase project. Passwords are project-scoped: a Development reset cannot change a Production account.
- If a profile exists but its `login_id` differs from `auth.users.email`, repair it only through an approved migration or scoped maintenance action; do not reintroduce a username mapping as a workaround.

## Operational safety

- Never print or commit secret environment values.
- Before any remote Supabase write, state the target project, table, shop, date, and write action.
- Do not copy local passwords to Production or assume they work there.
