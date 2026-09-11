-- Initial partner stores: the first 20 shops with a confirmed
-- single_monthly_v1 payment receive one additional 30-day period.  The
-- payment ledger is the only common, provider-confirmed entry point for this
-- entitlement; do not call this from an unverified browser callback.

create table if not exists public.early_partner_benefit_claims (
  claim_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references public.shops(id) on delete cascade,
  first_payment_id text not null unique,
  idempotency_key text not null unique,
  slot_number smallint not null unique check (slot_number between 1 and 20),
  first_paid_at timestamptz not null,
  benefit_window_ends_at timestamptz not null,
  cumulative_bonus_days smallint not null default 30 check (cumulative_bonus_days between 30 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id)
);

create table if not exists public.early_partner_benefit_grants (
  grant_id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.early_partner_benefit_claims(claim_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references public.shops(id) on delete cascade,
  payment_id text references public.owner_payment_ledger(payment_id) on delete restrict,
  idempotency_key text not null unique,
  grant_type text not null check (grant_type in ('first_payment_bonus', 'manual_issue_bonus')),
  reason_code text not null,
  granted_days smallint not null check (granted_days in (7, 14, 30)),
  period_ends_at_before timestamptz not null,
  period_ends_at_after timestamptz not null,
  actor_type text not null check (actor_type in ('system', 'admin')),
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (grant_type = 'first_payment_bonus' and granted_days = 30 and actor_type = 'system')
    or (grant_type = 'manual_issue_bonus' and granted_days in (7, 14) and actor_type = 'admin')
  )
);

create table if not exists public.early_partner_benefit_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id text,
  claim_id uuid references public.early_partner_benefit_claims(claim_id) on delete set null,
  event_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists early_partner_benefit_claims_window_idx
  on public.early_partner_benefit_claims(benefit_window_ends_at);

create index if not exists early_partner_benefit_grants_claim_idx
  on public.early_partner_benefit_grants(claim_id, created_at desc);

alter table public.early_partner_benefit_claims enable row level security;
alter table public.early_partner_benefit_grants enable row level security;
alter table public.early_partner_benefit_audit_events enable row level security;

revoke all on table public.early_partner_benefit_claims from public, anon, authenticated;
revoke all on table public.early_partner_benefit_grants from public, anon, authenticated;
revoke all on table public.early_partner_benefit_audit_events from public, anon, authenticated;
grant select, insert, update, delete on table public.early_partner_benefit_claims to service_role;
grant select, insert, update, delete on table public.early_partner_benefit_grants to service_role;
grant select, insert, update, delete on table public.early_partner_benefit_audit_events to service_role;

create or replace function public.apply_early_partner_first_payment_bonus_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_first_payment_id text;
  v_claim public.early_partner_benefit_claims%rowtype;
  v_subscription public.owner_subscriptions%rowtype;
  v_slot_number smallint;
  v_base_period_ends_at timestamptz;
  v_next_period_ends_at timestamptz;
  v_next_billing_at timestamptz;
  v_idempotency_key text := 'early-partner:first-payment:' || new.payment_id;
begin
  if new.status <> 'PAID' or new.plan_code <> 'single_monthly_v1' then
    return new;
  end if;

  -- This transaction-level lock serializes the limited 20-slot allocation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('early_partner_benefit_slots_v1', 0));

  select * into v_claim
    from public.early_partner_benefit_claims
   where first_payment_id = new.payment_id
   for update;

  if found then
    -- `syncOwnerSubscriptionFromPayment` is intentionally replay-safe. It
    -- rebuilds the paid period before re-upserting the ledger, so restore the
    -- already-claimed minimum entitlement on a duplicate provider event.
    select period_ends_at_after into v_next_period_ends_at
      from public.early_partner_benefit_grants
     where claim_id = v_claim.claim_id
       and grant_type = 'first_payment_bonus'
     order by created_at asc
     limit 1;

    select * into v_subscription
      from public.owner_subscriptions
     where user_id = new.user_id
       and shop_id = new.shop_id
     for update;

    if found and v_next_period_ends_at is not null then
      v_base_period_ends_at := greatest(
        coalesce(v_subscription.current_period_ends_at, new.paid_at, now()),
        v_next_period_ends_at
      );
      v_next_billing_at := case when v_subscription.cancel_at_period_end then null else v_base_period_ends_at end;

      update public.owner_subscriptions
         set current_period_ends_at = v_base_period_ends_at,
             next_billing_at = v_next_billing_at,
             updated_at = now()
       where user_id = new.user_id
         and shop_id = new.shop_id;
    end if;

    insert into public.early_partner_benefit_audit_events (
      shop_id, user_id, payment_id, claim_id, event_type, idempotency_key, payload
    ) values (
      new.shop_id, new.user_id, new.payment_id, v_claim.claim_id, 'first_payment_replayed',
      'early-partner:audit:replayed:' || new.payment_id,
      jsonb_build_object('slotNumber', v_claim.slot_number)
    ) on conflict (idempotency_key) do nothing;
    return new;
  end if;

  -- The payment-ledger row is written only after the existing server path has
  -- fetched and validated the provider payment.  Among persisted paid rows,
  -- this payment must be the shop's first successful single-monthly payment.
  select payment_id into v_first_payment_id
    from public.owner_payment_ledger
   where user_id = new.user_id
     and shop_id = new.shop_id
     and status = 'PAID'
     and plan_code = 'single_monthly_v1'
   order by paid_at asc nulls last, payment_id asc
   limit 1;

  if v_first_payment_id is distinct from new.payment_id then
    insert into public.early_partner_benefit_audit_events (
      shop_id, user_id, payment_id, event_type, idempotency_key, payload
    ) values (
      new.shop_id, new.user_id, new.payment_id, 'first_payment_not_eligible',
      'early-partner:audit:not-first:' || new.payment_id,
      jsonb_build_object('firstPaymentId', v_first_payment_id)
    ) on conflict (idempotency_key) do nothing;
    return new;
  end if;

  select * into v_claim
    from public.early_partner_benefit_claims
   where shop_id = new.shop_id
   for update;

  if found then
    insert into public.early_partner_benefit_audit_events (
      shop_id, user_id, payment_id, claim_id, event_type, idempotency_key, payload
    ) values (
      new.shop_id, new.user_id, new.payment_id, v_claim.claim_id, 'shop_already_claimed',
      'early-partner:audit:shop-claimed:' || new.payment_id,
      jsonb_build_object('firstPaymentId', v_claim.first_payment_id)
    ) on conflict (idempotency_key) do nothing;
    return new;
  end if;

  select coalesce(max(slot_number), 0) + 1 into v_slot_number
    from public.early_partner_benefit_claims;

  if v_slot_number > 20 then
    insert into public.early_partner_benefit_audit_events (
      shop_id, user_id, payment_id, event_type, idempotency_key, payload
    ) values (
      new.shop_id, new.user_id, new.payment_id, 'partner_slots_full',
      'early-partner:audit:slots-full:' || new.payment_id,
      jsonb_build_object('slotLimit', 20)
    ) on conflict (idempotency_key) do nothing;
    return new;
  end if;

  select * into v_subscription
    from public.owner_subscriptions
   where user_id = new.user_id
     and shop_id = new.shop_id
   for update;

  if not found or v_subscription.current_plan_code <> 'single_monthly_v1' then
    insert into public.early_partner_benefit_audit_events (
      shop_id, user_id, payment_id, event_type, idempotency_key, payload
    ) values (
      new.shop_id, new.user_id, new.payment_id, 'subscription_not_eligible',
      'early-partner:audit:subscription-not-eligible:' || new.payment_id,
      jsonb_build_object('currentPlanCode', v_subscription.current_plan_code)
    ) on conflict (idempotency_key) do nothing;
    return new;
  end if;

  v_base_period_ends_at := greatest(
    coalesce(v_subscription.current_period_ends_at, new.paid_at, now()),
    coalesce(new.paid_at, now())
  );
  v_next_period_ends_at := v_base_period_ends_at + interval '30 days';
  v_next_billing_at := case
    when v_subscription.cancel_at_period_end then null
    else v_next_period_ends_at
  end;

  insert into public.early_partner_benefit_claims (
    user_id, shop_id, first_payment_id, idempotency_key, slot_number,
    first_paid_at, benefit_window_ends_at, cumulative_bonus_days
  ) values (
    new.user_id, new.shop_id, new.payment_id, v_idempotency_key, v_slot_number,
    coalesce(new.paid_at, now()), coalesce(new.paid_at, now()) + interval '3 months', 30
  ) returning * into v_claim;

  update public.owner_subscriptions
     set current_period_ends_at = v_next_period_ends_at,
         next_billing_at = v_next_billing_at,
         updated_at = now()
   where user_id = new.user_id
     and shop_id = new.shop_id;

  insert into public.early_partner_benefit_grants (
    claim_id, user_id, shop_id, payment_id, idempotency_key, grant_type,
    reason_code, granted_days, period_ends_at_before, period_ends_at_after,
    actor_type, payload
  ) values (
    v_claim.claim_id, new.user_id, new.shop_id, new.payment_id, v_idempotency_key,
    'first_payment_bonus', 'initial_partner_first_paid', 30,
    v_base_period_ends_at, v_next_period_ends_at, 'system',
    jsonb_build_object('slotNumber', v_claim.slot_number, 'benefitWindowEndsAt', v_claim.benefit_window_ends_at)
  );

  insert into public.early_partner_benefit_audit_events (
    shop_id, user_id, payment_id, claim_id, event_type, idempotency_key, payload
  ) values (
    new.shop_id, new.user_id, new.payment_id, v_claim.claim_id, 'first_payment_claimed',
    'early-partner:audit:claimed:' || new.payment_id,
    jsonb_build_object(
      'slotNumber', v_claim.slot_number,
      'grantedDays', 30,
      'periodEndsAtBefore', v_base_period_ends_at,
      'periodEndsAtAfter', v_next_period_ends_at,
      'nextBillingAt', v_next_billing_at
    )
  );

  return new;
end;
$$;

drop trigger if exists owner_payment_ledger_early_partner_first_payment_v1 on public.owner_payment_ledger;
create trigger owner_payment_ledger_early_partner_first_payment_v1
after insert or update of status on public.owner_payment_ledger
for each row execute function public.apply_early_partner_first_payment_bonus_v1();

create or replace function public.grant_early_partner_manual_bonus_v1(
  p_shop_id text,
  p_days smallint,
  p_reason_code text,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_claim public.early_partner_benefit_claims%rowtype;
  v_subscription public.owner_subscriptions%rowtype;
  v_existing_grant public.early_partner_benefit_grants%rowtype;
  v_base_period_ends_at timestamptz;
  v_next_period_ends_at timestamptz;
  v_next_billing_at timestamptz;
begin
  if current_user <> 'service_role' then
    raise exception 'PM_EARLY_PARTNER_SERVICE_ROLE_REQUIRED';
  end if;
  if p_days not in (7, 14) then
    raise exception 'PM_EARLY_PARTNER_INVALID_BONUS_DAYS';
  end if;
  if p_reason_code not in ('core_issue', 'major_issue')
     or (p_reason_code = 'core_issue' and p_days <> 7)
     or (p_reason_code = 'major_issue' and p_days <> 14) then
    raise exception 'PM_EARLY_PARTNER_INVALID_REASON';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'PM_EARLY_PARTNER_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into v_existing_grant
    from public.early_partner_benefit_grants
   where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'status', 'already_granted',
      'claimId', v_existing_grant.claim_id,
      'grantId', v_existing_grant.grant_id,
      'grantedDays', v_existing_grant.granted_days,
      'currentPeriodEndsAt', (
        select current_period_ends_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      ),
      'nextBillingAt', (
        select next_billing_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      )
    );
  end if;

  select * into v_claim
    from public.early_partner_benefit_claims
   where shop_id = p_shop_id
   for update;
  if not found then
    raise exception 'PM_EARLY_PARTNER_CLAIM_NOT_FOUND';
  end if;

  -- Re-check after locking the claim. Two identical requests can both miss
  -- the first read, but only one may create the grant.
  select * into v_existing_grant
    from public.early_partner_benefit_grants
   where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'status', 'already_granted',
      'claimId', v_existing_grant.claim_id,
      'grantId', v_existing_grant.grant_id,
      'grantedDays', v_existing_grant.granted_days,
      'currentPeriodEndsAt', (
        select current_period_ends_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      ),
      'nextBillingAt', (
        select next_billing_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      )
    );
  end if;

  if now() > v_claim.benefit_window_ends_at then
    raise exception 'PM_EARLY_PARTNER_WINDOW_EXPIRED';
  end if;
  if v_claim.cumulative_bonus_days + p_days > 60 then
    raise exception 'PM_EARLY_PARTNER_BONUS_CAP_EXCEEDED';
  end if;

  select * into v_subscription
    from public.owner_subscriptions
   where user_id = v_claim.user_id
     and shop_id = v_claim.shop_id
   for update;
  if not found then
    raise exception 'PM_EARLY_PARTNER_SUBSCRIPTION_NOT_FOUND';
  end if;

  v_base_period_ends_at := greatest(coalesce(v_subscription.current_period_ends_at, now()), now());
  v_next_period_ends_at := v_base_period_ends_at + make_interval(days => p_days);
  v_next_billing_at := case when v_subscription.cancel_at_period_end then null else v_next_period_ends_at end;

  update public.owner_subscriptions
     set current_period_ends_at = v_next_period_ends_at,
         next_billing_at = v_next_billing_at,
         updated_at = now()
   where user_id = v_claim.user_id
     and shop_id = v_claim.shop_id;

  update public.early_partner_benefit_claims
     set cumulative_bonus_days = cumulative_bonus_days + p_days,
         updated_at = now()
   where claim_id = v_claim.claim_id;

  insert into public.early_partner_benefit_grants (
    claim_id, user_id, shop_id, idempotency_key, grant_type, reason_code,
    granted_days, period_ends_at_before, period_ends_at_after, actor_type,
    actor_id, payload
  ) values (
    v_claim.claim_id, v_claim.user_id, v_claim.shop_id, p_idempotency_key,
    'manual_issue_bonus', p_reason_code, p_days, v_base_period_ends_at,
    v_next_period_ends_at, 'admin', p_actor_id, coalesce(p_payload, '{}'::jsonb)
  );

  insert into public.early_partner_benefit_audit_events (
    shop_id, user_id, claim_id, event_type, idempotency_key, payload
  ) values (
    v_claim.shop_id, v_claim.user_id, v_claim.claim_id, 'manual_issue_bonus_granted',
    'early-partner:audit:' || p_idempotency_key,
    jsonb_build_object(
      'reasonCode', p_reason_code,
      'grantedDays', p_days,
      'periodEndsAtBefore', v_base_period_ends_at,
      'periodEndsAtAfter', v_next_period_ends_at,
      'nextBillingAt', v_next_billing_at,
      'actorId', p_actor_id
    ) || coalesce(p_payload, '{}'::jsonb)
  );

  return jsonb_build_object(
    'status', 'granted',
    'claimId', v_claim.claim_id,
    'grantedDays', p_days,
    'currentPeriodEndsAt', v_next_period_ends_at,
    'nextBillingAt', v_next_billing_at,
    'cumulativeBonusDays', v_claim.cumulative_bonus_days + p_days,
    'benefitWindowEndsAt', v_claim.benefit_window_ends_at
  );
end;
$$;

revoke all on function public.apply_early_partner_first_payment_bonus_v1() from public, anon, authenticated, service_role;
revoke all on function public.grant_early_partner_manual_bonus_v1(text, smallint, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.grant_early_partner_manual_bonus_v1(text, smallint, text, uuid, text, jsonb) to service_role;
