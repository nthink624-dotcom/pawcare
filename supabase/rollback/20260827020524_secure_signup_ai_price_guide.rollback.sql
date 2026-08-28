-- Development/Test rollback only.
-- Preconditions: no owner signup may remain in claimed/auth_created state.

do $$
begin
  if exists (
    select 1 from public.signup_idempotency_requests
     where status in ('claimed', 'auth_created')
  ) then
    raise exception 'PM_SIGNUP_ROLLBACK_BLOCKED_ACTIVE_REQUESTS';
  end if;
end;
$$;

revoke all on function public.purge_signup_price_guide_analysis_v1(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.cleanup_signup_price_guide_analysis_v1(integer) from public, anon, authenticated, service_role;
revoke all on function public.claim_signup_price_guide_analysis_v1(uuid, text, text, text, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.complete_owner_signup_v2(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, integer, timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.mark_owner_signup_auth_created_v2(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_owner_signup_v2(uuid, text) from public, anon, authenticated, service_role;

drop function if exists public.purge_signup_price_guide_analysis_v1(uuid, text, text);
drop function if exists public.cleanup_signup_price_guide_analysis_v1(integer);
drop function if exists public.claim_signup_price_guide_analysis_v1(uuid, text, text, text, text, integer, integer);

-- This removes encrypted cache rows, hash/rate state, token traces, tombstones,
-- and their RLS/grant surface in one transaction with the rest of this script.
drop table if exists public.signup_price_guide_analysis_requests;

drop function if exists public.complete_owner_signup_v2(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, integer, timestamptz, timestamptz);
drop function if exists public.mark_owner_signup_auth_created_v2(uuid, text, uuid);
drop function if exists public.claim_owner_signup_v2(uuid, text);

alter table public.signup_idempotency_requests
  drop constraint if exists signup_idempotency_requests_status_check;

alter table public.signup_idempotency_requests
  add constraint signup_idempotency_requests_status_check
  check (status in ('processing', 'completed', 'compensation_pending', 'failed_compensated'));

notify pgrst, 'reload schema';
