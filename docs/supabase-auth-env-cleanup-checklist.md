# Supabase Auth Environment Cleanup Checklist

## What the owner should confirm

1. Identify the local/development Supabase project.
   - Supabase Dashboard > Project Settings > General > Reference ID.
   - Write down only the project ref, not the secret keys.

2. Identify the production Supabase project.
   - Supabase Dashboard > Project Settings > General > Reference ID.
   - This must be the project used by `https://www.petmanager.co.kr`.

3. Confirm the production Vercel environment variables.
   - Vercel Project > Settings > Environment Variables.
   - Check the `Production` target.
   - These values must all belong to the same production Supabase project:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`, if present
     - `SUPABASE_SERVICE_ROLE_KEY`
   - Set these environment markers:
     - `NEXT_PUBLIC_SUPABASE_ENV_NAME=production`
     - `SUPABASE_ENV_NAME=production`
     - `NEXT_PUBLIC_SITE_URL=https://www.petmanager.co.kr`

4. Redeploy production after saving Vercel env values.
   - Vercel Project > Deployments.
   - Redeploy the latest `master` deployment.

5. If production login still returns `401`, reset the password in the production Supabase project.
   - Local password resets do not change production Supabase Auth.
   - Production password resets do not change local Supabase Auth.

## What Codex should maintain

1. Keep `docs/supabase-environment-separation.md` as the source rule.
2. Run `npm run check:supabase-env` before auth/session debugging.
3. Do not print or commit secret env values.
4. Do not edit production Supabase data without stating the target project, table, shop, and write action first.

## Current local finding

The current local workspace has evidence of mixed Supabase refs in local env files. This must be cleaned manually with the correct project values:

- Root `.env.local` currently combines more than one Supabase project ref.
- `backend/.env` also needs ref verification.

Do not copy local auth passwords to production and assume they work. Auth credentials are scoped to each Supabase project.
