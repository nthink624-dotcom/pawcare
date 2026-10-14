create table public.operational_error_events (
  id uuid primary key default gen_random_uuid(),
  project_name text not null check (project_name in ('web', 'mobile')),
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_.-]{0,119}$'),
  http_status integer check (http_status between 400 and 599),
  release_id text not null check (release_id ~ '^([a-f0-9]{7,64}|local|unknown)$'),
  created_at timestamptz not null default now()
);
create index operational_error_events_created_at_idx on public.operational_error_events (created_at desc, id desc);
alter table public.operational_error_events enable row level security;
revoke all on public.operational_error_events from public, anon, authenticated;
grant select, insert, delete on public.operational_error_events to service_role;

create function public.cleanup_operational_error_events_v1()
returns integer language plpgsql security invoker set search_path = '' as $$
declare removed integer; overflow_removed integer;
begin
  perform pg_advisory_xact_lock(734912661);
  delete from public.operational_error_events where created_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  delete from public.operational_error_events where id in (
    select id from public.operational_error_events order by created_at desc, id desc offset 5000
  );
  get diagnostics overflow_removed = row_count;
  return removed + overflow_removed;
end;
$$;
revoke all on function public.cleanup_operational_error_events_v1() from public, anon, authenticated;
grant execute on function public.cleanup_operational_error_events_v1() to service_role;

create function public.bound_operational_error_events_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform public.cleanup_operational_error_events_v1();
  return null;
end;
$$;
revoke all on function public.bound_operational_error_events_v1() from public, anon, authenticated;
create trigger operational_error_events_retention after insert on public.operational_error_events
for each statement execute function public.bound_operational_error_events_v1();
