-- Source-only: server-owned readiness test booking evidence and the v1 day-7
-- activity ledger. Apply only through a separately approved migration gate.

alter table public.appointments
  add column if not exists purpose text not null default 'booking',
  add column if not exists created_by_owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists owner_request_id uuid,
  add column if not exists marketing_acquisition_id uuid references public.marketing_acquisitions(acquisition_id) on delete set null;

alter table public.appointments
  drop constraint if exists appointments_owner_readiness_test_shape_check;
alter table public.appointments
  add constraint appointments_owner_readiness_test_shape_check check (
    (purpose = 'booking'
      and created_by_owner_user_id is null
      and owner_request_id is null
      and marketing_acquisition_id is null)
    or
    (purpose = 'owner_readiness_test'
      and source = 'owner'
      and created_by_owner_user_id is not null
      and owner_request_id is not null)
  );

create unique index if not exists appointments_owner_readiness_request_unique
  on public.appointments(shop_id, created_by_owner_user_id, owner_request_id)
  where purpose = 'owner_readiness_test';

create or replace function pm_marketing_private.bind_owner_readiness_appointment_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acquisition_id uuid;
begin
  if new.purpose = 'booking' then
    if new.created_by_owner_user_id is not null
       or new.owner_request_id is not null
       or new.marketing_acquisition_id is not null then
      raise exception 'PM_OWNER_READINESS_MARKER_FORBIDDEN';
    end if;
    return new;
  end if;

  if new.purpose <> 'owner_readiness_test'
     or new.source <> 'owner'
     or new.created_by_owner_user_id is null
     or new.owner_request_id is null then
    raise exception 'PM_OWNER_READINESS_MARKER_INVALID';
  end if;
  if not exists (
    select 1 from public.shops
     where id = new.shop_id and owner_user_id = new.created_by_owner_user_id
  ) then
    raise exception 'PM_OWNER_READINESS_TENANT_MISMATCH';
  end if;

  select acquisition_id into v_acquisition_id
    from public.marketing_acquisition_bindings
   where shop_id = new.shop_id
     and owner_user_id = new.created_by_owner_user_id;
  new.marketing_acquisition_id := v_acquisition_id;
  return new;
end;
$$;

drop trigger if exists appointments_bind_owner_readiness_evidence on public.appointments;
create trigger appointments_bind_owner_readiness_evidence
before insert or update of purpose, source, shop_id, created_by_owner_user_id, owner_request_id, marketing_acquisition_id
on public.appointments
for each row execute function pm_marketing_private.bind_owner_readiness_appointment_v1();

create table if not exists public.owner_operational_activity_events (
  event_id uuid primary key default gen_random_uuid(),
  acquisition_id uuid not null references public.marketing_acquisitions(acquisition_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references public.shops(id) on delete cascade,
  activity_source text not null check (activity_source in (
    'operating_hours', 'staff_hours', 'services', 'test_booking'
  )),
  request_key text not null check (request_key ~ '^[0-9a-f]{64}$'),
  activity_date_kst date not null,
  occurred_at timestamptz not null default clock_timestamp(),
  unique (owner_user_id, shop_id, activity_source, request_key)
);

alter table public.owner_operational_activity_events enable row level security;
revoke all on table public.owner_operational_activity_events from public, anon, authenticated;
grant select, insert on table public.owner_operational_activity_events to service_role;

create or replace function pm_marketing_private.record_owner_operational_activity_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_activity_source text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acquisition_id uuid;
  v_inserted int := 0;
begin
  if p_owner_user_id is null
     or nullif(btrim(p_shop_id), '') is null
     or p_activity_source not in ('operating_hours', 'staff_hours', 'services', 'test_booking')
     or p_request_key !~ '^[0-9a-f]{64}$' then
    raise exception 'PM_OWNER_ACTIVITY_INVALID';
  end if;
  if not exists (
    select 1 from public.shops
     where id = p_shop_id and owner_user_id = p_owner_user_id
  ) then
    raise exception 'PM_OWNER_ACTIVITY_TENANT_MISMATCH';
  end if;

  select acquisition_id into v_acquisition_id
    from public.marketing_acquisition_bindings
   where shop_id = p_shop_id and owner_user_id = p_owner_user_id;
  if not found then
    return jsonb_build_object('status', 'not_bound');
  end if;

  insert into public.owner_operational_activity_events (
    acquisition_id, owner_user_id, shop_id, activity_source, request_key, activity_date_kst
  ) values (
    v_acquisition_id, p_owner_user_id, p_shop_id, p_activity_source, p_request_key,
    (clock_timestamp() at time zone 'Asia/Seoul')::date
  ) on conflict (owner_user_id, shop_id, activity_source, request_key) do nothing;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('status', case when v_inserted = 1 then 'recorded' else 'duplicate' end);
end;
$$;

create or replace function pm_marketing_private.evaluate_marketing_day7_activation_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_rule_version text,
  p_event_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acquisition_id uuid;
  v_signup_completed_at timestamptz;
  v_inserted int := 0;
begin
  if p_owner_user_id is null
     or nullif(btrim(p_shop_id), '') is null
     or p_rule_version <> 'day7_v1'
     or p_event_key !~ '^activated_day_7:[0-9a-f]{64}$' then
    raise exception 'PM_DAY7_ACTIVATION_INVALID';
  end if;
  if not exists (
    select 1 from public.shops
     where id = p_shop_id and owner_user_id = p_owner_user_id
  ) then
    raise exception 'PM_DAY7_ACTIVATION_TENANT_MISMATCH';
  end if;

  select b.acquisition_id, e.occurred_at
    into v_acquisition_id, v_signup_completed_at
    from public.marketing_acquisition_bindings b
    join public.marketing_acquisition_events e
      on e.acquisition_id = b.acquisition_id
     and e.shop_id = b.shop_id
     and e.event_name = 'signup_completed'
   where b.owner_user_id = p_owner_user_id
     and b.shop_id = p_shop_id
   order by e.occurred_at asc
   limit 1;
  if not found then
    return jsonb_build_object('status', 'not_bound');
  end if;
  if clock_timestamp() < v_signup_completed_at + interval '168 hours' then
    return jsonb_build_object('status', 'not_due');
  end if;
  if (
    select count(distinct e.step_key)
      from public.marketing_acquisition_events e
     where e.acquisition_id = v_acquisition_id
       and e.shop_id = p_shop_id
       and e.event_name = 'setup_step_completed'
       and e.step_key in ('operating_hours', 'staff_hours', 'services')
  ) <> 3 then
    return jsonb_build_object('status', 'not_ready');
  end if;
  if not exists (
    select 1 from public.appointments a
     where a.shop_id = p_shop_id
       and a.status not in ('cancelled', 'rejected', 'noshow')
  ) then
    return jsonb_build_object('status', 'not_ready');
  end if;
  if (
    select count(distinct a.activity_date_kst)
      from public.owner_operational_activity_events a
     where a.acquisition_id = v_acquisition_id
       and a.owner_user_id = p_owner_user_id
       and a.shop_id = p_shop_id
       and a.occurred_at >= v_signup_completed_at
  ) < 2 then
    return jsonb_build_object('status', 'not_ready');
  end if;

  insert into public.marketing_acquisition_events (
    acquisition_id, shop_id, event_name, event_key, days_from_signup, activation_rule_version
  ) values (
    v_acquisition_id, p_shop_id, 'activated_day_7', p_event_key, 7, p_rule_version
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('status', case when v_inserted = 1 then 'recorded' else 'duplicate' end);
end;
$$;

create or replace function public.record_owner_operational_activity_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_activity_source text,
  p_request_key text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select pm_marketing_private.record_owner_operational_activity_v1(
  p_owner_user_id, p_shop_id, p_activity_source, p_request_key
) $$;

create or replace function public.evaluate_marketing_day7_activation_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_rule_version text,
  p_event_key text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select pm_marketing_private.evaluate_marketing_day7_activation_v1(
  p_owner_user_id, p_shop_id, p_rule_version, p_event_key
) $$;

revoke execute on function pm_marketing_private.bind_owner_readiness_appointment_v1() from public, anon, authenticated;
revoke execute on function pm_marketing_private.record_owner_operational_activity_v1(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function pm_marketing_private.evaluate_marketing_day7_activation_v1(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_owner_operational_activity_v1(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.evaluate_marketing_day7_activation_v1(uuid, text, text, text) from public, anon, authenticated;
grant usage on schema pm_marketing_private to service_role;
grant execute on function pm_marketing_private.bind_owner_readiness_appointment_v1() to service_role;
grant execute on function pm_marketing_private.record_owner_operational_activity_v1(uuid, text, text, text) to service_role;
grant execute on function pm_marketing_private.evaluate_marketing_day7_activation_v1(uuid, text, text, text) to service_role;
grant execute on function public.record_owner_operational_activity_v1(uuid, text, text, text) to service_role;
grant execute on function public.evaluate_marketing_day7_activation_v1(uuid, text, text, text) to service_role;
