\set ON_ERROR_STOP on

do $$
declare
  v_allowed integer;
  v_denied integer;
  v_provider_actual bigint;
begin
  select count(*) filter (where allowed), count(*) filter (where not allowed)
    into v_allowed, v_denied
    from public.test_price_guide_meter_attack_results where scenario = 'session6';
  if v_allowed <> 6 or v_denied <> 14 then
    raise exception 'SESSION_LIMIT_FAILED allowed=% denied=%', v_allowed, v_denied;
  end if;

  select count(*) filter (where allowed), count(*) filter (where not allowed)
    into v_allowed, v_denied
    from public.test_price_guide_meter_attack_results where scenario = 'device8';
  if v_allowed <> 8 or v_denied <> 12 then
    raise exception 'DEVICE_LIMIT_FAILED allowed=% denied=%', v_allowed, v_denied;
  end if;

  select count(*) filter (where allowed), count(*) filter (where not allowed)
    into v_allowed, v_denied
    from public.test_price_guide_meter_attack_results where scenario = 'ip10';
  if v_allowed <> 10 or v_denied <> 10 then
    raise exception 'IP_LIMIT_FAILED allowed=% denied=%', v_allowed, v_denied;
  end if;

  select count(*) filter (where allowed), count(*) filter (where not allowed)
    into v_allowed, v_denied
    from public.test_price_guide_meter_attack_results where scenario = 'cost';
  if v_allowed <> 2 or v_denied <> 18 then
    raise exception 'COST_LIMIT_FAILED allowed=% denied=%', v_allowed, v_denied;
  end if;

  select actual_cost_microusd into v_provider_actual
    from public.signup_price_guide_security_meter_buckets
   where bucket_kind = 'provider_day'
     and bucket_hmac = encode(digest(to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM') || ':provider:cost', 'sha256'), 'hex');
  if v_provider_actual <> 800 then
    raise exception 'PROVIDER_COST_LEDGER_FAILED actual=%', v_provider_actual;
  end if;

  if exists (
    select 1 from public.signup_price_guide_analysis_requests
     where status = 'tombstoned'
       and (ip_hash is not null or session_hash is not null or device_hash is not null
         or file_hash is not null or cache_ciphertext is not null
         or provider_meter_bucket_hmac is not null or circuit_meter_bucket_hmac is not null)
  ) then
    raise exception 'PURGE_LEFT_SENSITIVE_ANALYSIS_DATA';
  end if;

  if not exists (
    select 1 from public.signup_price_guide_security_meter_buckets
     where request_count > 0
  ) then
    raise exception 'PURGE_REMOVED_SECURITY_METER';
  end if;

  if exists (
    select 1 from public.signup_price_guide_security_meter_buckets
     where bucket_kind in ('session_day', 'device_day')
       and expires_at <> bucket_end + interval '1 hour'
  ) then
    raise exception 'DAILY_TTL_INVALID';
  end if;
  if exists (
    select 1 from public.signup_price_guide_security_meter_buckets
     where bucket_kind = 'provider_day'
       and expires_at <> bucket_end + interval '35 days'
  ) then
    raise exception 'PROVIDER_TTL_INVALID';
  end if;
end;
$$;

insert into public.signup_price_guide_security_meter_buckets (
  bucket_kind, rotation_id, bucket_start, bucket_end, bucket_hmac, expires_at
) values (
  'ip_10m', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM'),
  clock_timestamp() - interval '2 hours', clock_timestamp() - interval '110 minutes',
  repeat('f', 64), clock_timestamp() - interval '1 hour'
);

select public.cleanup_signup_price_guide_security_meter_v1(1000);

do $$
begin
  if exists (
    select 1 from public.signup_price_guide_security_meter_buckets
     where bucket_hmac = repeat('f', 64)
  ) then
    raise exception 'METER_CLEANUP_FAILED';
  end if;
end;
$$;

select scenario,
       count(*) filter (where allowed) as allowed,
       count(*) filter (where not allowed) as denied
  from public.test_price_guide_meter_attack_results
 group by scenario
 order by scenario;

