create table if not exists public.admin_auth_rate_limit_buckets (
  action text not null check (action in ('login', 'register', 'reset')),
  subject_kind text not null check (subject_kind in ('ip', 'identifier')),
  key_version text not null check (key_version ~ '^v[0-9]+$'),
  bucket_start timestamptz not null,
  bucket_end timestamptz not null,
  subject_hmac text not null check (length(subject_hmac) = 64),
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (action, subject_kind, key_version, bucket_start, subject_hmac),
  check (bucket_end > bucket_start),
  check (expires_at >= bucket_end)
);

create index if not exists admin_auth_rate_limit_buckets_expiry_idx
  on public.admin_auth_rate_limit_buckets (expires_at);

alter table public.admin_auth_rate_limit_buckets enable row level security;
revoke all on table public.admin_auth_rate_limit_buckets from public, anon, authenticated, service_role;

create or replace function public.claim_admin_auth_rate_limit_v1(
  p_action text,
  p_ip_hmac text,
  p_identifier_hmac text,
  p_key_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_bucket_start timestamptz;
  v_bucket_end timestamptz;
  v_ip_limit integer;
  v_identifier_limit integer;
  v_ip_count integer;
  v_identifier_count integer;
  v_lock_key text;
begin
  if p_action not in ('login', 'register', 'reset')
     or p_key_version !~ '^v[0-9]+$'
     or length(p_ip_hmac) <> 64
     or length(p_identifier_hmac) <> 64 then
    raise exception 'PM_ADMIN_AUTH_RATE_LIMIT_INVALID';
  end if;

  v_bucket_start := date_bin(interval '15 minutes', v_now, timestamptz '2001-01-01 00:00:00+00');
  v_bucket_end := v_bucket_start + interval '15 minutes';
  v_ip_limit := case when p_action = 'login' then 20 else 5 end;
  v_identifier_limit := case when p_action = 'login' then 5 else 3 end;

  with doomed as (
    select action, subject_kind, key_version, bucket_start, subject_hmac
      from public.admin_auth_rate_limit_buckets
     where expires_at <= v_now
     order by expires_at
     for update skip locked
     limit 100
  )
  delete from public.admin_auth_rate_limit_buckets as buckets
   using doomed
   where buckets.action = doomed.action
     and buckets.subject_kind = doomed.subject_kind
     and buckets.key_version = doomed.key_version
     and buckets.bucket_start = doomed.bucket_start
     and buckets.subject_hmac = doomed.subject_hmac;

  for v_lock_key in
    select value
      from unnest(array[
        'identifier:' || p_identifier_hmac,
        'ip:' || p_ip_hmac
      ]) as keys(value)
     order by value
  loop
    perform pg_advisory_xact_lock(hashtextextended('pm-admin-auth-rate-limit:' || p_action || ':' || p_key_version || ':' || v_lock_key, 0));
  end loop;

  insert into public.admin_auth_rate_limit_buckets (
    action, subject_kind, key_version, bucket_start, bucket_end, subject_hmac, expires_at
  ) values
    (p_action, 'ip', p_key_version, v_bucket_start, v_bucket_end, p_ip_hmac, v_bucket_end + interval '24 hours'),
    (p_action, 'identifier', p_key_version, v_bucket_start, v_bucket_end, p_identifier_hmac, v_bucket_end + interval '24 hours')
  on conflict do nothing;

  select request_count into strict v_ip_count
    from public.admin_auth_rate_limit_buckets
   where action = p_action and subject_kind = 'ip' and key_version = p_key_version
     and bucket_start = v_bucket_start and subject_hmac = p_ip_hmac
   for update;
  select request_count into strict v_identifier_count
    from public.admin_auth_rate_limit_buckets
   where action = p_action and subject_kind = 'identifier' and key_version = p_key_version
     and bucket_start = v_bucket_start and subject_hmac = p_identifier_hmac
   for update;

  if v_ip_count >= v_ip_limit or v_identifier_count >= v_identifier_limit then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, extract(epoch from (v_bucket_end - v_now))::integer)
    );
  end if;

  update public.admin_auth_rate_limit_buckets
     set request_count = request_count + 1, updated_at = v_now
   where action = p_action and subject_kind = 'ip' and key_version = p_key_version
     and bucket_start = v_bucket_start and subject_hmac = p_ip_hmac;
  update public.admin_auth_rate_limit_buckets
     set request_count = request_count + 1, updated_at = v_now
   where action = p_action and subject_kind = 'identifier' and key_version = p_key_version
     and bucket_start = v_bucket_start and subject_hmac = p_identifier_hmac;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

revoke execute on function public.claim_admin_auth_rate_limit_v1(text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.claim_admin_auth_rate_limit_v1(text, text, text, text) to service_role;

notify pgrst, 'reload schema';
