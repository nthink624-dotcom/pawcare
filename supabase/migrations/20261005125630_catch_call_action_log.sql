-- Keep the owner's notification choice separate from append-only call events.
-- Caller numbers and provider payloads are intentionally not copied here.
create table if not exists public.call_event_actions (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  integration_id uuid not null references public.call_integrations(id) on delete cascade,
  call_event_id uuid not null unique references public.call_events(id) on delete cascade,
  action text not null check (action in ('reservation_selected', 'phone_only_selected')),
  selected_by_user_id uuid references auth.users(id) on delete set null,
  selected_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists call_event_actions_shop_selected_idx
  on public.call_event_actions(shop_id, selected_at desc);

create or replace function public.assert_call_event_action_scope_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.call_events event
     where event.id = new.call_event_id
       and event.shop_id = new.shop_id
       and event.integration_id = new.integration_id
       and event.event_type = 'incoming'
       and event.match_status = 'matched'
  ) then
    raise exception 'PM_CALL_EVENT_ACTION_SCOPE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists call_event_actions_scope_guard on public.call_event_actions;
create trigger call_event_actions_scope_guard
before insert on public.call_event_actions
for each row execute function public.assert_call_event_action_scope_v1();

revoke all on function public.assert_call_event_action_scope_v1() from public, anon, authenticated;
grant execute on function public.assert_call_event_action_scope_v1() to service_role;

alter table public.call_event_actions enable row level security;
revoke all on public.call_event_actions from public, anon, authenticated;
grant select, insert on public.call_event_actions to service_role;

comment on table public.call_event_actions is
  'Append-only owner choices for CatchCall. Stores no caller number or provider payload.';
