-- Pilot free access is separate from the legacy post-payment early-partner benefit.
-- General signup remains 14 days; an approved pilot enrollment replaces it with 30 days.
-- Verified feedback/issue grants are at least 3 days and the total free window is capped
-- at 60 days from the original trial_started_at. This source migration is not auto-applied.

create table if not exists public.owner_pilot_benefit_claims (
  shop_id text primary key references public.shops(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  free_started_at timestamptz not null,
  free_ends_at timestamptz not null,
  total_free_days smallint not null check (total_free_days between 30 and 60),
  created_by_admin_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_pilot_benefit_grants (
  grant_id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.owner_pilot_benefit_claims(shop_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null unique,
  grant_kind text not null check (grant_kind in ('initial', 'feedback_issue')),
  granted_days smallint not null check (granted_days between 3 and 60),
  reason text not null check (char_length(trim(reason)) between 3 and 300),
  free_ends_at_before timestamptz not null,
  free_ends_at_after timestamptz not null,
  created_by_admin_email text not null,
  created_at timestamptz not null default now(),
  constraint owner_pilot_initial_grant_days_check check (
    grant_kind <> 'initial' or granted_days = 30
  )
);

create index if not exists owner_pilot_benefit_grants_shop_created_idx
  on public.owner_pilot_benefit_grants(shop_id, created_at desc);

alter table public.owner_pilot_benefit_claims enable row level security;
alter table public.owner_pilot_benefit_grants enable row level security;
revoke all on public.owner_pilot_benefit_claims from anon, authenticated;
revoke all on public.owner_pilot_benefit_grants from anon, authenticated;
grant select, insert, update on public.owner_pilot_benefit_claims to service_role;
grant select, insert on public.owner_pilot_benefit_grants to service_role;

create or replace function public.grant_owner_pilot_pre_payment_benefit_v1(
  p_user_id uuid,
  p_shop_id text,
  p_grant_kind text,
  p_days smallint,
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
  v_subscription public.owner_subscriptions%rowtype;
  v_claim public.owner_pilot_benefit_claims%rowtype;
  v_existing public.owner_pilot_benefit_grants%rowtype;
  v_before timestamptz;
  v_after timestamptz;
  v_total_days smallint;
  v_grant_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'PM_PILOT_SERVICE_ROLE_REQUIRED';
  end if;
  if p_grant_kind not in ('initial', 'feedback_issue') then
    raise exception 'PM_PILOT_INVALID_GRANT_KIND';
  end if;
  if p_grant_kind = 'initial' and p_days <> 30 then
    raise exception 'PM_PILOT_INITIAL_DAYS_REQUIRED';
  end if;
  if p_grant_kind = 'feedback_issue' and p_days < 3 then
    raise exception 'PM_PILOT_MIN_EXTENSION_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 300 then
    raise exception 'PM_PILOT_REASON_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_admin_email, ''))) < 3 then
    raise exception 'PM_PILOT_ADMIN_REQUIRED';
  end if;

  -- Serialize one logical grant before reading its replay ledger. Without this
  -- lock, concurrent retries can both miss the row before one transaction
  -- commits. The unique constraint still remains the final storage guard.
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

  select * into v_existing
    from public.owner_pilot_benefit_grants
   where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id <> p_user_id
       or v_existing.shop_id <> p_shop_id
       or v_existing.grant_kind <> p_grant_kind
       or v_existing.granted_days <> p_days
       or v_existing.reason <> trim(p_reason)
       or v_existing.created_by_admin_email <> lower(trim(p_admin_email)) then
      raise exception 'PM_PILOT_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'status', 'already_granted',
      'grantId', v_existing.grant_id,
      'totalFreeDays', (
        select total_free_days from public.owner_pilot_benefit_claims where shop_id = p_shop_id
      ),
      'freeEndsAt', v_existing.free_ends_at_after
    );
  end if;

  select * into v_subscription
    from public.owner_subscriptions
   where user_id = p_user_id
     and shop_id = p_shop_id
   for update;
  if not found then
    raise exception 'PM_PILOT_SUBSCRIPTION_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.owner_payment_ledger
     where user_id = p_user_id and shop_id = p_shop_id and status = 'PAID'
  ) then
    raise exception 'PM_PILOT_ALREADY_PAID';
  end if;
  if v_subscription.current_period_ends_at is not null
     or v_subscription.subscription_status not in ('trialing', 'trial_will_end', 'expired') then
    raise exception 'PM_PILOT_NOT_PRE_PAYMENT_TRIAL';
  end if;

  select * into v_claim
    from public.owner_pilot_benefit_claims
   where user_id = p_user_id and shop_id = p_shop_id
   for update;

  if p_grant_kind = 'initial' then
    if found then
      raise exception 'PM_PILOT_ALREADY_ENROLLED';
    end if;
    v_before := v_subscription.trial_ends_at;
    v_after := v_subscription.trial_started_at + interval '30 days';
    if v_before > v_after then
      raise exception 'PM_PILOT_TRIAL_ALREADY_EXTENDED';
    end if;
    v_total_days := 30;

    insert into public.owner_pilot_benefit_claims (
      shop_id, user_id, free_started_at, free_ends_at, total_free_days, created_by_admin_email
    ) values (
      p_shop_id, p_user_id, v_subscription.trial_started_at, v_after, v_total_days, lower(trim(p_admin_email))
    );
  else
    if not found then
      raise exception 'PM_PILOT_ENROLLMENT_REQUIRED';
    end if;
    if v_claim.total_free_days + p_days > 60 then
      raise exception 'PM_PILOT_CAP_EXCEEDED';
    end if;
    v_before := v_claim.free_ends_at;
    v_total_days := v_claim.total_free_days + p_days;
    v_after := v_claim.free_started_at + make_interval(days => v_total_days);

    update public.owner_pilot_benefit_claims
       set total_free_days = v_total_days,
           free_ends_at = v_after,
           updated_at = now()
     where user_id = p_user_id and shop_id = p_shop_id;
  end if;

  update public.owner_subscriptions
     set trial_ends_at = v_after,
         subscription_status = case when v_after > now() then 'trialing' else 'expired' end,
         updated_at = now()
   where user_id = p_user_id and shop_id = p_shop_id;

  insert into public.owner_pilot_benefit_grants (
    shop_id, user_id, idempotency_key, grant_kind, granted_days, reason,
    free_ends_at_before, free_ends_at_after, created_by_admin_email
  ) values (
    p_shop_id, p_user_id, p_idempotency_key, p_grant_kind, p_days, trim(p_reason),
    v_before, v_after, lower(trim(p_admin_email))
  ) returning grant_id into v_grant_id;

  return jsonb_build_object(
    'status', 'granted',
    'grantId', v_grant_id,
    'totalFreeDays', v_total_days,
    'freeEndsAt', v_after
  );
end;
$$;

revoke execute on function public.grant_owner_pilot_pre_payment_benefit_v1(
  uuid, text, text, smallint, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.grant_owner_pilot_pre_payment_benefit_v1(
  uuid, text, text, smallint, text, text, uuid
) to service_role;
