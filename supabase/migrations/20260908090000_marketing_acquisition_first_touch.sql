-- Source-only foundation for immutable, PII-free first-touch acquisition attribution.
-- Apply to Development and Production only through their separately approved migration gates.

create schema if not exists pm_marketing_private;
revoke all on schema pm_marketing_private from public, anon, authenticated;

create table if not exists public.marketing_acquisitions (
  acquisition_id uuid primary key,
  source_kind text not null check (source_kind in ('direct', 'utm')),
  utm_source text check (utm_source is null or (length(utm_source) between 1 and 64 and utm_source ~ '^[a-z0-9][a-z0-9._~-]*$')),
  utm_medium text check (utm_medium is null or (length(utm_medium) between 1 and 64 and utm_medium ~ '^[a-z0-9][a-z0-9._~-]*$')),
  utm_campaign text check (utm_campaign is null or (length(utm_campaign) between 1 and 128 and utm_campaign ~ '^[a-z0-9][a-z0-9._~-]*$')),
  utm_content text check (utm_content is null or (length(utm_content) between 1 and 128 and utm_content ~ '^[a-z0-9][a-z0-9._~-]*$')),
  utm_term text check (utm_term is null or (length(utm_term) between 1 and 128 and utm_term ~ '^[a-z0-9][a-z0-9._~-]*$')),
  first_seen_at timestamptz not null default now(),
  constraint marketing_acquisitions_source_shape_check check (
    (source_kind = 'direct' and num_nonnulls(utm_source, utm_medium, utm_campaign, utm_content, utm_term) = 0)
    or
    (source_kind = 'utm' and num_nonnulls(utm_source, utm_medium, utm_campaign, utm_content, utm_term) >= 1)
  )
);

create table if not exists public.marketing_acquisition_bindings (
  acquisition_id uuid primary key references public.marketing_acquisitions(acquisition_id) on delete cascade,
  signup_request_id uuid not null unique references public.signup_idempotency_requests(signup_request_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null unique references public.shops(id) on delete cascade,
  bound_at timestamptz not null default now()
);

create table if not exists public.marketing_acquisition_events (
  event_id uuid primary key default gen_random_uuid(),
  acquisition_id uuid not null references public.marketing_acquisitions(acquisition_id) on delete cascade,
  shop_id text references public.shops(id) on delete set null,
  event_name text not null check (event_name in (
    'landing_view',
    'landing_cta_click',
    'identity_verified',
    'signup_completed',
    'setup_step_completed',
    'test_booking_created',
    'activated_day_7',
    'paid_conversion'
  )),
  event_key text not null check (length(event_key) between 1 and 96 and event_key ~ '^[a-z0-9_:-]+$'),
  cta_id text check (cta_id is null or cta_id = 'signup'),
  step_key text check (step_key is null or step_key in ('operating_hours', 'staff_hours', 'services', 'test_booking')),
  booking_source text check (booking_source is null or booking_source in ('owner', 'customer')),
  plan_code text check (plan_code is null or (length(plan_code) between 1 and 32 and plan_code ~ '^[a-z0-9_-]+$')),
  days_from_signup smallint check (days_from_signup is null or days_from_signup between 0 and 3650),
  activation_rule_version text check (
    activation_rule_version is null
    or (length(activation_rule_version) between 1 and 32 and activation_rule_version ~ '^[a-z0-9._-]+$')
  ),
  occurred_at timestamptz not null default now(),
  unique (acquisition_id, event_key)
);

create unique index if not exists marketing_acquisition_authoritative_event_key_unique
  on public.marketing_acquisition_events(event_key)
  where event_name not in ('landing_view', 'landing_cta_click');

alter table public.marketing_acquisitions enable row level security;
alter table public.marketing_acquisition_bindings enable row level security;
alter table public.marketing_acquisition_events enable row level security;

revoke all on table public.marketing_acquisitions from public, anon, authenticated;
revoke all on table public.marketing_acquisition_bindings from public, anon, authenticated;
revoke all on table public.marketing_acquisition_events from public, anon, authenticated;
grant select, insert on table public.marketing_acquisitions to service_role;
grant select, insert on table public.marketing_acquisition_bindings to service_role;
grant select, insert on table public.marketing_acquisition_events to service_role;

create or replace function pm_marketing_private.record_marketing_acquisition_touch_v1(
  p_acquisition_id uuid,
  p_source_kind text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_content text,
  p_utm_term text,
  p_event_name text,
  p_event_key text,
  p_cta_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int := 0;
begin
  if p_acquisition_id is null
     or p_event_name not in ('landing_view', 'landing_cta_click')
     or p_event_key not in ('landing_view', 'landing_cta_click:signup')
     or (p_event_name = 'landing_view' and p_cta_id is not null)
     or (p_event_name = 'landing_cta_click' and p_cta_id is distinct from 'signup') then
    raise exception 'PM_ACQUISITION_INVALID_TOUCH';
  end if;

  insert into public.marketing_acquisitions (
    acquisition_id, source_kind, utm_source, utm_medium, utm_campaign, utm_content, utm_term
  ) values (
    p_acquisition_id, p_source_kind, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term
  ) on conflict (acquisition_id) do nothing;

  insert into public.marketing_acquisition_events (
    acquisition_id, event_name, event_key, cta_id
  ) values (
    p_acquisition_id, p_event_name, p_event_key, p_cta_id
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('status', case when v_inserted = 1 then 'recorded' else 'duplicate' end);
end;
$$;

create or replace function pm_marketing_private.record_marketing_acquisition_identity_v1(
  p_acquisition_id uuid,
  p_event_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int := 0;
begin
  if p_acquisition_id is null or p_event_key !~ '^identity_verified:[0-9a-f]{64}$' then
    raise exception 'PM_ACQUISITION_INVALID_IDENTITY_EVENT';
  end if;
  if not exists (select 1 from public.marketing_acquisitions where acquisition_id = p_acquisition_id) then
    raise exception 'PM_ACQUISITION_UNKNOWN';
  end if;

  insert into public.marketing_acquisition_events (acquisition_id, event_name, event_key)
  values (p_acquisition_id, 'identity_verified', p_event_key)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('status', case when v_inserted = 1 then 'recorded' else 'duplicate' end);
end;
$$;

create or replace function pm_marketing_private.bind_marketing_acquisition_signup_v1(
  p_acquisition_id uuid,
  p_signup_request_id uuid,
  p_owner_user_id uuid,
  p_shop_id text,
  p_event_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_signup public.signup_idempotency_requests%rowtype;
  v_binding public.marketing_acquisition_bindings%rowtype;
  v_inserted int := 0;
begin
  if p_acquisition_id is null or p_signup_request_id is null or p_owner_user_id is null
     or nullif(trim(p_shop_id), '') is null
     or p_event_key !~ '^signup_completed:[0-9a-f]{64}$' then
    raise exception 'PM_ACQUISITION_INVALID_SIGNUP_BINDING';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('marketing-acquisition:' || p_acquisition_id::text, 0));
  select * into v_signup
    from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id
   for update;
  if not found or v_signup.status <> 'completed'
     or v_signup.auth_user_id is distinct from p_owner_user_id
     or v_signup.shop_id is distinct from p_shop_id then
    raise exception 'PM_ACQUISITION_SIGNUP_AUTHORITY_MISMATCH';
  end if;
  if not exists (
    select 1 from public.shops
     where id = p_shop_id and owner_user_id = p_owner_user_id
  ) then
    raise exception 'PM_ACQUISITION_TENANT_MISMATCH';
  end if;
  if not exists (select 1 from public.marketing_acquisitions where acquisition_id = p_acquisition_id) then
    raise exception 'PM_ACQUISITION_UNKNOWN';
  end if;

  select * into v_binding
    from public.marketing_acquisition_bindings
   where acquisition_id = p_acquisition_id
      or signup_request_id = p_signup_request_id
      or shop_id = p_shop_id
   for update;
  if found then
    if v_binding.acquisition_id = p_acquisition_id
       and v_binding.signup_request_id = p_signup_request_id
       and v_binding.owner_user_id = p_owner_user_id
       and v_binding.shop_id = p_shop_id then
      return jsonb_build_object('status', 'duplicate');
    end if;
    raise exception 'PM_ACQUISITION_FOREIGN_BINDING';
  end if;

  insert into public.marketing_acquisition_bindings (
    acquisition_id, signup_request_id, owner_user_id, shop_id
  ) values (
    p_acquisition_id, p_signup_request_id, p_owner_user_id, p_shop_id
  );
  insert into public.marketing_acquisition_events (
    acquisition_id, shop_id, event_name, event_key
  ) values (
    p_acquisition_id, p_shop_id, 'signup_completed', p_event_key
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('status', case when v_inserted = 1 then 'recorded' else 'duplicate' end);
end;
$$;

create or replace function pm_marketing_private.record_bound_marketing_acquisition_milestone_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_event_name text,
  p_event_key text,
  p_step_key text,
  p_booking_source text,
  p_plan_code text,
  p_days_from_signup smallint,
  p_activation_rule_version text
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
  if p_owner_user_id is null or nullif(trim(p_shop_id), '') is null
     or p_event_name not in ('setup_step_completed', 'test_booking_created', 'activated_day_7', 'paid_conversion')
     or p_event_key !~ ('^' || p_event_name || ':[0-9a-f]{64}$') then
    raise exception 'PM_ACQUISITION_INVALID_MILESTONE';
  end if;
  if (p_event_name = 'setup_step_completed' and p_step_key is null)
     or (p_event_name = 'test_booking_created' and p_booking_source is null)
     or (p_event_name = 'activated_day_7' and (p_days_from_signup is distinct from 7 or p_activation_rule_version is null))
     or (p_event_name = 'paid_conversion' and p_plan_code is null) then
    raise exception 'PM_ACQUISITION_MILESTONE_CONTEXT_REQUIRED';
  end if;

  select acquisition_id into v_acquisition_id
    from public.marketing_acquisition_bindings
   where owner_user_id = p_owner_user_id and shop_id = p_shop_id;
  if not found or not exists (
    select 1 from public.shops where id = p_shop_id and owner_user_id = p_owner_user_id
  ) then
    raise exception 'PM_ACQUISITION_TENANT_MISMATCH';
  end if;

  insert into public.marketing_acquisition_events (
    acquisition_id, shop_id, event_name, event_key, step_key, booking_source,
    plan_code, days_from_signup, activation_rule_version
  ) values (
    v_acquisition_id, p_shop_id, p_event_name, p_event_key, p_step_key, p_booking_source,
    p_plan_code, p_days_from_signup, p_activation_rule_version
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('status', case when v_inserted = 1 then 'recorded' else 'duplicate' end);
end;
$$;

create or replace function public.record_marketing_acquisition_touch_v1(
  p_acquisition_id uuid, p_source_kind text,
  p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null,
  p_utm_content text default null, p_utm_term text default null,
  p_event_name text default 'landing_view', p_event_key text default 'landing_view', p_cta_id text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select pm_marketing_private.record_marketing_acquisition_touch_v1(
  p_acquisition_id, p_source_kind, p_utm_source, p_utm_medium, p_utm_campaign,
  p_utm_content, p_utm_term, p_event_name, p_event_key, p_cta_id
) $$;

create or replace function public.record_marketing_acquisition_identity_v1(p_acquisition_id uuid, p_event_key text)
returns jsonb language sql security invoker set search_path = ''
as $$ select pm_marketing_private.record_marketing_acquisition_identity_v1(p_acquisition_id, p_event_key) $$;

create or replace function public.bind_marketing_acquisition_signup_v1(
  p_acquisition_id uuid, p_signup_request_id uuid, p_owner_user_id uuid, p_shop_id text, p_event_key text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select pm_marketing_private.bind_marketing_acquisition_signup_v1(
  p_acquisition_id, p_signup_request_id, p_owner_user_id, p_shop_id, p_event_key
) $$;

create or replace function public.record_bound_marketing_acquisition_milestone_v1(
  p_owner_user_id uuid, p_shop_id text, p_event_name text, p_event_key text,
  p_step_key text default null, p_booking_source text default null, p_plan_code text default null,
  p_days_from_signup smallint default null, p_activation_rule_version text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select pm_marketing_private.record_bound_marketing_acquisition_milestone_v1(
  p_owner_user_id, p_shop_id, p_event_name, p_event_key, p_step_key,
  p_booking_source, p_plan_code, p_days_from_signup, p_activation_rule_version
) $$;

revoke execute on all functions in schema pm_marketing_private from public, anon, authenticated;
grant usage on schema pm_marketing_private to service_role;
grant execute on all functions in schema pm_marketing_private to service_role;

revoke execute on function public.record_marketing_acquisition_touch_v1(uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_marketing_acquisition_identity_v1(uuid, text) from public, anon, authenticated;
revoke execute on function public.bind_marketing_acquisition_signup_v1(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.record_bound_marketing_acquisition_milestone_v1(uuid, text, text, text, text, text, text, smallint, text) from public, anon, authenticated;
grant execute on function public.record_marketing_acquisition_touch_v1(uuid, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.record_marketing_acquisition_identity_v1(uuid, text) to service_role;
grant execute on function public.bind_marketing_acquisition_signup_v1(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.record_bound_marketing_acquisition_milestone_v1(uuid, text, text, text, text, text, text, smallint, text) to service_role;
