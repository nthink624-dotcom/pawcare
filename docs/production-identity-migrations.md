# Production Owner Identity Verification Migration

## Policy

Owner account recovery is email-based. The identity-verification purposes are exactly:

```text
signup
reset-password
find-email
```

`find-login-id` is retired and must not be added to a new migration, API, mobile screen, or database constraint.

## Schema source of truth

The repository migration `supabase/migrations/20260804160718_owner_email_auth.sql` performs the purpose rename and constraint update. Apply repository migrations to Development first and Production second; do not treat this document as permission to make an ad-hoc production SQL change.

If an emergency repair is explicitly approved, the equivalent SQL is:

```sql
update owner_identity_verifications
set purpose = 'find-email', updated_at = now()
where purpose = 'find-login-id';

alter table owner_identity_verifications
  drop constraint if exists owner_identity_verifications_purpose_check;

alter table owner_identity_verifications
  add constraint owner_identity_verifications_purpose_check
  check (purpose in ('signup', 'reset-password', 'find-email'));
```

## Environment requirements

PC and mobile must use the same production URL, Supabase project, and PortOne identity settings. Required production markers include:

```env
NEXT_PUBLIC_SUPABASE_ENV_NAME=production
SUPABASE_ENV_NAME=production
NEXT_PUBLIC_PORTONE_STORE_ID=...
NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY=...
PORTONE_API_SECRET=...
AUTH_FLOW_SECRET=...
```

Phone identity verification confirms the account holder for signup, email lookup, and password reset. It does not confirm ownership of an email inbox.
