-- Development/Test P0 only. Production application requires a separate reviewed release approval.

alter table public.signup_idempotency_requests
  drop constraint if exists signup_idempotency_requests_status_check;

update public.signup_idempotency_requests set status = 'claimed' where status = 'processing';

alter table public.signup_idempotency_requests
  add constraint signup_idempotency_requests_status_check
  check (status in ('claimed', 'auth_created', 'completed', 'compensation_pending', 'failed_compensated'));

create or replace function public.claim_owner_signup_v2(
  p_signup_request_id uuid,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.signup_idempotency_requests%rowtype;
begin
  if p_signup_request_id is null or length(coalesce(p_payload_hash, '')) <> 64 then
    raise exception 'PM_SIGNUP_INVALID_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_signup_request_id::text, 0));
  select * into v_row from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id for update;

  if not found then
    insert into public.signup_idempotency_requests (signup_request_id, payload_hash, status)
    values (p_signup_request_id, p_payload_hash, 'claimed')
    returning * into v_row;
    return jsonb_build_object('action', 'claimed', 'status', v_row.status, 'authUserId', null, 'shopId', null);
  end if;

  if v_row.payload_hash <> p_payload_hash then
    return jsonb_build_object('action', 'payload_mismatch', 'status', v_row.status, 'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id);
  end if;
  if v_row.status = 'completed' and v_row.shop_id is not null then
    return jsonb_build_object('action', 'completed', 'status', v_row.status, 'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id);
  end if;
  if v_row.status = 'compensation_pending' then
    return jsonb_build_object('action', 'compensation_pending', 'status', v_row.status, 'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id);
  end if;
  if v_row.status in ('claimed', 'auth_created') then
    return jsonb_build_object('action', 'in_progress', 'status', v_row.status, 'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id);
  end if;

  update public.signup_idempotency_requests
     set status = 'claimed', auth_user_id = null, shop_id = null, failure_reason = null, updated_at = now()
   where signup_request_id = p_signup_request_id
   returning * into v_row;
  return jsonb_build_object('action', 'claimed', 'status', v_row.status, 'authUserId', null, 'shopId', null);
end;
$$;

create or replace function public.mark_owner_signup_auth_created_v2(
  p_signup_request_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.signup_idempotency_requests
     set status = 'auth_created', auth_user_id = p_auth_user_id, updated_at = now()
   where signup_request_id = p_signup_request_id
     and payload_hash = p_payload_hash
     and status = 'claimed';
  if not found then raise exception 'PM_SIGNUP_CLAIM_LOST'; end if;
end;
$$;

create or replace function public.complete_owner_signup_v2(
  p_signup_request_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid,
  p_shop jsonb,
  p_profile jsonb,
  p_services jsonb,
  p_staff jsonb,
  p_identity_verification_id uuid,
  p_identity_token_id uuid,
  p_included_credit_amount integer,
  p_credit_period_started_at timestamptz,
  p_credit_period_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.signup_idempotency_requests%rowtype;
  v_result jsonb;
  v_shop_id text := nullif(trim(p_shop ->> 'id'), '');
begin
  perform pg_advisory_xact_lock(hashtextextended(p_signup_request_id::text, 0));
  select * into v_row from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id for update;
  if not found or v_row.payload_hash <> p_payload_hash then raise exception 'PM_SIGNUP_PAYLOAD_MISMATCH'; end if;
  if v_row.status = 'completed' and v_row.shop_id is not null then
    return jsonb_build_object('shopId', v_row.shop_id, 'reused', true);
  end if;
  if v_row.status <> 'auth_created' or v_row.auth_user_id is distinct from p_auth_user_id then
    raise exception 'PM_SIGNUP_INVALID_STATE';
  end if;
  if p_included_credit_amount < 0 or p_credit_period_ends_at <= p_credit_period_started_at then
    raise exception 'PM_SIGNUP_INVALID_CREDIT_PERIOD';
  end if;

  update public.owner_identity_verifications
     set status = 'consumed', consumed_at = now(), consumed_action = 'signup', updated_at = now()
   where id = p_identity_verification_id
     and purpose = 'signup'
     and status = 'verified'
     and verification_token_id = p_identity_token_id
     and consumed_at is null
     and verified_expires_at > now();
  if not found then raise exception 'PM_SIGNUP_IDENTITY_CONSUME_FAILED'; end if;

  select public.complete_owner_signup_v1(
    p_signup_request_id, p_payload_hash, p_auth_user_id,
    p_shop, p_profile, p_services, p_staff
  ) into v_result;

  insert into public.shop_alimtalk_credit_balances (
    shop_id, included_total, included_used, included_period_started_at, included_period_ends_at,
    purchased_total, purchased_used, created_at, updated_at
  ) values (
    v_shop_id, p_included_credit_amount, 0, p_credit_period_started_at, p_credit_period_ends_at,
    0, 0, now(), now()
  );

  insert into public.shop_alimtalk_credit_events (
    shop_id, event_type, credit_bucket, amount_delta,
    included_remaining_after, purchased_remaining_after, balance_after,
    reason, metadata
  ) values (
    v_shop_id, 'reset', 'included', p_included_credit_amount,
    p_included_credit_amount, 0, p_included_credit_amount,
    'owner_atomic_signup', jsonb_build_object('source', 'owner_atomic_signup', 'signupRequestId', p_signup_request_id)
  );

  return v_result;
end;
$$;

revoke all on function public.claim_owner_signup_v2(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_owner_signup_auth_created_v2(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_owner_signup_v2(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, integer, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_owner_signup_v2(uuid, text) to service_role;
grant execute on function public.mark_owner_signup_auth_created_v2(uuid, text, uuid) to service_role;
grant execute on function public.complete_owner_signup_v2(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, integer, timestamptz, timestamptz) to service_role;

create table if not exists public.signup_price_guide_analysis_requests (
  token_jti uuid primary key,
  ip_hash text check (ip_hash is null or length(ip_hash) = 64),
  session_hash text check (session_hash is null or length(session_hash) = 64),
  device_hash text check (device_hash is null or length(device_hash) = 64),
  file_hash text check (file_hash is null or length(file_hash) = 64),
  status text not null check (status in ('processing', 'completed', 'failed', 'tombstoned')),
  estimated_cost_microusd integer not null default 0 check (estimated_cost_microusd >= 0),
  actual_cost_microusd integer check (actual_cost_microusd is null or actual_cost_microusd >= 0),
  cache_source_jti uuid references public.signup_price_guide_analysis_requests(token_jti) on delete set null,
  cache_ciphertext text,
  cache_expires_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  purge_requested_at timestamptz,
  purged_at timestamptz,
  purge_reason text check (purge_reason is null or purge_reason in ('confirmed', 'cancelled', 'retake', 'manual', 'failed', 'timeout', 'abandoned', 'cache_expired', 'processing_expired', 'retention_expired', 'rollback')),
  cleanup_after timestamptz,
  cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  cleanup_last_error text
);

create index if not exists signup_price_guide_analysis_ip_created_idx on public.signup_price_guide_analysis_requests(ip_hash, created_at desc);
create index if not exists signup_price_guide_analysis_session_created_idx on public.signup_price_guide_analysis_requests(session_hash, created_at desc);
create index if not exists signup_price_guide_analysis_device_created_idx on public.signup_price_guide_analysis_requests(device_hash, created_at desc);
create index if not exists signup_price_guide_analysis_file_cache_idx on public.signup_price_guide_analysis_requests(file_hash, cache_expires_at desc) where status = 'completed';

alter table public.signup_price_guide_analysis_requests enable row level security;
revoke all on table public.signup_price_guide_analysis_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.signup_price_guide_analysis_requests to service_role;

create or replace function public.cleanup_signup_price_guide_analysis_v1(
  p_batch_size integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tombstoned integer := 0;
  v_deleted integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 5000 then
    raise exception 'PM_PRICE_GUIDE_CLEANUP_BATCH_INVALID';
  end if;

  with expired as (
    select token_jti, status
      from public.signup_price_guide_analysis_requests
     where status <> 'tombstoned'
       and (
         expires_at <= now()
         or (status = 'completed' and cache_expires_at is not null and cache_expires_at <= now())
         or (status = 'processing' and created_at <= now() - interval '2 minutes')
         or status = 'failed'
       )
     order by created_at
     for update skip locked
     limit p_batch_size
  )
  update public.signup_price_guide_analysis_requests as requests
     set status = 'tombstoned',
         ip_hash = null,
         session_hash = null,
         device_hash = null,
         file_hash = null,
         cache_source_jti = null,
         cache_ciphertext = null,
         cache_expires_at = null,
         purge_requested_at = coalesce(requests.purge_requested_at, now()),
         purged_at = now(),
         purge_reason = case
           when requests.expires_at <= now() then 'retention_expired'
           when requests.status = 'completed' then 'cache_expired'
           when requests.status = 'processing' then 'processing_expired'
           else 'failed'
         end,
         cleanup_after = now() + interval '1 hour',
         cleanup_attempts = requests.cleanup_attempts + 1,
         cleanup_last_error = null
    from expired
   where requests.token_jti = expired.token_jti;
  get diagnostics v_tombstoned = row_count;

  with doomed as (
    select token_jti
      from public.signup_price_guide_analysis_requests
     where status = 'tombstoned' and cleanup_after <= now()
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

create or replace function public.purge_signup_price_guide_analysis_v1(
  p_token_jti uuid,
  p_reason text,
  p_failure_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_jti is null or p_reason not in ('confirmed', 'cancelled', 'retake', 'manual', 'failed', 'timeout', 'abandoned', 'rollback') then
    raise exception 'PM_PRICE_GUIDE_PURGE_INVALID';
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
         failure_code = left(p_failure_code, 80),
         purge_requested_at = now(),
         purged_at = now(),
         purge_reason = p_reason,
         cleanup_after = now() + interval '1 hour',
         cleanup_attempts = cleanup_attempts + 1,
         cleanup_last_error = null,
         completed_at = coalesce(completed_at, now())
   where token_jti = p_token_jti;
  return found;
exception
  when others then
    raise exception 'PM_PRICE_GUIDE_PURGE_FAILED';
end;
$$;

create or replace function public.claim_signup_price_guide_analysis_v1(
  p_token_jti uuid,
  p_ip_hash text,
  p_session_hash text,
  p_device_hash text,
  p_file_hash text,
  p_estimated_cost_microusd integer,
  p_daily_cost_cap_microusd integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cache_jti uuid;
  v_daily_cost bigint;
begin
  if p_token_jti is null or length(p_ip_hash) <> 64 or length(p_session_hash) <> 64
     or length(p_device_hash) <> 64 or length(p_file_hash) <> 64
     or p_estimated_cost_microusd < 0 or p_daily_cost_cap_microusd < 1000 then
    raise exception 'PM_PRICE_GUIDE_GATE_INVALID';
  end if;
  perform public.cleanup_signup_price_guide_analysis_v1(500);
  perform pg_advisory_xact_lock(hashtextextended(p_session_hash, 0));
  if exists (select 1 from public.signup_price_guide_analysis_requests where token_jti = p_token_jti) then
    return jsonb_build_object('allowed', false, 'code', 'TOKEN_REUSED', 'retry_after_seconds', 0, 'cache_source_jti', null);
  end if;
  if (select count(*) from public.signup_price_guide_analysis_requests
       where failure_code in ('PROVIDER_FAILED', 'PROVIDER_TIMEOUT') and created_at > now() - interval '5 minutes') >= 5 then
    return jsonb_build_object('allowed', false, 'code', 'CIRCUIT_OPEN', 'retry_after_seconds', 300, 'cache_source_jti', null);
  end if;
  if (select count(*) from public.signup_price_guide_analysis_requests where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from public.signup_price_guide_analysis_requests where session_hash = p_session_hash and created_at > date_trunc('day', now())) >= 6
     or (select count(*) from public.signup_price_guide_analysis_requests where device_hash = p_device_hash and created_at > date_trunc('day', now())) >= 8 then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', 600, 'cache_source_jti', null);
  end if;
  if (select count(*) from public.signup_price_guide_analysis_requests where session_hash = p_session_hash and status = 'processing' and created_at > now() - interval '2 minutes') >= 2
     or exists (select 1 from public.signup_price_guide_analysis_requests where file_hash = p_file_hash and status = 'processing' and created_at > now() - interval '2 minutes') then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', 15, 'cache_source_jti', null);
  end if;
  select coalesce(sum(coalesce(actual_cost_microusd, estimated_cost_microusd)), 0) into v_daily_cost
    from public.signup_price_guide_analysis_requests where created_at > date_trunc('day', now());
  if v_daily_cost + p_estimated_cost_microusd > p_daily_cost_cap_microusd then
    return jsonb_build_object('allowed', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', extract(epoch from (date_trunc('day', now()) + interval '1 day' - now()))::integer, 'cache_source_jti', null);
  end if;

  select token_jti into v_cache_jti from public.signup_price_guide_analysis_requests
   where file_hash = p_file_hash and status = 'completed' and cache_ciphertext is not null and cache_expires_at > now()
   order by completed_at desc nulls last limit 1;

  insert into public.signup_price_guide_analysis_requests (
    token_jti, ip_hash, session_hash, device_hash, file_hash, status,
    estimated_cost_microusd, actual_cost_microusd, cache_source_jti, completed_at
  ) values (
    p_token_jti, p_ip_hash, p_session_hash, p_device_hash, p_file_hash,
    case when v_cache_jti is null then 'processing' else 'completed' end,
    case when v_cache_jti is null then p_estimated_cost_microusd else 0 end,
    case when v_cache_jti is null then null else 0 end,
    v_cache_jti, case when v_cache_jti is null then null else now() end
  );
  return jsonb_build_object('allowed', true, 'code', case when v_cache_jti is null then 'ALLOWED' else 'CACHE_HIT' end, 'retry_after_seconds', 0, 'cache_source_jti', v_cache_jti);
end;
$$;

revoke all on function public.claim_signup_price_guide_analysis_v1(uuid, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.cleanup_signup_price_guide_analysis_v1(integer) from public, anon, authenticated;
revoke all on function public.purge_signup_price_guide_analysis_v1(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_signup_price_guide_analysis_v1(uuid, text, text, text, text, integer, integer) to service_role;
grant execute on function public.cleanup_signup_price_guide_analysis_v1(integer) to service_role;
grant execute on function public.purge_signup_price_guide_analysis_v1(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
