-- Owner self-deletion is a server-only, fail-closed workflow.
-- It never stores a raw idempotency key or a pre-delete row snapshot.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.owner_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  shop_ids text[] not null default '{}'::text[],
  idempotency_key_hash char(64) not null unique,
  state text not null default 'prepared' check (state in ('prepared', 'data_purged', 'terminal')),
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terminal_at timestamptz
);

create table if not exists private.owner_account_deletion_ledger (
  id uuid primary key default gen_random_uuid(),
  deletion_request_id uuid not null references private.owner_account_deletion_requests(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('data_purged', 'terminal')),
  details jsonb not null default '{}'::jsonb
);

alter table private.owner_account_deletion_requests enable row level security;
alter table private.owner_account_deletion_ledger enable row level security;
revoke all on table private.owner_account_deletion_requests from public, anon, authenticated;
revoke all on table private.owner_account_deletion_ledger from public, anon, authenticated;

-- New deletion audit rows intentionally retain only an event category. The former
-- raw snapshot shape is not suitable for a terminal personal-data deletion flow.
create or replace function private.write_business_delete_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.data_deletion_audit (
    event_type,
    table_name,
    record_id,
    shop_id,
    actor_identifier,
    database_role,
    record_snapshot
  ) values (
    'hard_delete',
    tg_table_name,
    'redacted',
    null,
    null,
    'redacted',
    jsonb_build_object('schema_version', 2, 'redacted', true, 'event_kind', 'hard_delete')
  );
  return old;
end;
$$;

create or replace function private.write_shop_soft_delete_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    event_name := 'soft_delete';
  elsif old.deleted_at is not null and new.deleted_at is null then
    event_name := 'restore';
  else
    return new;
  end if;

  insert into public.data_deletion_audit (
    event_type,
    table_name,
    record_id,
    shop_id,
    actor_identifier,
    database_role,
    deletion_reason,
    record_snapshot
  ) values (
    event_name,
    'shops',
    'redacted',
    null,
    null,
    'redacted',
    null,
    jsonb_build_object('schema_version', 2, 'redacted', true, 'event_kind', event_name)
  );
  return new;
end;
$$;

create or replace function private.prevent_data_deletion_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.owner_account_deletion_redaction', true) = 'true' then
    if tg_op = 'UPDATE' then
      return new;
    end if;
    return old;
  end if;

  raise exception '삭제 감사 기록은 수정하거나 삭제할 수 없습니다.'
    using errcode = '55000';
end;
$$;

create or replace function public.claim_owner_account_deletion_v1(
  p_owner_user_id uuid,
  p_idempotency_key_hash text
)
returns table (request_id uuid, state text, shop_ids text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.owner_account_deletion_requests%rowtype;
  v_shop_ids text[];
  v_has_active_billing boolean;
  v_has_retention_candidate boolean;
begin
  if p_owner_user_id is null or p_idempotency_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'OWNER_ACCOUNT_DELETION_INVALID_REQUEST' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 891271));

  select * into v_request
  from private.owner_account_deletion_requests
  where idempotency_key_hash = p_idempotency_key_hash
  for update;

  if found then
    if v_request.owner_user_id is not null and v_request.owner_user_id <> p_owner_user_id then
      raise exception 'OWNER_ACCOUNT_DELETION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return query select v_request.id, v_request.state, v_request.shop_ids;
    return;
  end if;

  select coalesce(array_agg(s.id order by s.id), '{}'::text[])
  into v_shop_ids
  from public.shops s
  where s.owner_user_id = p_owner_user_id;

  if cardinality(v_shop_ids) = 0 then
    raise exception 'OWNER_ACCOUNT_DELETION_OWNER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.owner_subscriptions os
    where os.user_id = p_owner_user_id
      and os.subscription_status in ('trialing', 'trial_will_end', 'active', 'past_due')
  ) into v_has_active_billing;

  if v_has_active_billing then
    raise exception 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL' using errcode = 'P0001';
  end if;

  -- The approved retention period/basis has not been encoded in this schema.
  -- Never discard payment or dispute evidence until that explicit policy exists.
  select exists (
    select 1 from public.owner_payment_ledger opl where opl.user_id = p_owner_user_id
    union all
    select 1 from public.owner_billing_events obe where obe.user_id = p_owner_user_id
  ) into v_has_retention_candidate;

  if v_has_retention_candidate then
    raise exception 'OWNER_ACCOUNT_DELETION_RETENTION_POLICY_REQUIRED' using errcode = 'P0001';
  end if;

  insert into private.owner_account_deletion_requests (owner_user_id, shop_ids, idempotency_key_hash)
  values (p_owner_user_id, v_shop_ids, p_idempotency_key_hash)
  returning * into v_request;

  return query select v_request.id, v_request.state, v_request.shop_ids;
end;
$$;

create or replace function public.finalize_owner_account_deletion_v1(
  p_request_id uuid,
  p_owner_user_id uuid
)
returns table (state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.owner_account_deletion_requests%rowtype;
begin
  select * into v_request
  from private.owner_account_deletion_requests
  where id = p_request_id
  for update;

  if not found or v_request.owner_user_id is distinct from p_owner_user_id then
    raise exception 'OWNER_ACCOUNT_DELETION_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.state = 'terminal' then
    return query select v_request.state;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 891271));
  perform set_config('app.owner_account_deletion_redaction', 'true', true);

  -- Legacy rows that relate to this account are reduced before deleting its data.
  update public.data_deletion_audit
  set
    record_id = 'redacted',
    shop_id = null,
    actor_identifier = null,
    database_role = 'redacted',
    deletion_reason = null,
    record_snapshot = jsonb_build_object('schema_version', 2, 'redacted', true, 'event_kind', event_type)
  where record_id = p_owner_user_id::text
     or actor_identifier = p_owner_user_id::text
     or shop_id = any(v_request.shop_ids)
     or record_snapshot::text like '%' || p_owner_user_id::text || '%';

  delete from public.media_send_attempts where shop_id = any(v_request.shop_ids);
  delete from public.notification_media_attachments where shop_id = any(v_request.shop_ids);
  delete from public.media_assets where shop_id = any(v_request.shop_ids);
  delete from public.owner_push_tokens where owner_user_id = p_owner_user_id or shop_id = any(v_request.shop_ids);
  delete from public.owner_login_sessions where owner_user_id = p_owner_user_id;
  if to_regclass('public.owner_shop_memberships') is not null then
    execute 'delete from public.owner_shop_memberships where owner_user_id = $1' using p_owner_user_id;
  end if;
  delete from public.owner_profiles where user_id = p_owner_user_id;
  delete from public.shops where owner_user_id = p_owner_user_id;

  update private.owner_account_deletion_requests
  set
    shop_ids = '{}'::text[],
    state = 'data_purged',
    updated_at = now()
  where id = v_request.id;

  insert into private.owner_account_deletion_ledger (deletion_request_id, event_type, details)
  values (v_request.id, 'data_purged', jsonb_build_object('schema_version', 1, 'redacted', true));

  return query select 'data_purged'::text;
end;
$$;

create or replace function public.complete_owner_account_deletion_v1(p_request_id uuid)
returns table (state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.owner_account_deletion_requests%rowtype;
begin
  select * into v_request
  from private.owner_account_deletion_requests
  where id = p_request_id
  for update;

  if not found or v_request.state <> 'data_purged' then
    raise exception 'OWNER_ACCOUNT_DELETION_NOT_READY' using errcode = 'P0001';
  end if;

  update private.owner_account_deletion_requests
  set owner_user_id = null, shop_ids = '{}'::text[], state = 'terminal', updated_at = now(), terminal_at = now()
  where id = v_request.id;

  insert into private.owner_account_deletion_ledger (deletion_request_id, event_type, details)
  values (v_request.id, 'terminal', jsonb_build_object('schema_version', 1, 'redacted', true));

  return query select 'terminal'::text;
end;
$$;

revoke all on function public.claim_owner_account_deletion_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_owner_account_deletion_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_owner_account_deletion_v1(uuid) from public, anon, authenticated;
grant execute on function public.claim_owner_account_deletion_v1(uuid, text) to service_role;
grant execute on function public.finalize_owner_account_deletion_v1(uuid, uuid) to service_role;
grant execute on function public.complete_owner_account_deletion_v1(uuid) to service_role;

revoke all on function private.write_business_delete_audit() from public, anon, authenticated;
revoke all on function private.write_shop_soft_delete_audit() from public, anon, authenticated;
revoke all on function private.prevent_data_deletion_audit_mutation() from public, anon, authenticated;
