-- Development/Test P0 only. Production application requires a separate reviewed release approval.
-- v0.3 separates purgeable analysis data from non-identifying security metering.

create table if not exists public.signup_price_guide_security_meter_buckets (
  bucket_kind text not null check (bucket_kind in ('ip_10m', 'session_day', 'device_day', 'provider_day', 'provider_circuit_5m')),
  rotation_id text not null check (rotation_id ~ '^[0-9]{4}-[0-9]{2}$'),
  bucket_start timestamptz not null,
  bucket_end timestamptz not null,
  bucket_hmac text not null check (length(bucket_hmac) = 64),
  request_count integer not null default 0 check (request_count >= 0),
  reserved_cost_microusd bigint not null default 0 check (reserved_cost_microusd >= 0),
  actual_cost_microusd bigint not null default 0 check (actual_cost_microusd >= 0),
  provider_failure_count integer not null default 0 check (provider_failure_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket_kind, bucket_start, bucket_hmac),
  check (bucket_end > bucket_start),
  check (expires_at >= bucket_end)
);

create index if not exists signup_price_guide_meter_expiry_idx
  on public.signup_price_guide_security_meter_buckets(expires_at);

alter table public.signup_price_guide_security_meter_buckets enable row level security;
revoke all on table public.signup_price_guide_security_meter_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.signup_price_guide_security_meter_buckets to service_role;

alter table public.signup_price_guide_analysis_requests
  add column if not exists meter_rotation_id text,
  add column if not exists provider_meter_bucket_hmac text,
  add column if not exists provider_meter_bucket_start timestamptz,
  add column if not exists circuit_meter_bucket_hmac text,
  add column if not exists circuit_meter_bucket_start timestamptz;

create or replace function public.cleanup_signup_price_guide_security_meter_v1(
  p_batch_size integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 10000 then
    raise exception 'PM_PRICE_GUIDE_METER_CLEANUP_BATCH_INVALID';
  end if;

  with doomed as (
    select bucket_kind, bucket_start, bucket_hmac
      from public.signup_price_guide_security_meter_buckets
     where expires_at <= clock_timestamp()
     order by expires_at
     for update skip locked
     limit p_batch_size
  )
  delete from public.signup_price_guide_security_meter_buckets as meters
   using doomed
   where meters.bucket_kind = doomed.bucket_kind
     and meters.bucket_start = doomed.bucket_start
     and meters.bucket_hmac = doomed.bucket_hmac;
  get diagnostics v_deleted = row_count;
  return v_deleted;
exception
  when others then
    raise exception 'PM_PRICE_GUIDE_METER_CLEANUP_FAILED';
end;
$$;

create or replace function public.claim_signup_price_guide_analysis_v2(
  p_token_jti uuid,
  p_ip_hash text,
  p_session_hash text,
  p_device_hash text,
  p_file_hash text,
  p_rotation_id text,
  p_ip_bucket_hmac text,
  p_session_bucket_hmac text,
  p_device_bucket_hmac text,
  p_provider_bucket_hmac text,
  p_circuit_bucket_hmac text,
  p_estimated_cost_microusd integer,
  p_daily_cost_cap_microusd integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_ip_start timestamptz;
  v_ip_end timestamptz;
  v_circuit_start timestamptz;
  v_circuit_end timestamptz;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_cache_jti uuid;
  v_reserved_cost integer;
  v_ip_count integer;
  v_session_count integer;
  v_device_count integer;
  v_daily_cost bigint;
  v_failure_count integer;
  v_lock_key text;
begin
  v_ip_start := date_bin(interval '10 minutes', v_now, timestamptz '2001-01-01 00:00:00+00');
  v_ip_end := v_ip_start + interval '10 minutes';
  v_circuit_start := date_bin(interval '5 minutes', v_now, timestamptz '2001-01-01 00:00:00+00');
  v_circuit_end := v_circuit_start + interval '5 minutes';
  v_day_start := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_day_end := v_day_start + interval '1 day';

  if p_token_jti is null
     or length(p_ip_hash) <> 64 or length(p_session_hash) <> 64
     or length(p_device_hash) <> 64 or length(p_file_hash) <> 64
     or p_rotation_id <> to_char(v_now at time zone 'UTC', 'YYYY-MM')
     or length(p_ip_bucket_hmac) <> 64 or length(p_session_bucket_hmac) <> 64
     or length(p_device_bucket_hmac) <> 64 or length(p_provider_bucket_hmac) <> 64
     or length(p_circuit_bucket_hmac) <> 64
     or p_estimated_cost_microusd < 0 or p_daily_cost_cap_microusd < 1000 then
    raise exception 'PM_PRICE_GUIDE_GATE_INVALID';
  end if;

  perform public.cleanup_signup_price_guide_analysis_v2(500);
  perform public.cleanup_signup_price_guide_security_meter_v1(1000);

  -- Lock every meter key in deterministic order. A purge followed by a new token
  -- cannot bypass the count because the meter row is independent of token_jti.
  for v_lock_key in
    select distinct value
      from unnest(array[
        'ip:' || p_ip_bucket_hmac,
        'session:' || p_session_bucket_hmac,
        'device:' || p_device_bucket_hmac,
        'provider:' || p_provider_bucket_hmac,
        'circuit:' || p_circuit_bucket_hmac
      ]) as keys(value)
     order by value
  loop
    perform pg_advisory_xact_lock(hashtextextended('pm-price-meter:' || v_lock_key, 0));
  end loop;

  if exists (select 1 from public.signup_price_guide_analysis_requests where token_jti = p_token_jti) then
    return jsonb_build_object('allowed', false, 'code', 'TOKEN_REUSED', 'retry_after_seconds', 0, 'cache_source_jti', null);
  end if;

  insert into public.signup_price_guide_security_meter_buckets (
    bucket_kind, rotation_id, bucket_start, bucket_end, bucket_hmac, expires_at
  ) values
    ('ip_10m', p_rotation_id, v_ip_start, v_ip_end, p_ip_bucket_hmac, v_ip_end + interval '1 hour'),
    ('session_day', p_rotation_id, v_day_start, v_day_end, p_session_bucket_hmac, v_day_end + interval '1 hour'),
    ('device_day', p_rotation_id, v_day_start, v_day_end, p_device_bucket_hmac, v_day_end + interval '1 hour'),
    ('provider_day', p_rotation_id, v_day_start, v_day_end, p_provider_bucket_hmac, v_day_end + interval '35 days'),
    ('provider_circuit_5m', p_rotation_id, v_circuit_start, v_circuit_end, p_circuit_bucket_hmac, v_circuit_end + interval '1 hour')
  on conflict (bucket_kind, bucket_start, bucket_hmac) do nothing;

  select request_count into strict v_ip_count
    from public.signup_price_guide_security_meter_buckets
   where bucket_kind = 'ip_10m' and bucket_start = v_ip_start and bucket_hmac = p_ip_bucket_hmac
   for update;
  select request_count into strict v_session_count
    from public.signup_price_guide_security_meter_buckets
   where bucket_kind = 'session_day' and bucket_start = v_day_start and bucket_hmac = p_session_bucket_hmac
   for update;
  select request_count into strict v_device_count
    from public.signup_price_guide_security_meter_buckets
   where bucket_kind = 'device_day' and bucket_start = v_day_start and bucket_hmac = p_device_bucket_hmac
   for update;
  select reserved_cost_microusd + actual_cost_microusd into strict v_daily_cost
    from public.signup_price_guide_security_meter_buckets
   where bucket_kind = 'provider_day' and bucket_start = v_day_start and bucket_hmac = p_provider_bucket_hmac
   for update;
  select provider_failure_count into strict v_failure_count
    from public.signup_price_guide_security_meter_buckets
   where bucket_kind = 'provider_circuit_5m' and bucket_start = v_circuit_start and bucket_hmac = p_circuit_bucket_hmac
   for update;

  if v_failure_count >= 5 then
    return jsonb_build_object('allowed', false, 'code', 'CIRCUIT_OPEN', 'retry_after_seconds', greatest(1, extract(epoch from (v_circuit_end - v_now))::integer), 'cache_source_jti', null);
  end if;
  if v_ip_count >= 10 then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', greatest(1, extract(epoch from (v_ip_end - v_now))::integer), 'cache_source_jti', null);
  end if;
  if v_session_count >= 6 or v_device_count >= 8 then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', greatest(1, extract(epoch from (v_day_end - v_now))::integer), 'cache_source_jti', null);
  end if;
  if (select count(*) from public.signup_price_guide_analysis_requests
       where session_hash = p_session_hash and status = 'processing' and created_at > v_now - interval '2 minutes') >= 2
     or exists (select 1 from public.signup_price_guide_analysis_requests
       where file_hash = p_file_hash and status = 'processing' and created_at > v_now - interval '2 minutes') then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', 15, 'cache_source_jti', null);
  end if;

  select token_jti into v_cache_jti
    from public.signup_price_guide_analysis_requests
   where file_hash = p_file_hash and status = 'completed'
     and cache_ciphertext is not null and cache_expires_at > v_now
   order by completed_at desc nulls last
   limit 1;
  v_reserved_cost := case when v_cache_jti is null then p_estimated_cost_microusd else 0 end;

  if v_daily_cost + v_reserved_cost > p_daily_cost_cap_microusd then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', greatest(1, extract(epoch from (v_day_end - v_now))::integer), 'cache_source_jti', null);
  end if;

  update public.signup_price_guide_security_meter_buckets
     set request_count = request_count + 1, updated_at = v_now
   where bucket_kind = 'ip_10m' and bucket_start = v_ip_start and bucket_hmac = p_ip_bucket_hmac;
  update public.signup_price_guide_security_meter_buckets
     set request_count = request_count + 1, updated_at = v_now
   where bucket_kind = 'session_day' and bucket_start = v_day_start and bucket_hmac = p_session_bucket_hmac;
  update public.signup_price_guide_security_meter_buckets
     set request_count = request_count + 1, updated_at = v_now
   where bucket_kind = 'device_day' and bucket_start = v_day_start and bucket_hmac = p_device_bucket_hmac;
  update public.signup_price_guide_security_meter_buckets
     set request_count = request_count + 1,
         reserved_cost_microusd = reserved_cost_microusd + v_reserved_cost,
         updated_at = v_now
   where bucket_kind = 'provider_day' and bucket_start = v_day_start and bucket_hmac = p_provider_bucket_hmac;

  insert into public.signup_price_guide_analysis_requests (
    token_jti, ip_hash, session_hash, device_hash, file_hash, status,
    estimated_cost_microusd, actual_cost_microusd, cache_source_jti, completed_at,
    meter_rotation_id, provider_meter_bucket_hmac, provider_meter_bucket_start,
    circuit_meter_bucket_hmac, circuit_meter_bucket_start
  ) values (
    p_token_jti, p_ip_hash, p_session_hash, p_device_hash, p_file_hash,
    case when v_cache_jti is null then 'processing' else 'completed' end,
    v_reserved_cost, case when v_cache_jti is null then null else 0 end,
    v_cache_jti, case when v_cache_jti is null then null else v_now end,
    p_rotation_id, p_provider_bucket_hmac, v_day_start,
    p_circuit_bucket_hmac, v_circuit_start
  );

  return jsonb_build_object(
    'allowed', true,
    'code', case when v_cache_jti is null then 'ALLOWED' else 'CACHE_HIT' end,
    'retry_after_seconds', 0,
    'cache_source_jti', v_cache_jti
  );
exception
  when no_data_found then
    raise exception 'PM_PRICE_GUIDE_METER_MISSING';
end;
$$;

create or replace function public.complete_signup_price_guide_analysis_v2(
  p_token_jti uuid,
  p_actual_cost_microusd integer,
  p_cache_ciphertext text,
  p_cache_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.signup_price_guide_analysis_requests%rowtype;
begin
  if p_token_jti is null or p_actual_cost_microusd < 0
     or p_cache_ciphertext is null or length(p_cache_ciphertext) < 16
     or p_cache_expires_at <= clock_timestamp()
     or p_cache_expires_at > clock_timestamp() + interval '10 minutes' then
    raise exception 'PM_PRICE_GUIDE_COMPLETE_INVALID';
  end if;

  select * into v_request
    from public.signup_price_guide_analysis_requests
   where token_jti = p_token_jti
   for update;
  if not found then return false; end if;
  if v_request.status = 'completed' then return true; end if;
  if v_request.status <> 'processing' then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended('pm-price-meter:provider:' || v_request.provider_meter_bucket_hmac, 0));
  update public.signup_price_guide_security_meter_buckets
     set reserved_cost_microusd = greatest(0, reserved_cost_microusd - v_request.estimated_cost_microusd),
         actual_cost_microusd = actual_cost_microusd + p_actual_cost_microusd,
         updated_at = clock_timestamp()
   where bucket_kind = 'provider_day'
     and bucket_start = v_request.provider_meter_bucket_start
     and bucket_hmac = v_request.provider_meter_bucket_hmac;
  if not found then raise exception 'PM_PRICE_GUIDE_METER_MISSING'; end if;

  update public.signup_price_guide_analysis_requests
     set status = 'completed',
         actual_cost_microusd = p_actual_cost_microusd,
         cache_ciphertext = p_cache_ciphertext,
         cache_expires_at = p_cache_expires_at,
         completed_at = clock_timestamp(),
         failure_code = null
   where token_jti = p_token_jti;
  return true;
end;
$$;

create or replace function public.purge_signup_price_guide_analysis_v2(
  p_token_jti uuid,
  p_reason text,
  p_failure_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.signup_price_guide_analysis_requests%rowtype;
  v_charge_failed_provider boolean;
  v_lock_key text;
begin
  if p_token_jti is null or p_reason not in ('confirmed', 'cancelled', 'retake', 'manual', 'failed', 'timeout', 'abandoned', 'rollback', 'cache_expired', 'processing_expired', 'retention_expired') then
    raise exception 'PM_PRICE_GUIDE_PURGE_INVALID';
  end if;

  select * into v_request
    from public.signup_price_guide_analysis_requests
   where token_jti = p_token_jti
   for update;
  if not found then return false; end if;
  if v_request.status = 'tombstoned' then return true; end if;

  v_charge_failed_provider := v_request.status = 'processing'
    and p_failure_code in ('PROVIDER_FAILED', 'PROVIDER_TIMEOUT');

  for v_lock_key in
    select distinct value
      from unnest(array_remove(array[
        case when v_request.provider_meter_bucket_hmac is null then null else 'provider:' || v_request.provider_meter_bucket_hmac end,
        case when v_charge_failed_provider and v_request.circuit_meter_bucket_hmac is not null then 'circuit:' || v_request.circuit_meter_bucket_hmac else null end
      ], null)) as keys(value)
     order by value
  loop
    perform pg_advisory_xact_lock(hashtextextended('pm-price-meter:' || v_lock_key, 0));
  end loop;

  if v_request.status = 'processing' and v_request.provider_meter_bucket_hmac is not null then
    update public.signup_price_guide_security_meter_buckets
       set reserved_cost_microusd = greatest(0, reserved_cost_microusd - v_request.estimated_cost_microusd),
           actual_cost_microusd = actual_cost_microusd + case when v_charge_failed_provider then v_request.estimated_cost_microusd else 0 end,
           updated_at = clock_timestamp()
     where bucket_kind = 'provider_day'
       and bucket_start = v_request.provider_meter_bucket_start
       and bucket_hmac = v_request.provider_meter_bucket_hmac;
    if not found then raise exception 'PM_PRICE_GUIDE_METER_MISSING'; end if;
  end if;

  if v_charge_failed_provider and v_request.circuit_meter_bucket_hmac is not null then
    update public.signup_price_guide_security_meter_buckets
       set provider_failure_count = provider_failure_count + 1,
           updated_at = clock_timestamp()
     where bucket_kind = 'provider_circuit_5m'
       and bucket_start = v_request.circuit_meter_bucket_start
       and bucket_hmac = v_request.circuit_meter_bucket_hmac;
    if not found then raise exception 'PM_PRICE_GUIDE_METER_MISSING'; end if;
  end if;

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
         failure_code = left(p_failure_code, 80),
         purge_requested_at = clock_timestamp(),
         purged_at = clock_timestamp(),
         purge_reason = p_reason,
         cleanup_after = clock_timestamp() + interval '1 hour',
         cleanup_attempts = cleanup_attempts + 1,
         cleanup_last_error = null,
         completed_at = coalesce(completed_at, clock_timestamp())
   where token_jti = p_token_jti;
  return true;
exception
  when others then
    raise exception 'PM_PRICE_GUIDE_PURGE_FAILED';
end;
$$;

create or replace function public.cleanup_signup_price_guide_analysis_v2(
  p_batch_size integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_tombstoned integer := 0;
  v_deleted integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception 'PM_PRICE_GUIDE_CLEANUP_BATCH_INVALID';
  end if;

  for v_row in
    select token_jti,
           case
             when expires_at <= clock_timestamp() then 'retention_expired'
             when status = 'completed' then 'cache_expired'
             when status = 'processing' then 'processing_expired'
             else 'failed'
           end as purge_reason,
           case when status = 'processing' then 'PROVIDER_TIMEOUT' else failure_code end as purge_failure_code
      from public.signup_price_guide_analysis_requests
     where status <> 'tombstoned'
       and (
         expires_at <= clock_timestamp()
         or (status = 'completed' and cache_expires_at is not null and cache_expires_at <= clock_timestamp())
         or (status = 'processing' and created_at <= clock_timestamp() - interval '2 minutes')
         or status = 'failed'
       )
     order by created_at
     for update skip locked
     limit p_batch_size
  loop
    if public.purge_signup_price_guide_analysis_v2(v_row.token_jti, v_row.purge_reason, v_row.purge_failure_code) then
      v_tombstoned := v_tombstoned + 1;
    end if;
  end loop;

  with doomed as (
    select token_jti
      from public.signup_price_guide_analysis_requests
     where status = 'tombstoned' and cleanup_after <= clock_timestamp()
     order by cleanup_after
     for update skip locked
     limit p_batch_size
  )
  delete from public.signup_price_guide_analysis_requests as requests
   using doomed
   where requests.token_jti = doomed.token_jti;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('tombstoned', v_tombstoned, 'deleted', v_deleted);
exception
  when others then
    raise exception 'PM_PRICE_GUIDE_CLEANUP_FAILED';
end;
$$;

-- Remove the v0.2 service-role entry points so application code cannot bypass
-- the durable meter. Rollback remains fail-closed and does not restore them.
revoke all on function public.claim_signup_price_guide_analysis_v1(uuid, text, text, text, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.purge_signup_price_guide_analysis_v1(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.cleanup_signup_price_guide_analysis_v1(integer) from public, anon, authenticated, service_role;
drop function if exists public.claim_signup_price_guide_analysis_v1(uuid, text, text, text, text, integer, integer);
drop function if exists public.purge_signup_price_guide_analysis_v1(uuid, text, text);
drop function if exists public.cleanup_signup_price_guide_analysis_v1(integer);

revoke all on function public.claim_signup_price_guide_analysis_v2(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_signup_price_guide_analysis_v2(uuid, integer, text, timestamptz) from public, anon, authenticated;
revoke all on function public.purge_signup_price_guide_analysis_v2(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cleanup_signup_price_guide_analysis_v2(integer) from public, anon, authenticated;
revoke all on function public.cleanup_signup_price_guide_security_meter_v1(integer) from public, anon, authenticated;
grant execute on function public.claim_signup_price_guide_analysis_v2(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer) to service_role;
grant execute on function public.complete_signup_price_guide_analysis_v2(uuid, integer, text, timestamptz) to service_role;
grant execute on function public.purge_signup_price_guide_analysis_v2(uuid, text, text) to service_role;
grant execute on function public.cleanup_signup_price_guide_analysis_v2(integer) to service_role;
grant execute on function public.cleanup_signup_price_guide_security_meter_v1(integer) to service_role;

notify pgrst, 'reload schema';
