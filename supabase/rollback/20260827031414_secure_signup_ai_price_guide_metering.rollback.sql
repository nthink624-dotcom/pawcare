-- Development/Test rollback only.
-- Fail closed: the price-guide analysis API remains unavailable after rollback
-- until a reviewed metering migration is applied again.

do $$
begin
  if exists (
    select 1 from public.signup_price_guide_analysis_requests
     where status = 'processing'
  ) then
    raise exception 'PM_PRICE_GUIDE_METER_ROLLBACK_BLOCKED_ACTIVE_ANALYSIS';
  end if;
end;
$$;

revoke all on function public.claim_signup_price_guide_analysis_v2(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.complete_signup_price_guide_analysis_v2(uuid, integer, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.purge_signup_price_guide_analysis_v2(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.cleanup_signup_price_guide_analysis_v2(integer) from public, anon, authenticated, service_role;
revoke all on function public.cleanup_signup_price_guide_security_meter_v1(integer) from public, anon, authenticated, service_role;

-- Purge every remaining analysis artifact before removing the non-identifying
-- meter. This rollback intentionally removes token traces and leaves no v1 gate.
update public.signup_price_guide_analysis_requests
   set status = 'tombstoned',
       ip_hash = null,
       session_hash = null,
       device_hash = null,
       file_hash = null,
       cache_source_jti = null,
       cache_ciphertext = null,
       cache_expires_at = null,
       estimated_cost_microusd = 0,
       actual_cost_microusd = null,
       meter_rotation_id = null,
       provider_meter_bucket_hmac = null,
       provider_meter_bucket_start = null,
       circuit_meter_bucket_hmac = null,
       circuit_meter_bucket_start = null,
       purge_requested_at = clock_timestamp(),
       purged_at = clock_timestamp(),
       purge_reason = 'rollback',
       cleanup_after = clock_timestamp(),
       cleanup_attempts = cleanup_attempts + 1,
       cleanup_last_error = null;

delete from public.signup_price_guide_analysis_requests;

drop function if exists public.claim_signup_price_guide_analysis_v2(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer);
drop function if exists public.complete_signup_price_guide_analysis_v2(uuid, integer, text, timestamptz);
drop function if exists public.cleanup_signup_price_guide_analysis_v2(integer);
drop function if exists public.purge_signup_price_guide_analysis_v2(uuid, text, text);
drop function if exists public.cleanup_signup_price_guide_security_meter_v1(integer);

alter table public.signup_price_guide_analysis_requests
  drop column if exists meter_rotation_id,
  drop column if exists provider_meter_bucket_hmac,
  drop column if exists provider_meter_bucket_start,
  drop column if exists circuit_meter_bucket_hmac,
  drop column if exists circuit_meter_bucket_start;

revoke all on table public.signup_price_guide_security_meter_buckets from public, anon, authenticated, service_role;
drop table if exists public.signup_price_guide_security_meter_buckets;

notify pgrst, 'reload schema';
