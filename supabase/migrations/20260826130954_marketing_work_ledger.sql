create table if not exists public.marketing_work_items (
  work_id text primary key check (work_id ~ '^[A-Z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 1 and 120),
  owner_team text not null check (char_length(owner_team) between 1 and 60),
  parent_work_id text references public.marketing_work_items(work_id),
  role_label text not null check (char_length(role_label) between 1 and 40),
  status text not null check (status in ('not_started','in_progress','blocked','review','approval_waiting','approved','rejected','completed')),
  current_stage text not null check (char_length(current_stage) between 1 and 100),
  completed_summary text,
  blocker_summary text,
  next_action text,
  source_system text not null check (source_system in ('growth','analysis','codex','mastra','operations')),
  source_type text not null default 'operational' check (source_type = 'operational'),
  sync_state text not null default 'sync_limited' check (sync_state in ('connected','sync_limited','source_unavailable')),
  original_directive_summary text,
  operations_directive_summary text,
  approval_required boolean not null default false,
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_work_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 160),
  work_id text not null references public.marketing_work_items(work_id),
  parent_work_id text references public.marketing_work_items(work_id),
  source_sequence bigint not null check (source_sequence >= 0),
  event_type text not null check (event_type in ('directive_created','directive_received','status_changed','artifact_ready','review_requested','approval_waiting','completed','archived','restored')),
  status text check (status is null or status in ('not_started','in_progress','blocked','review','approval_waiting','approved','rejected','completed')),
  safe_summary text check (safe_summary is null or char_length(safe_summary) <= 500),
  source_system text not null check (source_system in ('growth','analysis','codex','mastra','operations')),
  source_type text not null default 'operational' check (source_type = 'operational'),
  source_event_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_work_approvals (
  id uuid primary key default gen_random_uuid(),
  work_id text not null references public.marketing_work_items(work_id),
  approval_key text not null,
  version integer not null check (version > 0),
  scope_summary text not null check (char_length(scope_summary) between 1 and 300),
  decision text not null check (decision in ('approval_waiting','approved','rejected','revise','hold')),
  decided_by_admin_id uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (approval_key, version)
);

create table if not exists public.marketing_work_artifacts (
  id uuid primary key default gen_random_uuid(),
  work_id text not null references public.marketing_work_items(work_id),
  artifact_type text not null check (artifact_type in ('screen_preview','image','document')),
  title text not null check (char_length(title) between 1 and 120),
  safe_path text not null check (safe_path ~ '^/[a-z0-9/._-]+$'),
  version text,
  review_status text not null check (review_status in ('preparing','reviewable','revision_required','confirmed')),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_work_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.marketing_work_events(id),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','claimed','delivered','failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_work_items enable row level security;
alter table public.marketing_work_events enable row level security;
alter table public.marketing_work_approvals enable row level security;
alter table public.marketing_work_artifacts enable row level security;
alter table public.marketing_work_outbox enable row level security;

revoke all on public.marketing_work_items from anon, authenticated;
revoke all on public.marketing_work_events from anon, authenticated;
revoke all on public.marketing_work_approvals from anon, authenticated;
revoke all on public.marketing_work_artifacts from anon, authenticated;
revoke all on public.marketing_work_outbox from anon, authenticated;

create index if not exists marketing_work_items_active_updated_idx on public.marketing_work_items (updated_at desc) where archived_at is null;
create index if not exists marketing_work_events_work_created_idx on public.marketing_work_events (work_id, created_at desc);
create index if not exists marketing_work_events_replay_idx on public.marketing_work_events (source_sequence, source_event_at, id);
create index if not exists marketing_work_outbox_delivery_idx on public.marketing_work_outbox (delivery_status, available_at);

do $$
begin
  alter publication supabase_realtime add table public.marketing_work_items;
exception
  when duplicate_object then null;
end $$;

create or replace function public.ingest_marketing_work_event(
  p_idempotency_key text,
  p_work_id text,
  p_title text,
  p_owner_team text,
  p_parent_work_id text,
  p_role_label text,
  p_status text,
  p_current_stage text,
  p_completed_summary text,
  p_blocker_summary text,
  p_next_action text,
  p_source_system text,
  p_source_sequence bigint,
  p_event_type text,
  p_sync_state text,
  p_original_directive_summary text,
  p_operations_directive_summary text,
  p_approval_required boolean,
  p_source_event_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
begin
  if p_source_sequence < 0 then raise exception 'invalid source sequence'; end if;
  select id into v_event_id from public.marketing_work_events where idempotency_key = p_idempotency_key;
  if v_event_id is not null then return v_event_id; end if;

  insert into public.marketing_work_items (work_id, title, owner_team, parent_work_id, role_label, status, current_stage, completed_summary, blocker_summary, next_action, source_system, source_type, sync_state, original_directive_summary, operations_directive_summary, approval_required, source_updated_at)
  values (p_work_id, p_title, p_owner_team, p_parent_work_id, p_role_label, p_status, p_current_stage, p_completed_summary, p_blocker_summary, p_next_action, p_source_system, 'operational', p_sync_state, p_original_directive_summary, p_operations_directive_summary, p_approval_required, p_source_event_at)
  on conflict (work_id) do update set
    title = excluded.title,
    owner_team = excluded.owner_team,
    parent_work_id = excluded.parent_work_id,
    role_label = excluded.role_label,
    status = excluded.status,
    current_stage = excluded.current_stage,
    completed_summary = excluded.completed_summary,
    blocker_summary = excluded.blocker_summary,
    next_action = excluded.next_action,
    source_system = excluded.source_system,
    sync_state = excluded.sync_state,
    original_directive_summary = excluded.original_directive_summary,
    operations_directive_summary = excluded.operations_directive_summary,
    approval_required = excluded.approval_required,
    source_updated_at = excluded.source_updated_at,
    version = public.marketing_work_items.version + 1,
    updated_at = now()
  where excluded.source_updated_at >= public.marketing_work_items.source_updated_at;

  insert into public.marketing_work_events (idempotency_key, work_id, parent_work_id, source_sequence, event_type, status, safe_summary, source_system, source_type, source_event_at)
  values (p_idempotency_key, p_work_id, p_parent_work_id, p_source_sequence, p_event_type, p_status, p_current_stage, p_source_system, 'operational', p_source_event_at)
  returning id into v_event_id;

  insert into public.marketing_work_outbox (event_id) values (v_event_id);
  return v_event_id;
exception
  when unique_violation then
    select id into v_event_id from public.marketing_work_events where idempotency_key = p_idempotency_key;
    return v_event_id;
end;
$$;

revoke all on function public.ingest_marketing_work_event(text,text,text,text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.ingest_marketing_work_event(text,text,text,text,text,text,text,text,text,text,text,text,bigint,text,text,text,text,boolean,timestamptz) to service_role;
