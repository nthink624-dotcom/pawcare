-- Source-only authority for the approved 20-shop pilot cohort.
-- This migration deliberately keeps cohort membership, pre-payment 30/3/60
-- benefits, and the first-paid +30 benefit as separate idempotent ledgers.

create table public.owner_pilot_cohort_memberships (
  shop_id text primary key references public.shops(id) on delete cascade,
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  cohort_position smallint not null unique check (cohort_position between 1 and 20),
  status text not null check (status in ('planned', 'active', 'paused', 'completed', 'excluded')),
  recognition_state text not null default 'not_decided'
    check (recognition_state in ('not_decided', 'not_evaluated')),
  created_by_admin_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.owner_pilot_cohort_membership_events (
  event_id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  shop_id text not null references public.owner_pilot_cohort_memberships(shop_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status_before text check (status_before is null or status_before in ('planned', 'active', 'paused', 'completed', 'excluded')),
  status_after text not null check (status_after in ('planned', 'active', 'paused', 'completed', 'excluded')),
  reason text not null check (char_length(trim(reason)) between 3 and 300),
  created_by_admin_email text not null,
  created_at timestamptz not null default now()
);

create table public.owner_pilot_feedback_events (
  feedback_event_id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  shop_id text not null references public.owner_pilot_cohort_memberships(shop_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  content_fingerprint text not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  requested_days smallint not null check (requested_days between 3 and 60),
  granted_days smallint not null default 0 check (granted_days between 0 and 60),
  outcome text not null check (outcome in (
    'granted',
    'recorded_planned',
    'recorded_paused',
    'recorded_completed',
    'recorded_excluded',
    'recorded_paid',
    'recorded_cap_reached',
    'recorded_initial_benefit_missing'
  )),
  benefit_grant_id uuid references public.owner_pilot_benefit_grants(grant_id) on delete set null,
  created_by_admin_email text not null,
  created_at timestamptz not null default now(),
  constraint owner_pilot_feedback_grant_outcome_check check (
    (outcome = 'granted' and granted_days >= 3 and benefit_grant_id is not null)
    or (outcome <> 'granted' and granted_days = 0 and benefit_grant_id is null)
  )
);

create table public.owner_pilot_first_paid_benefit_grants (
  grant_id uuid primary key default gen_random_uuid(),
  shop_id text not null unique references public.owner_pilot_cohort_memberships(shop_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  payment_id text not null unique references public.owner_payment_ledger(payment_id) on delete restrict,
  idempotency_key text not null unique,
  granted_days smallint not null default 30 check (granted_days = 30),
  grant_source text not null check (grant_source in ('pilot_cohort', 'legacy_early_partner')),
  period_ends_at_before timestamptz not null,
  period_ends_at_after timestamptz not null,
  applied_at timestamptz not null default now()
);

create index owner_pilot_cohort_membership_events_shop_created_idx
  on public.owner_pilot_cohort_membership_events(shop_id, created_at desc);
create index owner_pilot_feedback_events_shop_created_idx
  on public.owner_pilot_feedback_events(shop_id, created_at desc);

alter table public.owner_pilot_cohort_memberships enable row level security;
alter table public.owner_pilot_cohort_membership_events enable row level security;
alter table public.owner_pilot_feedback_events enable row level security;
alter table public.owner_pilot_first_paid_benefit_grants enable row level security;

revoke all on public.owner_pilot_cohort_memberships from public, anon, authenticated;
revoke all on public.owner_pilot_cohort_membership_events from public, anon, authenticated;
revoke all on public.owner_pilot_feedback_events from public, anon, authenticated;
revoke all on public.owner_pilot_first_paid_benefit_grants from public, anon, authenticated;
grant select, insert, update on public.owner_pilot_cohort_memberships to service_role;
grant select, insert on public.owner_pilot_cohort_membership_events to service_role;
grant select, insert on public.owner_pilot_feedback_events to service_role;
grant select, insert, update on public.owner_pilot_first_paid_benefit_grants to service_role;

create or replace function public.upsert_owner_pilot_cohort_membership_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_status text,
  p_reason text,
  p_admin_email text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_event public.owner_pilot_cohort_membership_events%rowtype;
  v_membership public.owner_pilot_cohort_memberships%rowtype;
  v_foreign public.owner_pilot_cohort_memberships%rowtype;
  v_status_before text;
  v_position smallint;
begin
  if current_user <> 'service_role' then
    raise exception 'PM_PILOT_COHORT_SERVICE_ROLE_REQUIRED';
  end if;
  if p_status not in ('planned', 'active', 'paused', 'completed', 'excluded') then
    raise exception 'PM_PILOT_COHORT_STATUS_INVALID';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 300
     or char_length(trim(coalesce(p_admin_email, ''))) < 3 then
    raise exception 'PM_PILOT_COHORT_REASON_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('owner_pilot_cohort:' || p_idempotency_key::text, 0)
  );

  select * into v_existing_event
    from public.owner_pilot_cohort_membership_events
   where idempotency_key = p_idempotency_key;
  if found then
    if v_existing_event.owner_user_id <> p_owner_user_id
       or v_existing_event.shop_id <> p_shop_id
       or v_existing_event.status_after <> p_status
       or v_existing_event.reason <> trim(p_reason)
       or v_existing_event.created_by_admin_email <> lower(trim(p_admin_email)) then
      raise exception 'PM_PILOT_COHORT_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'status', 'already_recorded',
      'cohortPosition', (
        select cohort_position from public.owner_pilot_cohort_memberships where shop_id = p_shop_id
      ),
      'membershipStatus', p_status
    );
  end if;

  if not exists (
    select 1
      from public.shops s
      join public.owner_shop_memberships m
        on m.shop_id = s.id
       and m.owner_user_id = p_owner_user_id
       and m.role = 'owner'
     where s.id = p_shop_id
       and s.owner_user_id = p_owner_user_id
  ) or not exists (
    select 1 from public.owner_subscriptions
     where user_id = p_owner_user_id and shop_id = p_shop_id
  ) then
    raise exception 'PM_PILOT_COHORT_OWNER_SHOP_MISMATCH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('owner_pilot_cohort_slots_v1', 0)
  );

  select * into v_membership
    from public.owner_pilot_cohort_memberships
   where shop_id = p_shop_id and owner_user_id = p_owner_user_id
   for update;

  if not found then
    select * into v_foreign
      from public.owner_pilot_cohort_memberships
     where shop_id = p_shop_id or owner_user_id = p_owner_user_id
     limit 1;
    if found then
      raise exception 'PM_PILOT_COHORT_OWNER_SHOP_MISMATCH';
    end if;

    select coalesce(max(cohort_position), 0) + 1 into v_position
      from public.owner_pilot_cohort_memberships;
    if v_position > 20 then
      raise exception 'PM_PILOT_COHORT_FULL';
    end if;
    v_status_before := null;
    insert into public.owner_pilot_cohort_memberships (
      shop_id, owner_user_id, cohort_position, status, recognition_state, created_by_admin_email
    ) values (
      p_shop_id, p_owner_user_id, v_position, p_status, 'not_decided', lower(trim(p_admin_email))
    ) returning * into v_membership;
  else
    v_status_before := v_membership.status;
    update public.owner_pilot_cohort_memberships
       set status = p_status,
           updated_at = now()
     where shop_id = p_shop_id and owner_user_id = p_owner_user_id
     returning * into v_membership;
  end if;

  insert into public.owner_pilot_cohort_membership_events (
    idempotency_key, shop_id, owner_user_id, status_before, status_after,
    reason, created_by_admin_email
  ) values (
    p_idempotency_key, p_shop_id, p_owner_user_id, v_status_before, p_status,
    trim(p_reason), lower(trim(p_admin_email))
  );

  return jsonb_build_object(
    'status', 'recorded',
    'cohortPosition', v_membership.cohort_position,
    'membershipStatus', v_membership.status
  );
end;
$$;

create or replace function public.record_owner_pilot_feedback_benefit_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_content_fingerprint text,
  p_requested_days smallint,
  p_admin_email text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_membership public.owner_pilot_cohort_memberships%rowtype;
  v_existing public.owner_pilot_feedback_events%rowtype;
  v_claim public.owner_pilot_benefit_claims%rowtype;
  v_before timestamptz;
  v_after timestamptz;
  v_grant_id uuid;
  v_outcome text;
  v_granted_days smallint := 0;
begin
  if current_user <> 'service_role' then
    raise exception 'PM_PILOT_COHORT_SERVICE_ROLE_REQUIRED';
  end if;
  if coalesce(p_content_fingerprint, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'PM_PILOT_FEEDBACK_REQUIRED';
  end if;
  if p_requested_days < 3 or p_requested_days > 60 then
    raise exception 'PM_PILOT_MIN_EXTENSION_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_admin_email, ''))) < 3 then
    raise exception 'PM_PILOT_COHORT_ADMIN_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('owner_pilot_feedback:' || p_idempotency_key::text, 0)
  );
  select * into v_existing
    from public.owner_pilot_feedback_events
   where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.owner_user_id <> p_owner_user_id
       or v_existing.shop_id <> p_shop_id
       or v_existing.content_fingerprint <> p_content_fingerprint
       or v_existing.requested_days <> p_requested_days
       or v_existing.created_by_admin_email <> lower(trim(p_admin_email)) then
      raise exception 'PM_PILOT_COHORT_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'status', 'already_recorded',
      'outcome', v_existing.outcome,
      'grantedDays', v_existing.granted_days
    );
  end if;

  select * into v_membership
    from public.owner_pilot_cohort_memberships
   where shop_id = p_shop_id and owner_user_id = p_owner_user_id
   for update;
  if not found then
    raise exception 'PM_PILOT_COHORT_MEMBERSHIP_REQUIRED';
  end if;

  if v_membership.status <> 'active' then
    v_outcome := 'recorded_' || v_membership.status;
  elsif exists (
    select 1 from public.owner_payment_ledger
     where user_id = p_owner_user_id and shop_id = p_shop_id and status = 'PAID'
  ) then
    v_outcome := 'recorded_paid';
  else
    select * into v_claim
      from public.owner_pilot_benefit_claims
     where shop_id = p_shop_id and user_id = p_owner_user_id
     for update;
    if not found then
      v_outcome := 'recorded_initial_benefit_missing';
    elsif v_claim.total_free_days + p_requested_days > 60 then
      v_outcome := 'recorded_cap_reached';
    else
      v_before := v_claim.free_ends_at;
      v_after := v_claim.free_started_at + make_interval(days => v_claim.total_free_days + p_requested_days);

      update public.owner_pilot_benefit_claims
         set total_free_days = total_free_days + p_requested_days,
             free_ends_at = v_after,
             updated_at = now()
       where shop_id = p_shop_id and user_id = p_owner_user_id;

      update public.owner_subscriptions
         set trial_ends_at = v_after,
             subscription_status = case when v_after > now() then 'trialing' else 'expired' end,
             updated_at = now()
       where shop_id = p_shop_id and user_id = p_owner_user_id;
      if not found then
        raise exception 'PM_PILOT_COHORT_OWNER_SHOP_MISMATCH';
      end if;

      insert into public.owner_pilot_benefit_grants (
        shop_id, user_id, idempotency_key, grant_kind, granted_days, reason,
        free_ends_at_before, free_ends_at_after, created_by_admin_email
      ) values (
        p_shop_id, p_owner_user_id, p_idempotency_key, 'feedback_issue', p_requested_days,
        '파일럿 피드백 접수', v_before, v_after, lower(trim(p_admin_email))
      ) returning grant_id into v_grant_id;
      v_granted_days := p_requested_days;
      v_outcome := 'granted';
    end if;
  end if;

  insert into public.owner_pilot_feedback_events (
    idempotency_key, shop_id, owner_user_id, content_fingerprint,
    requested_days, granted_days, outcome, benefit_grant_id, created_by_admin_email
  ) values (
    p_idempotency_key, p_shop_id, p_owner_user_id, p_content_fingerprint,
    p_requested_days, v_granted_days, v_outcome, v_grant_id, lower(trim(p_admin_email))
  );

  return jsonb_build_object(
    'status', 'recorded',
    'outcome', v_outcome,
    'grantedDays', v_granted_days
  );
end;
$$;

create or replace function public.apply_owner_pilot_cohort_first_paid_bonus_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_membership public.owner_pilot_cohort_memberships%rowtype;
  v_existing public.owner_pilot_first_paid_benefit_grants%rowtype;
  v_subscription public.owner_subscriptions%rowtype;
  v_legacy public.early_partner_benefit_grants%rowtype;
  v_first_payment_id text;
  v_before timestamptz;
  v_after timestamptz;
  v_source text;
begin
  if new.status <> 'PAID' or new.plan_code <> 'single_monthly_v1' then
    return new;
  end if;

  select * into v_membership
    from public.owner_pilot_cohort_memberships
   where shop_id = new.shop_id
     and owner_user_id = new.user_id
     and status <> 'excluded';
  if not found then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('owner_pilot_first_paid:' || new.shop_id, 0)
  );

  select * into v_existing
    from public.owner_pilot_first_paid_benefit_grants
   where shop_id = new.shop_id
   for update;
  if found then
    update public.owner_subscriptions
       set current_period_ends_at = greatest(current_period_ends_at, v_existing.period_ends_at_after),
           next_billing_at = case
             when cancel_at_period_end then null
             else greatest(current_period_ends_at, v_existing.period_ends_at_after)
           end,
           updated_at = now()
     where user_id = new.user_id and shop_id = new.shop_id;
    return new;
  end if;

  select payment_id into v_first_payment_id
    from public.owner_payment_ledger
   where user_id = new.user_id
     and shop_id = new.shop_id
     and status = 'PAID'
     and plan_code = 'single_monthly_v1'
   order by paid_at asc nulls last, payment_id asc
   limit 1;
  if v_first_payment_id is distinct from new.payment_id then
    return new;
  end if;

  select * into v_subscription
    from public.owner_subscriptions
   where user_id = new.user_id and shop_id = new.shop_id
   for update;
  if not found or v_subscription.current_plan_code <> 'single_monthly_v1' then
    return new;
  end if;

  -- The legacy first-20 trigger sorts before the `zz_` trigger below. If it
  -- already supplied the same 30-day first-paid entitlement, record that
  -- source instead of granting another 30 days.
  select * into v_legacy
    from public.early_partner_benefit_grants
   where shop_id = new.shop_id
     and payment_id = new.payment_id
     and grant_type = 'first_payment_bonus'
   limit 1;
  if found then
    v_before := v_legacy.period_ends_at_before;
    v_after := v_legacy.period_ends_at_after;
    v_source := 'legacy_early_partner';
  else
    v_before := greatest(
      coalesce(v_subscription.current_period_ends_at, new.paid_at, now()),
      coalesce(new.paid_at, now())
    );
    v_after := v_before + interval '30 days';
    v_source := 'pilot_cohort';
    update public.owner_subscriptions
       set current_period_ends_at = v_after,
           next_billing_at = case when cancel_at_period_end then null else v_after end,
           updated_at = now()
     where user_id = new.user_id and shop_id = new.shop_id;
  end if;

  insert into public.owner_pilot_first_paid_benefit_grants (
    shop_id, owner_user_id, payment_id, idempotency_key, granted_days,
    grant_source, period_ends_at_before, period_ends_at_after
  ) values (
    new.shop_id, new.user_id, new.payment_id,
    'owner-pilot:first-paid:' || new.payment_id, 30,
    v_source, v_before, v_after
  );
  return new;
end;
$$;

drop trigger if exists zz_owner_payment_ledger_pilot_cohort_first_paid_v1 on public.owner_payment_ledger;
create trigger zz_owner_payment_ledger_pilot_cohort_first_paid_v1
after insert or update of status on public.owner_payment_ledger
for each row execute function public.apply_owner_pilot_cohort_first_paid_bonus_v1();

revoke execute on function public.upsert_owner_pilot_cohort_membership_v1(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.record_owner_pilot_feedback_benefit_v1(uuid, text, text, smallint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.upsert_owner_pilot_cohort_membership_v1(uuid, text, text, text, text, uuid)
  to service_role;
grant execute on function public.record_owner_pilot_feedback_benefit_v1(uuid, text, text, smallint, text, uuid)
  to service_role;
revoke all on function public.apply_owner_pilot_cohort_first_paid_bonus_v1()
  from public, anon, authenticated, service_role;
