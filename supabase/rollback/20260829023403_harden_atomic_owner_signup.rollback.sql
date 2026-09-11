-- PM_ATOMIC_SIGNUP_R1 / A-5-ROLLBACK-READINESS.
-- This removes only the v5 RPC surface. Completed signup data and the v4
-- fallback implementation are intentionally preserved. The application then
-- fails closed with 503 until v5 is applied again.

begin;

do $$
declare
  v_unexpected_objects text;
begin
  if exists (
    select 1
      from public.signup_idempotency_requests
     where status in ('claimed', 'auth_created')
  ) then
    raise exception 'PM_SIGNUP_V5_ROLLBACK_BLOCKED_ACTIVE_REQUESTS';
  end if;

  select string_agg(format('%s:%s', c.relkind, c.relname), ', ' order by c.relkind, c.relname)
    into v_unexpected_objects
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'pm_signup_private';
  if v_unexpected_objects is not null then
    raise exception 'PM_SIGNUP_V5_ROLLBACK_BLOCKED_UNEXPECTED_SCHEMA_OBJECTS:%', v_unexpected_objects;
  end if;

  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'pm_signup_private'
       and p.proname not in (
         'claim_owner_signup_v5',
         'mark_owner_signup_auth_created_v5',
         'complete_owner_signup_v5'
       )
  ) then
    raise exception 'PM_SIGNUP_V5_ROLLBACK_BLOCKED_UNEXPECTED_FUNCTIONS';
  end if;

  if exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'pm_signup_private'
  ) then
    raise exception 'PM_SIGNUP_V5_ROLLBACK_BLOCKED_UNEXPECTED_TYPES';
  end if;
end;
$$;

revoke all on function public.claim_owner_signup_v5(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_owner_signup_auth_created_v5(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;

drop function if exists public.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text);
drop function if exists public.mark_owner_signup_auth_created_v5(uuid, text, uuid);
drop function if exists public.claim_owner_signup_v5(uuid, text);

revoke all on function pm_signup_private.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function pm_signup_private.mark_owner_signup_auth_created_v5(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function pm_signup_private.claim_owner_signup_v5(uuid, text)
  from public, anon, authenticated, service_role;

drop function if exists pm_signup_private.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text);
drop function if exists pm_signup_private.mark_owner_signup_auth_created_v5(uuid, text, uuid);
drop function if exists pm_signup_private.claim_owner_signup_v5(uuid, text);
drop schema if exists pm_signup_private;

notify pgrst, 'reload schema';

commit;
