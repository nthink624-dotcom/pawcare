-- Prepared only. Do not apply to Development or Production without a separate approval.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.admin_high_risk_actor_scopes (
  actor_ref text not null,
  scope text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (actor_ref, scope)
);

create table if not exists public.admin_step_up_sessions (
  id uuid primary key default gen_random_uuid(), actor_ref text not null,
  method text not null check (method in ('webauthn', 'totp')),
  verified_at timestamptz not null, expires_at timestamptz not null, revoked_at timestamptz,
  check (expires_at > verified_at)
);

create table if not exists public.admin_high_risk_requests (
  id uuid primary key default gen_random_uuid(), operation_id uuid not null unique,
  action text not null check (action in ('refund', 'withdraw', 'credential_reset', 'payment_method_reset')),
  requester_ref text not null, request_scope text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  version integer not null check (version > 0), expires_at timestamptz not null,
  state text not null default 'requested' check (state in ('requested', 'approved', 'rejected', 'expired', 'queued', 'leased', 'provider_pending', 'provider_unknown', 'retry_wait', 'reconciling', 'succeeded', 'failed', 'needs_review')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.admin_high_risk_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.admin_high_risk_requests(id) on delete restrict,
  request_version integer not null, payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  approver_ref text not null, decision text not null check (decision in ('approved', 'rejected')),
  decided_at timestamptz not null default now(), unique (request_id, request_version)
);

create table if not exists public.admin_high_risk_outbox (
  operation_id uuid primary key references public.admin_high_risk_requests(operation_id) on delete restrict,
  state text not null default 'awaiting_approval' check (state in ('awaiting_approval', 'queued', 'leased', 'provider_pending', 'provider_unknown', 'retry_wait', 'reconciling', 'succeeded', 'failed', 'needs_review')),
  lease_owner text, lease_token uuid, leased_at timestamptz, lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz, provider_operation_ref_hash text,
  updated_at timestamptz not null default now(),
  check (state <> 'provider_unknown' or next_attempt_at is null)
);

create table if not exists public.admin_high_risk_receipts (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique references public.admin_high_risk_outbox(operation_id) on delete restrict,
  action text not null, scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  requester_ref text not null, approver_ref text not null, executor_ref text not null,
  result text not null check (result in ('succeeded', 'failed', 'needs_review')),
  occurred_at timestamptz not null default now()
);

create or replace function public.guard_admin_high_risk_approval()
returns trigger language plpgsql set search_path = '' as $$
declare request_row public.admin_high_risk_requests%rowtype;
begin
  select * into request_row from public.admin_high_risk_requests where id = new.request_id for update;
  if not found then raise exception 'high-risk request unavailable'; end if;
  if request_row.requester_ref = new.approver_ref then raise exception 'self approval denied'; end if;
  if request_row.version <> new.request_version or request_row.payload_hash <> new.payload_hash then raise exception 'stale approval denied'; end if;
  if request_row.expires_at <= pg_catalog.now() then raise exception 'expired approval denied'; end if;
  return new;
end;
$$;

drop trigger if exists guard_admin_high_risk_approval_trigger on public.admin_high_risk_approvals;
create trigger guard_admin_high_risk_approval_trigger before insert on public.admin_high_risk_approvals
for each row execute function public.guard_admin_high_risk_approval();

create or replace function public.deny_admin_high_risk_immutable_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'high-risk audit rows are append-only';
end;
$$;

drop trigger if exists deny_admin_high_risk_approval_change on public.admin_high_risk_approvals;
create trigger deny_admin_high_risk_approval_change
before update or delete on public.admin_high_risk_approvals
for each row execute function public.deny_admin_high_risk_immutable_change();
drop trigger if exists deny_admin_high_risk_approval_truncate on public.admin_high_risk_approvals;
create trigger deny_admin_high_risk_approval_truncate
before truncate on public.admin_high_risk_approvals
for each statement execute function public.deny_admin_high_risk_immutable_change();

drop trigger if exists deny_admin_high_risk_receipt_change on public.admin_high_risk_receipts;
create trigger deny_admin_high_risk_receipt_change
before update or delete on public.admin_high_risk_receipts
for each row execute function public.deny_admin_high_risk_immutable_change();
drop trigger if exists deny_admin_high_risk_receipt_truncate on public.admin_high_risk_receipts;
create trigger deny_admin_high_risk_receipt_truncate
before truncate on public.admin_high_risk_receipts
for each statement execute function public.deny_admin_high_risk_immutable_change();

create or replace function public.admin_high_risk_required_scope(p_action text, p_phase text)
returns text language plpgsql immutable set search_path = '' as $$
begin
  return case p_action || ':' || p_phase
    when 'refund:request' then 'billing.refund.request'
    when 'refund:approve' then 'billing.refund.approve'
    when 'refund:execute' then 'billing.refund.execute'
    when 'withdraw:request' then 'account.withdraw.request'
    when 'withdraw:approve' then 'account.withdraw.approve'
    when 'withdraw:execute' then 'account.withdraw.execute'
    when 'credential_reset:request' then 'account.credential_reset.request'
    when 'credential_reset:approve' then 'account.credential_reset.approve'
    when 'credential_reset:execute' then 'account.credential_reset.execute'
    when 'payment_method_reset:request' then 'billing.payment_method_reset.request'
    when 'payment_method_reset:approve' then 'billing.payment_method_reset.approve'
    when 'payment_method_reset:execute' then 'billing.payment_method_reset.execute'
    else null end;
end;
$$;

create or replace function public.admin_high_risk_current_actor()
returns text language plpgsql stable set search_path = '' as $$
declare claims jsonb; actor text;
begin
  claims := coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  actor := claims ->> 'actor_ref';
  if actor is null or actor !~ '^[a-z0-9][a-z0-9._-]{15,95}$' then raise exception 'authenticated actor unavailable'; end if;
  return actor;
end;
$$;

create or replace function public.admin_high_risk_require_scope(p_actor text, p_action text, p_phase text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare required_scope text;
begin
  required_scope := public.admin_high_risk_required_scope(p_action, p_phase);
  if required_scope is null then raise exception 'unknown high-risk action'; end if;
  if not exists(select 1 from public.admin_high_risk_actor_scopes where actor_ref = p_actor and scope = required_scope and revoked_at is null) then raise exception 'action scope denied'; end if;
  return required_scope;
end;
$$;

create or replace function public.create_admin_high_risk_request(
  p_operation_id uuid, p_action text, p_payload_hash text, p_version integer, p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare request_id uuid; requester text; required_scope text;
begin
  requester := public.admin_high_risk_current_actor();
  required_scope := public.admin_high_risk_require_scope(requester, p_action, 'request');
  if not exists(select 1 from public.admin_step_up_sessions where actor_ref = requester and revoked_at is null and expires_at > pg_catalog.now()) then raise exception 'fresh step-up required'; end if;
  insert into public.admin_high_risk_requests(operation_id, action, requester_ref, request_scope, payload_hash, version, expires_at)
  values (p_operation_id, p_action, requester, required_scope, p_payload_hash, p_version, p_expires_at)
  returning id into request_id;
  insert into public.admin_high_risk_outbox(operation_id, state) values (p_operation_id, 'awaiting_approval');
  return request_id;
end;
$$;

create or replace function public.approve_admin_high_risk_request(
  p_request_id uuid, p_request_version integer, p_payload_hash text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare request_row public.admin_high_risk_requests%rowtype; approver text;
begin
  select * into request_row from public.admin_high_risk_requests where id = p_request_id for update;
  if not found then raise exception 'high-risk request unavailable'; end if;
  approver := public.admin_high_risk_current_actor();
  perform public.admin_high_risk_require_scope(approver, request_row.action, 'approve');
  if not exists(select 1 from public.admin_step_up_sessions where actor_ref = approver and revoked_at is null and expires_at > pg_catalog.now()) then raise exception 'fresh step-up required'; end if;
  insert into public.admin_high_risk_approvals(request_id, request_version, payload_hash, approver_ref, decision)
  values (p_request_id, p_request_version, p_payload_hash, approver, 'approved');
  update public.admin_high_risk_requests set state = 'approved', updated_at = pg_catalog.now() where id = p_request_id;
  update public.admin_high_risk_outbox set state = 'queued', updated_at = pg_catalog.now() where operation_id = request_row.operation_id and state = 'awaiting_approval';
  return request_row.operation_id;
end;
$$;

create or replace function public.claim_admin_high_risk_operation(
  p_operation_id uuid, p_lease_seconds integer default 30
) returns uuid language plpgsql security definer set search_path = '' as $$
declare changed_count integer; executor text; action_name text; new_token uuid := pg_catalog.gen_random_uuid();
begin
  executor := public.admin_high_risk_current_actor();
  select action into action_name from public.admin_high_risk_requests where operation_id = p_operation_id;
  if action_name is null then raise exception 'high-risk operation unavailable'; end if;
  perform public.admin_high_risk_require_scope(executor, action_name, 'execute');
  update public.admin_high_risk_outbox
  set state = 'leased', lease_owner = executor, lease_token = new_token, leased_at = pg_catalog.now(),
      lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => case when p_lease_seconds < 1 then 1 when p_lease_seconds > 300 then 300 else p_lease_seconds end),
      attempt_count = attempt_count + 1, updated_at = pg_catalog.now()
  where operation_id = p_operation_id and (
    state = 'queued'
    or (state = 'retry_wait' and next_attempt_at is not null and next_attempt_at <= pg_catalog.now())
    or (state = 'leased' and lease_expires_at is not null and lease_expires_at <= pg_catalog.now())
  );
  get diagnostics changed_count = row_count;
  if changed_count = 1 then return new_token; end if;
  return null;
end;
$$;

create or replace function public.mark_admin_high_risk_provider_unknown(
  p_operation_id uuid, p_provider_operation_ref_hash text, p_lease_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare changed_count integer; executor text; action_name text;
begin
  executor := public.admin_high_risk_current_actor();
  select action into action_name from public.admin_high_risk_requests where operation_id = p_operation_id;
  perform public.admin_high_risk_require_scope(executor, action_name, 'execute');
  update public.admin_high_risk_outbox
  set state = 'provider_unknown', provider_operation_ref_hash = p_provider_operation_ref_hash,
      next_attempt_at = null, lease_owner = null, lease_token = null,
      leased_at = null, lease_expires_at = null, updated_at = pg_catalog.now()
  where operation_id = p_operation_id and state in ('leased', 'provider_pending')
    and lease_owner = executor and lease_token = p_lease_token and lease_expires_at > pg_catalog.now();
  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

create or replace function public.begin_admin_high_risk_reconcile(p_operation_id uuid, p_lease_seconds integer default 30)
returns uuid language plpgsql security definer set search_path = '' as $$
declare changed_count integer; executor text; action_name text; new_token uuid := pg_catalog.gen_random_uuid();
begin
  executor := public.admin_high_risk_current_actor();
  select action into action_name from public.admin_high_risk_requests where operation_id = p_operation_id;
  perform public.admin_high_risk_require_scope(executor, action_name, 'execute');
  update public.admin_high_risk_outbox
  set state = 'reconciling', lease_owner = executor, lease_token = new_token, leased_at = pg_catalog.now(),
      lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => case when p_lease_seconds < 1 then 1 when p_lease_seconds > 300 then 300 else p_lease_seconds end), updated_at = pg_catalog.now()
  where operation_id = p_operation_id and state = 'provider_unknown';
  get diagnostics changed_count = row_count;
  if changed_count = 1 then return new_token; end if;
  return null;
end;
$$;

create or replace function public.schedule_admin_high_risk_retry(
  p_operation_id uuid, p_lease_token uuid, p_delay_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare changed_count integer; executor text; action_name text;
begin
  executor := public.admin_high_risk_current_actor();
  select action into action_name from public.admin_high_risk_requests where operation_id = p_operation_id;
  perform public.admin_high_risk_require_scope(executor, action_name, 'execute');
  update public.admin_high_risk_outbox
  set state = 'retry_wait', next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(secs => case when p_delay_seconds < 1 then 1 when p_delay_seconds > 86400 then 86400 else p_delay_seconds end),
      lease_owner = null, lease_token = null, leased_at = null, lease_expires_at = null, updated_at = pg_catalog.now()
  where operation_id = p_operation_id and state in ('leased', 'provider_pending')
    and lease_owner = executor and lease_token = p_lease_token and lease_expires_at > pg_catalog.now();
  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

create or replace function public.finish_admin_high_risk_operation(
  p_operation_id uuid, p_result text, p_lease_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare outbox_row public.admin_high_risk_outbox%rowtype; request_row public.admin_high_risk_requests%rowtype; approval_row public.admin_high_risk_approvals%rowtype; executor text; required_scope text;
begin
  if p_result not in ('succeeded', 'failed', 'needs_review') then raise exception 'invalid terminal result'; end if;
  executor := public.admin_high_risk_current_actor();
  select * into outbox_row from public.admin_high_risk_outbox where operation_id = p_operation_id for update;
  if not found then raise exception 'high-risk operation unavailable'; end if;
  if outbox_row.state in ('succeeded', 'failed', 'needs_review') then return false; end if;
  if outbox_row.state not in ('provider_pending', 'reconciling', 'leased') then raise exception 'invalid terminal transition'; end if;
  select * into request_row from public.admin_high_risk_requests where operation_id = p_operation_id for update;
  if not found then raise exception 'high-risk request unavailable'; end if;
  required_scope := public.admin_high_risk_require_scope(executor, request_row.action, 'execute');
  if outbox_row.lease_owner <> executor or outbox_row.lease_token <> p_lease_token or outbox_row.lease_expires_at <= pg_catalog.now() then
    raise exception 'stale or foreign execution lease';
  end if;
  select * into approval_row from public.admin_high_risk_approvals
  where request_id = request_row.id and request_version = request_row.version and decision = 'approved';
  if not found or approval_row.payload_hash <> request_row.payload_hash then raise exception 'approved immutable payload unavailable'; end if;
  insert into public.admin_high_risk_receipts(operation_id, action, scope_hash, requester_ref, approver_ref, executor_ref, result)
  values (p_operation_id, request_row.action, pg_catalog.encode(extensions.digest(required_scope, 'sha256'), 'hex'), request_row.requester_ref, approval_row.approver_ref, executor, p_result);
  update public.admin_high_risk_outbox set state = p_result, lease_owner = null, lease_token = null, leased_at = null, lease_expires_at = null, updated_at = pg_catalog.now() where operation_id = p_operation_id;
  update public.admin_high_risk_requests set state = p_result, updated_at = pg_catalog.now() where operation_id = p_operation_id;
  return true;
end;
$$;

alter table public.admin_high_risk_actor_scopes enable row level security;
alter table public.admin_step_up_sessions enable row level security;
alter table public.admin_high_risk_requests enable row level security;
alter table public.admin_high_risk_approvals enable row level security;
alter table public.admin_high_risk_outbox enable row level security;
alter table public.admin_high_risk_receipts enable row level security;

revoke all on public.admin_high_risk_actor_scopes, public.admin_step_up_sessions,
  public.admin_high_risk_requests, public.admin_high_risk_approvals,
  public.admin_high_risk_outbox, public.admin_high_risk_receipts from anon, authenticated, service_role;
revoke all on function public.guard_admin_high_risk_approval() from public, anon, authenticated;
revoke all on function public.deny_admin_high_risk_immutable_change() from public, anon, authenticated;
revoke all on function public.admin_high_risk_required_scope(text,text) from public, anon, authenticated;
revoke all on function public.admin_high_risk_current_actor() from public, anon, authenticated;
revoke all on function public.admin_high_risk_require_scope(text,text,text) from public, anon, authenticated;
revoke all on function public.create_admin_high_risk_request(uuid,text,text,integer,timestamptz) from public, anon, authenticated;
revoke all on function public.approve_admin_high_risk_request(uuid,integer,text) from public, anon, authenticated;
revoke all on function public.claim_admin_high_risk_operation(uuid,integer) from public, anon, authenticated;
revoke all on function public.mark_admin_high_risk_provider_unknown(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.begin_admin_high_risk_reconcile(uuid,integer) from public, anon, authenticated;
revoke all on function public.schedule_admin_high_risk_retry(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.finish_admin_high_risk_operation(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.create_admin_high_risk_request(uuid,text,text,integer,timestamptz) to service_role;
grant execute on function public.approve_admin_high_risk_request(uuid,integer,text) to service_role;
grant execute on function public.claim_admin_high_risk_operation(uuid,integer) to service_role;
grant execute on function public.mark_admin_high_risk_provider_unknown(uuid,text,uuid) to service_role;
grant execute on function public.begin_admin_high_risk_reconcile(uuid,integer) to service_role;
grant execute on function public.schedule_admin_high_risk_retry(uuid,uuid,integer) to service_role;
grant execute on function public.finish_admin_high_risk_operation(uuid,text,uuid) to service_role;

comment on table public.admin_high_risk_outbox is
  'Durable saga/outbox only. Database transactions do not atomicize PortOne or Auth external effects. provider_unknown permits reconcile only, never blind retry.';
