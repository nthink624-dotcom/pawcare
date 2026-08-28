-- Development/Test only. Reused verified phone numbers may create distinct
-- owner accounts, while the 14-day trial is claimed once per canonical phone.
-- The caller supplies only a purpose-scoped HMAC identity key; raw phone data
-- never enters the anti-abuse ledger.

drop index if exists public.owner_profiles_ci_hash_unique;
drop index if exists public.owner_profiles_di_hash_unique;

create index if not exists owner_profiles_ci_hash_idx
  on public.owner_profiles(ci_hash)
  where ci_hash is not null;

create index if not exists owner_profiles_di_hash_idx
  on public.owner_profiles(di_hash)
  where di_hash is not null;

alter table public.signup_idempotency_requests
  add column if not exists trial_eligible boolean,
  add column if not exists trial_days smallint,
  add column if not exists billing_required boolean;

alter table public.signup_idempotency_requests
  drop constraint if exists signup_idempotency_requests_trial_days_check;

alter table public.signup_idempotency_requests
  add constraint signup_idempotency_requests_trial_days_check
  check (trial_days is null or trial_days in (0, 14));

-- `monthly` is a legacy 19,000 KRW/credit-based product code. New signups use
-- an additive, immutable product identity and persist the charged price contract.
alter table public.owner_subscriptions
  add column if not exists product_version text,
  add column if not exists price_snapshot_amount integer,
  add column if not exists price_snapshot_currency text;

alter table public.owner_subscriptions
  drop constraint if exists owner_subscriptions_current_plan_code_check,
  drop constraint if exists owner_subscriptions_featured_plan_code_check,
  drop constraint if exists owner_subscriptions_auto_renew_plan_code_check,
  drop constraint if exists owner_subscriptions_single_monthly_v1_contract_check;

alter table public.owner_subscriptions
  add constraint owner_subscriptions_current_plan_code_check
    check (current_plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_featured_plan_code_check
    check (featured_plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_auto_renew_plan_code_check
    check (auto_renew_plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_single_monthly_v1_contract_check
    check (
      not (
        current_plan_code = 'single_monthly_v1'
        or featured_plan_code = 'single_monthly_v1'
        or auto_renew_plan_code = 'single_monthly_v1'
      )
      or (
        product_version is not distinct from '2026-08-v1'
        and price_snapshot_amount is not distinct from 29000
        and price_snapshot_currency is not distinct from 'KRW'
      )
    );

create or replace function public.enforce_owner_payment_product_snapshot_immutable_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    old.product_version is not null
    or old.price_snapshot_amount is not null
    or old.price_snapshot_currency is not null
  ) and (
    new.product_version is distinct from old.product_version
    or new.price_snapshot_amount is distinct from old.price_snapshot_amount
    or new.price_snapshot_currency is distinct from old.price_snapshot_currency
  ) then
    raise exception 'PM_PAYMENT_PRODUCT_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.owner_payment_ledger') is not null then
    alter table public.owner_payment_ledger
      add column if not exists product_version text,
      add column if not exists price_snapshot_amount integer,
      add column if not exists price_snapshot_currency text;
    alter table public.owner_payment_ledger
      drop constraint if exists owner_payment_ledger_plan_code_check,
      drop constraint if exists owner_payment_ledger_single_monthly_v1_contract_check;
    alter table public.owner_payment_ledger
      add constraint owner_payment_ledger_plan_code_check
        check (plan_code is null or plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
      add constraint owner_payment_ledger_single_monthly_v1_contract_check
        check (
          plan_code <> 'single_monthly_v1'
          or (
            product_version is not distinct from '2026-08-v1'
            and price_snapshot_amount is not distinct from 29000
            and price_snapshot_currency is not distinct from 'KRW'
          )
        );
    drop trigger if exists owner_payment_product_snapshot_immutable_v1 on public.owner_payment_ledger;
    create trigger owner_payment_product_snapshot_immutable_v1
      before update of product_version, price_snapshot_amount, price_snapshot_currency
      on public.owner_payment_ledger
      for each row execute function public.enforce_owner_payment_product_snapshot_immutable_v1();
  end if;
end;
$$;

create table if not exists public.owner_trial_identity_claims (
  claim_id uuid primary key default gen_random_uuid(),
  first_signup_request_id uuid not null unique,
  claim_source text not null default 'signup' check (claim_source in ('signup', 'backfill')),
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.owner_trial_identity_aliases (
  identity_key text primary key check (identity_key ~ '^[0-9a-f]{64}$'),
  key_version text not null check (key_version ~ '^v[0-9]+$'),
  claim_id uuid not null references public.owner_trial_identity_claims(claim_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (claim_id, key_version)
);

create table if not exists public.owner_trial_identity_key_policy (
  key_version text primary key check (key_version ~ '^v[0-9]+$'),
  is_current boolean not null default false,
  lookup_required boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists owner_trial_identity_one_current_key
  on public.owner_trial_identity_key_policy(is_current) where is_current;

insert into public.owner_trial_identity_key_policy(key_version, is_current, lookup_required)
values ('v1', true, true)
on conflict (key_version) do nothing;

alter table public.owner_trial_identity_claims enable row level security;
alter table public.owner_trial_identity_aliases enable row level security;
alter table public.owner_trial_identity_key_policy enable row level security;
revoke all on table public.owner_trial_identity_claims from public, anon, authenticated;
revoke all on table public.owner_trial_identity_aliases from public, anon, authenticated;
revoke all on table public.owner_trial_identity_key_policy from public, anon, authenticated;
revoke all on table public.owner_trial_identity_claims from service_role;
revoke all on table public.owner_trial_identity_aliases from service_role;
revoke all on table public.owner_trial_identity_key_policy from service_role;

comment on table public.owner_trial_identity_claims is
  'PII-free anti-abuse receipts. Purpose-scoped HMAC aliases are stored separately so key rotation cannot create a second trial.';

create or replace function public.claim_owner_signup_v4(
  p_signup_request_id uuid,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.signup_idempotency_requests%rowtype;
begin
  if p_signup_request_id is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'PM_SIGNUP_INVALID_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_signup_request_id::text, 0));
  select * into v_row
    from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id
   for update;

  if not found then
    insert into public.signup_idempotency_requests (signup_request_id, payload_hash, status)
    values (p_signup_request_id, p_payload_hash, 'claimed')
    returning * into v_row;
    return jsonb_build_object(
      'action', 'claimed', 'status', v_row.status,
      'authUserId', null, 'shopId', null,
      'trialEligible', null, 'trialDays', null, 'billingRequired', null
    );
  end if;

  if v_row.payload_hash <> p_payload_hash then
    return jsonb_build_object(
      'action', 'payload_mismatch', 'status', v_row.status,
      'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id,
      'trialEligible', v_row.trial_eligible, 'trialDays', v_row.trial_days,
      'billingRequired', v_row.billing_required
    );
  end if;
  if v_row.status = 'completed' and v_row.shop_id is not null then
    return jsonb_build_object(
      'action', 'completed', 'status', v_row.status,
      'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id,
      'trialEligible', v_row.trial_eligible, 'trialDays', v_row.trial_days,
      'billingRequired', v_row.billing_required
    );
  end if;
  if v_row.status = 'compensation_pending' then
    return jsonb_build_object(
      'action', 'compensation_pending', 'status', v_row.status,
      'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id,
      'trialEligible', null, 'trialDays', null, 'billingRequired', null
    );
  end if;
  if v_row.status in ('claimed', 'auth_created') then
    return jsonb_build_object(
      'action', 'in_progress', 'status', v_row.status,
      'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id,
      'trialEligible', null, 'trialDays', null, 'billingRequired', null
    );
  end if;

  update public.signup_idempotency_requests
     set status = 'claimed', auth_user_id = null, shop_id = null,
         failure_reason = null, trial_eligible = null, trial_days = null,
         billing_required = null, updated_at = now()
   where signup_request_id = p_signup_request_id
   returning * into v_row;

  return jsonb_build_object(
    'action', 'claimed', 'status', v_row.status,
    'authUserId', null, 'shopId', null,
    'trialEligible', null, 'trialDays', null, 'billingRequired', null
  );
end;
$$;

create or replace function public.complete_owner_signup_v4(
  p_signup_request_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid,
  p_shop jsonb,
  p_profile jsonb,
  p_services jsonb,
  p_staff jsonb,
  p_identity_verification_id uuid,
  p_identity_token_id uuid,
  p_trial_identity_keys jsonb,
  p_trial_identity_current_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.signup_idempotency_requests%rowtype;
  v_result jsonb;
  v_shop_id text := nullif(trim(p_shop ->> 'id'), '');
  v_trial_eligible boolean;
  v_trial_days smallint;
  v_trial_started_at timestamptz := now();
  v_trial_ends_at timestamptz;
  v_identity jsonb;
  v_identity_key text;
  v_identity_version text;
  v_claim_id uuid;
begin
  if jsonb_typeof(p_trial_identity_keys) <> 'array'
     or jsonb_array_length(p_trial_identity_keys) < 1
     or jsonb_array_length(p_trial_identity_keys) > 8
     or p_trial_identity_current_version !~ '^v[0-9]+$' then
    raise exception 'PM_SIGNUP_TRIAL_IDENTITY_INVALID';
  end if;

  if not exists (
    select 1 from public.owner_trial_identity_key_policy
     where key_version = p_trial_identity_current_version and is_current
  ) then raise exception 'PM_SIGNUP_TRIAL_KEY_POLICY_MISMATCH'; end if;

  for v_identity in select value from jsonb_array_elements(p_trial_identity_keys)
  loop
    v_identity_key := v_identity ->> 'identityKey';
    v_identity_version := v_identity ->> 'keyVersion';
    if v_identity_key !~ '^[0-9a-f]{64}$' or v_identity_version !~ '^v[0-9]+$' then
      raise exception 'PM_SIGNUP_TRIAL_IDENTITY_INVALID';
    end if;
  end loop;

  if exists (
    select 1 from public.owner_trial_identity_key_policy policy
     where policy.lookup_required
       and not exists (
         select 1 from jsonb_array_elements(p_trial_identity_keys) item
          where item ->> 'keyVersion' = policy.key_version
       )
  ) then raise exception 'PM_SIGNUP_TRIAL_PREVIOUS_KEY_REQUIRED'; end if;

  if not exists (
    select 1 from jsonb_array_elements(p_trial_identity_keys) item
     where item ->> 'keyVersion' = p_trial_identity_current_version
  ) then raise exception 'PM_SIGNUP_TRIAL_CURRENT_KEY_REQUIRED'; end if;

  if (select count(*) from jsonb_array_elements(p_trial_identity_keys)) <>
     (select count(distinct item ->> 'keyVersion') from jsonb_array_elements(p_trial_identity_keys) item)
     or (select count(*) from jsonb_array_elements(p_trial_identity_keys)) <>
     (select count(distinct item ->> 'identityKey') from jsonb_array_elements(p_trial_identity_keys) item) then
    raise exception 'PM_SIGNUP_TRIAL_DUPLICATE_KEY_VERSION';
  end if;

  -- Every request locks all current/previous aliases in deterministic order.
  -- A v2 request therefore contends on the same v1 lock as an earlier v1 claim.
  for v_identity_key in
    select item ->> 'identityKey' from jsonb_array_elements(p_trial_identity_keys) item order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('owner-trial:' || v_identity_key, 0));
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(p_signup_request_id::text, 0));
  select * into v_row
    from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id
   for update;

  if not found or v_row.payload_hash <> p_payload_hash then
    raise exception 'PM_SIGNUP_PAYLOAD_MISMATCH';
  end if;
  if v_row.status = 'completed' and v_row.shop_id is not null then
    return jsonb_build_object(
      'shopId', v_row.shop_id, 'reused', true,
      'trialEligible', v_row.trial_eligible,
      'trialDays', v_row.trial_days,
      'billingRequired', v_row.billing_required
    );
  end if;
  if v_row.status <> 'auth_created' or v_row.auth_user_id is distinct from p_auth_user_id then
    raise exception 'PM_SIGNUP_INVALID_STATE';
  end if;
  update public.owner_identity_verifications
     set status = 'consumed', consumed_at = now(), consumed_action = 'signup', updated_at = now()
   where id = p_identity_verification_id
     and purpose = 'signup'
     and status = 'verified'
     and verification_token_id = p_identity_token_id
     and consumed_at is null
     and verified_expires_at > now();
  if not found then raise exception 'PM_SIGNUP_IDENTITY_CONSUME_FAILED'; end if;

  -- v1 retains email uniqueness, but receives no CI/DI hashes so a verified
  -- person/phone can own multiple distinct shops. Hashes are restored below.
  select public.complete_owner_signup_v1(
    p_signup_request_id, p_payload_hash, p_auth_user_id,
    p_shop, p_profile - array['ci_hash', 'di_hash'], p_services, p_staff
  ) into v_result;

  update public.owner_profiles
     set ci_hash = nullif(p_profile ->> 'ci_hash', ''),
         di_hash = nullif(p_profile ->> 'di_hash', ''),
         updated_at = now()
   where user_id = p_auth_user_id and shop_id = v_shop_id;

  select aliases.claim_id into v_claim_id
    from public.owner_trial_identity_aliases aliases
   where aliases.identity_key in (
     select item ->> 'identityKey' from jsonb_array_elements(p_trial_identity_keys) item
   )
   limit 1;

  v_trial_eligible := not found;
  if v_trial_eligible then
    insert into public.owner_trial_identity_claims (
      first_signup_request_id, claim_source, claimed_at
    ) values (p_signup_request_id, 'signup', v_trial_started_at)
    returning claim_id into v_claim_id;
  end if;

  insert into public.owner_trial_identity_aliases(identity_key, key_version, claim_id)
  select item ->> 'identityKey', item ->> 'keyVersion', v_claim_id
    from jsonb_array_elements(p_trial_identity_keys) item
  on conflict (identity_key) do nothing;

  if exists (
    select 1 from public.owner_trial_identity_aliases aliases
     where aliases.identity_key in (
       select item ->> 'identityKey' from jsonb_array_elements(p_trial_identity_keys) item
     ) and aliases.claim_id <> v_claim_id
  ) then raise exception 'PM_SIGNUP_TRIAL_ALIAS_CONFLICT'; end if;

  v_trial_days := case when v_trial_eligible then 14 else 0 end;
  v_trial_ends_at := v_trial_started_at + make_interval(days => v_trial_days);

  insert into public.owner_subscriptions (
    user_id, shop_id, current_plan_code, billing_cycle,
    trial_started_at, trial_ends_at, next_billing_at,
    payment_method_exists, payment_method_label, subscription_status,
    cancel_at_period_end, last_payment_status, portone_customer_id,
    featured_plan_code, auto_renew_plan_code,
    product_version, price_snapshot_amount, price_snapshot_currency,
    created_at, updated_at
  ) values (
    p_auth_user_id, v_shop_id, 'single_monthly_v1', '1m',
    v_trial_started_at, v_trial_ends_at, null,
    false, null, case when v_trial_eligible then 'trialing' else 'expired' end,
    false, 'none', 'owner-' || p_auth_user_id::text,
    'single_monthly_v1', 'single_monthly_v1',
    '2026-08-v1', 29000, 'KRW',
    now(), now()
  );

  update public.signup_idempotency_requests
     set status = 'completed', auth_user_id = p_auth_user_id, shop_id = v_shop_id,
         failure_reason = null, trial_eligible = v_trial_eligible,
         trial_days = v_trial_days, billing_required = not v_trial_eligible,
         updated_at = now()
   where signup_request_id = p_signup_request_id;

  return jsonb_build_object(
    'shopId', v_shop_id, 'reused', false,
    'trialEligible', v_trial_eligible,
    'trialDays', v_trial_days,
    'billingRequired', not v_trial_eligible
  );
end;
$$;

create or replace function public.backfill_owner_trial_identity_claim_v2(
  p_identity_keys jsonb,
  p_first_signup_request_id uuid,
  p_claimed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed_count integer;
  v_claim_id uuid;
  v_identity jsonb;
  v_identity_key text;
begin
  if jsonb_typeof(p_identity_keys) <> 'array'
     or jsonb_array_length(p_identity_keys) < 1
     or jsonb_array_length(p_identity_keys) > 8
     or p_first_signup_request_id is null
     or p_claimed_at is null then
    raise exception 'PM_TRIAL_BACKFILL_INVALID';
  end if;

  for v_identity in select value from jsonb_array_elements(p_identity_keys)
  loop
    if (v_identity ->> 'identityKey') !~ '^[0-9a-f]{64}$'
       or (v_identity ->> 'keyVersion') !~ '^v[0-9]+$' then
      raise exception 'PM_TRIAL_BACKFILL_INVALID';
    end if;
  end loop;

  for v_identity_key in
    select item ->> 'identityKey' from jsonb_array_elements(p_identity_keys) item order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('owner-trial:' || v_identity_key, 0));
  end loop;

  select aliases.claim_id into v_claim_id
    from public.owner_trial_identity_aliases aliases
   where aliases.identity_key in (
     select item ->> 'identityKey' from jsonb_array_elements(p_identity_keys) item
   ) limit 1;

  if not found then
    insert into public.owner_trial_identity_claims(
      first_signup_request_id, claim_source, claimed_at
    ) values (p_first_signup_request_id, 'backfill', p_claimed_at)
    returning claim_id into v_claim_id;
  else
    update public.owner_trial_identity_claims
       set first_signup_request_id = p_first_signup_request_id,
           claim_source = 'backfill', claimed_at = p_claimed_at
     where claim_id = v_claim_id and p_claimed_at < claimed_at;
  end if;

  insert into public.owner_trial_identity_aliases(identity_key, key_version, claim_id)
  select item ->> 'identityKey', item ->> 'keyVersion', v_claim_id
    from jsonb_array_elements(p_identity_keys) item
  on conflict (identity_key) do nothing;
  get diagnostics v_changed_count = row_count;
  return v_changed_count > 0;
end;
$$;

create or replace function public.owner_trial_identity_key_retirement_status_v1(
  p_retiring_version text,
  p_current_version text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'retiringVersion', p_retiring_version,
    'currentVersion', p_current_version,
    'claimsMissingCurrentAlias', count(*) filter (where current_alias.claim_id is null),
    'retirementSafe', count(*) filter (where current_alias.claim_id is null) = 0
  )
  from public.owner_trial_identity_claims claims
  join public.owner_trial_identity_aliases retiring_alias
    on retiring_alias.claim_id = claims.claim_id and retiring_alias.key_version = p_retiring_version
  left join public.owner_trial_identity_aliases current_alias
    on current_alias.claim_id = claims.claim_id and current_alias.key_version = p_current_version;
$$;

revoke all on function public.claim_owner_signup_v4(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_owner_signup_v4(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.backfill_owner_trial_identity_claim_v2(jsonb, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.owner_trial_identity_key_retirement_status_v1(text, text) from public, anon, authenticated;

grant execute on function public.claim_owner_signup_v4(uuid, text) to service_role;
grant execute on function public.complete_owner_signup_v4(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) to service_role;
grant execute on function public.backfill_owner_trial_identity_claim_v2(jsonb, uuid, timestamptz) to service_role;
grant execute on function public.owner_trial_identity_key_retirement_status_v1(text, text) to service_role;

notify pgrst, 'reload schema';
