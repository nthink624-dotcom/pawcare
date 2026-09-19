-- PM_SINGLE_BILLING_CONTRACT_20260914
-- Local-only migration. Do not apply to a remote project without the owner's
-- separate approval and an independent P0/P1 review.

-- New-sale constants:
--   plan_code       single_monthly_v1
--   product_version 2026-09-v1
--   price            29000 KRW (VAT included), per shop
-- Historical 2026-08-v1 and legacy plan codes remain readable, but cannot be
-- inserted or mutated through the current contract paths below.

alter table public.signup_idempotency_requests
  add column if not exists marketing_consent boolean,
  add column if not exists marketing_consent_document_version text,
  add column if not exists marketing_consent_recorded_at timestamptz,
  add column if not exists marketing_benefit_code text,
  add column if not exists marketing_benefit_days smallint not null default 0;

alter table public.signup_idempotency_requests
  drop constraint if exists signup_idempotency_requests_trial_days_check,
  drop constraint if exists signup_idempotency_requests_marketing_benefit_days_check;

alter table public.signup_idempotency_requests
  add constraint signup_idempotency_requests_trial_days_check
    check (trial_days is null or trial_days in (0, 14, 44)),
  add constraint signup_idempotency_requests_marketing_benefit_days_check
    check (marketing_benefit_days in (0, 30));

-- A subscription/entitlement belongs to one shop. The former user_id primary
-- key made a second shop under the same owner impossible to represent safely.
do $$
declare
  v_primary_key_name text;
begin
  if exists (
    select 1
      from pg_constraint
     where confrelid = 'public.owner_subscriptions'::regclass
       and contype = 'f'
  ) then
    raise exception 'PM_OWNER_SUBSCRIPTION_PRIMARY_KEY_IS_REFERENCED';
  end if;

  select constraint_name into v_primary_key_name
    from information_schema.table_constraints
   where table_schema = 'public'
     and table_name = 'owner_subscriptions'
     and constraint_type = 'PRIMARY KEY';

  if v_primary_key_name is not null then
    execute format('alter table public.owner_subscriptions drop constraint %I', v_primary_key_name);
  end if;
end;
$$;

alter table public.owner_subscriptions
  drop constraint if exists owner_subscriptions_shop_id_key;

alter table public.owner_subscriptions
  add constraint owner_subscriptions_pkey primary key (shop_id);

create index if not exists owner_subscriptions_user_id_idx
  on public.owner_subscriptions(user_id);

alter table public.owner_subscriptions enable row level security;
revoke all on table public.owner_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.owner_subscriptions to service_role;

alter table public.owner_subscriptions
  drop constraint if exists owner_subscriptions_current_plan_code_check,
  drop constraint if exists owner_subscriptions_featured_plan_code_check,
  drop constraint if exists owner_subscriptions_auto_renew_plan_code_check,
  drop constraint if exists owner_subscriptions_single_monthly_v1_contract_check,
  drop constraint if exists owner_subscriptions_single_monthly_contract_check;

alter table public.owner_subscriptions
  add constraint owner_subscriptions_current_plan_code_check
    check (current_plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_featured_plan_code_check
    check (featured_plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_auto_renew_plan_code_check
    check (auto_renew_plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_single_monthly_contract_check
    check (
      not (
        current_plan_code = 'single_monthly_v1'
        or featured_plan_code = 'single_monthly_v1'
        or auto_renew_plan_code = 'single_monthly_v1'
      )
      or (
        product_version in ('2026-08-v1', '2026-09-v1')
        and price_snapshot_amount = 29000
        and price_snapshot_currency = 'KRW'
      )
    );

do $$
begin
  if to_regclass('public.owner_payment_ledger') is not null then
    alter table public.owner_payment_ledger
      drop constraint if exists owner_payment_ledger_plan_code_check,
      drop constraint if exists owner_payment_ledger_single_monthly_v1_contract_check,
      drop constraint if exists owner_payment_ledger_single_monthly_contract_check;

    alter table public.owner_payment_ledger
      add constraint owner_payment_ledger_plan_code_check
        check (plan_code is null or plan_code in ('free', 'single_monthly_v1', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
      add constraint owner_payment_ledger_single_monthly_contract_check
        check (
          plan_code is distinct from 'single_monthly_v1'
          or (
            product_version in ('2026-08-v1', '2026-09-v1')
            and price_snapshot_amount = 29000
            and price_snapshot_currency = 'KRW'
          )
        );
  end if;
end;
$$;

create or replace function public.enforce_owner_subscription_new_sale_contract_v2()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_is_current_contract boolean := (
    new.current_plan_code = 'single_monthly_v1'
    and new.featured_plan_code = 'single_monthly_v1'
    and new.auto_renew_plan_code = 'single_monthly_v1'
    and new.product_version = '2026-09-v1'
    and new.price_snapshot_amount = 29000
    and new.price_snapshot_currency = 'KRW'
  );
begin
  if tg_op = 'INSERT' and not v_is_current_contract then
    raise exception 'PM_NEW_SUBSCRIPTION_REQUIRES_SINGLE_MONTHLY_2026_09_V1';
  end if;

  if tg_op = 'UPDATE' and (
    old.current_plan_code is distinct from new.current_plan_code
    or old.featured_plan_code is distinct from new.featured_plan_code
    or old.auto_renew_plan_code is distinct from new.auto_renew_plan_code
    or old.product_version is distinct from new.product_version
    or old.price_snapshot_amount is distinct from new.price_snapshot_amount
    or old.price_snapshot_currency is distinct from new.price_snapshot_currency
  ) and not v_is_current_contract then
    raise exception 'PM_SUBSCRIPTION_CONTRACT_CHANGE_REQUIRES_SINGLE_MONTHLY_2026_09_V1';
  end if;

  if tg_op = 'UPDATE' and not v_is_current_contract and (
    old.current_plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')
    or old.product_version = '2026-08-v1'
  ) then
    raise exception 'PM_LEGACY_SUBSCRIPTION_IS_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists owner_subscription_new_sale_contract_v2 on public.owner_subscriptions;
create trigger owner_subscription_new_sale_contract_v2
before insert or update on public.owner_subscriptions
for each row execute function public.enforce_owner_subscription_new_sale_contract_v2();

create or replace function public.enforce_owner_payment_ledger_new_sale_contract_v2()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.plan_code is not null and (
    new.plan_code <> 'single_monthly_v1'
    or new.product_version <> '2026-09-v1'
    or new.price_snapshot_amount <> 29000
    or new.price_snapshot_currency <> 'KRW'
  ) then
    raise exception 'PM_NEW_PAYMENT_REQUIRES_SINGLE_MONTHLY_2026_09_V1';
  end if;

  if tg_op = 'UPDATE' and (
    old.plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')
    or old.product_version = '2026-08-v1'
  ) then
    raise exception 'PM_LEGACY_PAYMENT_IS_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists owner_payment_ledger_new_sale_contract_v2 on public.owner_payment_ledger;
create trigger owner_payment_ledger_new_sale_contract_v2
before insert or update on public.owner_payment_ledger
for each row execute function public.enforce_owner_payment_ledger_new_sale_contract_v2();

create table if not exists public.owner_marketing_consent_events (
  event_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  shop_id text not null,
  signup_request_id uuid,
  consent_document_version text not null,
  consented boolean not null,
  consented_at timestamptz,
  recorded_at timestamptz not null,
  collection_channel text not null,
  collection_method text not null,
  selected_channels text[] not null,
  created_at timestamptz not null default now(),
  check (consent_document_version = '2026-09-14-v1'),
  check (collection_channel in ('owner_signup', 'owner_settings')),
  check (collection_method in ('separate_optional_checkbox', 'settings_toggle')),
  check (selected_channels <@ array['email', 'sms', 'alimtalk']::text[]),
  check (cardinality(selected_channels) > 0),
  check ((consented and consented_at is not null) or (not consented and consented_at is null))
);

create unique index if not exists owner_marketing_consent_signup_request_unique
  on public.owner_marketing_consent_events(signup_request_id)
  where signup_request_id is not null;

create index if not exists owner_marketing_consent_events_shop_recorded_idx
  on public.owner_marketing_consent_events(shop_id, recorded_at desc);

create table if not exists public.owner_marketing_consent_states (
  shop_id text primary key,
  owner_user_id uuid not null,
  consent_document_version text not null check (consent_document_version = '2026-09-14-v1'),
  consented boolean not null,
  consented_at timestamptz,
  withdrawn_at timestamptz,
  collection_channel text not null check (collection_channel in ('owner_signup', 'owner_settings')),
  collection_method text not null check (collection_method in ('separate_optional_checkbox', 'settings_toggle')),
  selected_channels text[] not null check (selected_channels <@ array['email', 'sms', 'alimtalk']::text[]),
  latest_event_id uuid not null references public.owner_marketing_consent_events(event_id) on delete restrict,
  updated_at timestamptz not null,
  check (
    (consented and consented_at is not null and withdrawn_at is null)
    or (not consented and consented_at is null and withdrawn_at is not null)
  )
);

create table if not exists public.owner_marketing_trial_benefit_grants (
  grant_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  shop_id text not null unique,
  signup_request_id uuid not null unique,
  trial_identity_claim_id uuid not null,
  shop_identity_key_version text not null check (shop_identity_key_version ~ '^v[0-9]+$'),
  shop_identity_key text not null check (shop_identity_key ~ '^[0-9a-f]{64}$'),
  consent_event_id uuid not null references public.owner_marketing_consent_events(event_id) on delete restrict,
  consent_document_version text not null check (consent_document_version = '2026-09-14-v1'),
  benefit_code text not null check (benefit_code = 'marketing_consent_signup_30d_v1'),
  benefit_days smallint not null check (benefit_days = 30),
  trial_ends_at_before timestamptz not null,
  trial_ends_at_after timestamptz not null,
  granted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (trial_identity_claim_id, shop_identity_key_version, shop_identity_key),
  check (trial_ends_at_after = trial_ends_at_before + interval '30 days')
);

alter table public.owner_marketing_consent_events enable row level security;
alter table public.owner_marketing_consent_states enable row level security;
alter table public.owner_marketing_trial_benefit_grants enable row level security;

revoke all on table public.owner_marketing_consent_events from public, anon, authenticated;
revoke all on table public.owner_marketing_consent_states from public, anon, authenticated;
revoke all on table public.owner_marketing_trial_benefit_grants from public, anon, authenticated;
grant select, insert on table public.owner_marketing_consent_events to service_role;
grant select, insert, update on table public.owner_marketing_consent_states to service_role;
grant select, insert on table public.owner_marketing_trial_benefit_grants to service_role;

create or replace function public.prevent_owner_marketing_audit_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'PM_MARKETING_AUDIT_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists owner_marketing_consent_events_append_only on public.owner_marketing_consent_events;
create trigger owner_marketing_consent_events_append_only
before update or delete on public.owner_marketing_consent_events
for each row execute function public.prevent_owner_marketing_audit_mutation_v1();

drop trigger if exists owner_marketing_trial_benefit_grants_append_only on public.owner_marketing_trial_benefit_grants;
create trigger owner_marketing_trial_benefit_grants_append_only
before update or delete on public.owner_marketing_trial_benefit_grants
for each row execute function public.prevent_owner_marketing_audit_mutation_v1();

create or replace function pm_signup_private.record_owner_marketing_consent_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_signup_request_id uuid,
  p_consent_document_version text,
  p_consented boolean,
  p_consented_at timestamptz,
  p_recorded_at timestamptz,
  p_collection_channel text,
  p_collection_method text,
  p_selected_channels text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.owner_marketing_consent_events%rowtype;
begin
  if p_owner_user_id is null
     or nullif(trim(p_shop_id), '') is null
     or p_consent_document_version <> '2026-09-14-v1'
     or p_consented is null
     or p_recorded_at is null
     or p_collection_channel not in ('owner_signup', 'owner_settings')
     or p_collection_method not in ('separate_optional_checkbox', 'settings_toggle')
     or p_selected_channels is distinct from array['email', 'sms', 'alimtalk']::text[]
     or (p_consented and p_consented_at is null)
     or (not p_consented and p_consented_at is not null) then
    raise exception 'PM_MARKETING_CONSENT_CONTRACT_MISMATCH';
  end if;

  if p_collection_channel = 'owner_signup' and p_signup_request_id is null then
    raise exception 'PM_MARKETING_SIGNUP_REQUEST_REQUIRED';
  end if;

  insert into public.owner_marketing_consent_events (
    owner_user_id, shop_id, signup_request_id,
    consent_document_version, consented, consented_at, recorded_at,
    collection_channel, collection_method, selected_channels
  ) values (
    p_owner_user_id, p_shop_id, p_signup_request_id,
    p_consent_document_version, p_consented, p_consented_at, p_recorded_at,
    p_collection_channel, p_collection_method, p_selected_channels
  )
  on conflict (signup_request_id) where signup_request_id is not null do nothing
  returning * into v_event;

  if v_event.event_id is null and p_signup_request_id is not null then
    select * into v_event
      from public.owner_marketing_consent_events
     where signup_request_id = p_signup_request_id;

    if not found
       or v_event.owner_user_id is distinct from p_owner_user_id
       or v_event.shop_id is distinct from p_shop_id
       or v_event.consent_document_version is distinct from p_consent_document_version
       or v_event.consented is distinct from p_consented
       or v_event.consented_at is distinct from p_consented_at
       or v_event.collection_channel is distinct from p_collection_channel
       or v_event.collection_method is distinct from p_collection_method
       or v_event.selected_channels is distinct from p_selected_channels then
      raise exception 'PM_MARKETING_CONSENT_IDEMPOTENCY_MISMATCH';
    end if;
  end if;

  insert into public.owner_marketing_consent_states (
    shop_id, owner_user_id, consent_document_version, consented,
    consented_at, withdrawn_at, collection_channel, collection_method,
    selected_channels, latest_event_id, updated_at
  ) values (
    p_shop_id, p_owner_user_id, p_consent_document_version, p_consented,
    case when p_consented then p_consented_at else null end,
    case when p_consented then null else p_recorded_at end,
    p_collection_channel, p_collection_method, p_selected_channels,
    v_event.event_id, p_recorded_at
  )
  on conflict (shop_id) do update set
    owner_user_id = excluded.owner_user_id,
    consent_document_version = excluded.consent_document_version,
    consented = excluded.consented,
    consented_at = excluded.consented_at,
    withdrawn_at = excluded.withdrawn_at,
    collection_channel = excluded.collection_channel,
    collection_method = excluded.collection_method,
    selected_channels = excluded.selected_channels,
    latest_event_id = excluded.latest_event_id,
    updated_at = excluded.updated_at;

  return v_event.event_id;
end;
$$;

create or replace function public.record_owner_marketing_consent_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_signup_request_id uuid,
  p_consent_document_version text,
  p_consented boolean,
  p_consented_at timestamptz,
  p_recorded_at timestamptz,
  p_collection_channel text,
  p_collection_method text,
  p_selected_channels text[]
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select pm_signup_private.record_owner_marketing_consent_v1(
    p_owner_user_id, p_shop_id, p_signup_request_id,
    p_consent_document_version, p_consented, p_consented_at, p_recorded_at,
    p_collection_channel, p_collection_method, p_selected_channels
  )
$$;

-- Update the internal implementation used by the hardened v5 wrapper. The
-- exact one-token replacement is guarded so schema drift fails the migration.
do $$
declare
  v_definition text;
  v_old_token_count integer;
begin
  select pg_get_functiondef(
    'public.complete_owner_signup_v4(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,uuid,uuid,jsonb,text)'::regprocedure
  ) into v_definition;

  v_old_token_count := (
    length(v_definition) - length(replace(v_definition, '''2026-08-v1''', ''))
  ) / length('''2026-08-v1''');

  if v_old_token_count <> 1 then
    raise exception 'PM_SIGNUP_PRODUCT_VERSION_REWRITE_DRIFT';
  end if;

  execute replace(v_definition, '''2026-08-v1''', '''2026-09-v1''');
end;
$$;

create or replace function pm_signup_private.complete_owner_signup_v6(
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
  p_trial_identity_current_version text,
  p_marketing_consent boolean,
  p_marketing_consent_document_version text,
  p_marketing_consent_recorded_at timestamptz,
  p_shop_identity_key_version text,
  p_shop_identity_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_shop_id text;
  v_trial_eligible boolean;
  v_trial_days smallint;
  v_event_id uuid;
  v_claim_id uuid;
  v_trial_ends_at_before timestamptz;
  v_grant_id uuid;
begin
  if p_marketing_consent is null
     or p_marketing_consent_document_version <> '2026-09-14-v1'
     or p_marketing_consent_recorded_at is null
     or p_shop_identity_key_version !~ '^v[0-9]+$'
     or p_shop_identity_key !~ '^[0-9a-f]{64}$' then
    raise exception 'PM_SIGNUP_MARKETING_CONTRACT_MISMATCH';
  end if;

  v_result := pm_signup_private.complete_owner_signup_v5(
    p_signup_request_id, p_payload_hash, p_auth_user_id,
    p_shop, p_profile, p_services, p_staff,
    p_identity_verification_id, p_identity_token_id,
    p_trial_identity_keys, p_trial_identity_current_version
  );

  v_shop_id := v_result ->> 'shopId';
  v_trial_eligible := coalesce((v_result ->> 'trialEligible')::boolean, false);
  v_trial_days := coalesce((v_result ->> 'trialDays')::smallint, 0);

  update public.owner_subscriptions
     set product_version = '2026-09-v1',
         price_snapshot_amount = 29000,
         price_snapshot_currency = 'KRW',
         updated_at = now()
   where user_id = p_auth_user_id
     and shop_id = v_shop_id
     and current_plan_code = 'single_monthly_v1'
     and featured_plan_code = 'single_monthly_v1'
     and auto_renew_plan_code = 'single_monthly_v1'
     and product_version in ('2026-08-v1', '2026-09-v1')
     and price_snapshot_amount = 29000
     and price_snapshot_currency = 'KRW';
  if not found then
    raise exception 'PM_SIGNUP_SINGLE_MONTHLY_CONTRACT_MISSING';
  end if;

  v_event_id := pm_signup_private.record_owner_marketing_consent_v1(
    p_auth_user_id,
    v_shop_id,
    p_signup_request_id,
    p_marketing_consent_document_version,
    p_marketing_consent,
    case when p_marketing_consent then p_marketing_consent_recorded_at else null end,
    p_marketing_consent_recorded_at,
    'owner_signup',
    'separate_optional_checkbox',
    array['email', 'sms', 'alimtalk']::text[]
  );

  update public.signup_idempotency_requests
     set marketing_consent = p_marketing_consent,
         marketing_consent_document_version = p_marketing_consent_document_version,
         marketing_consent_recorded_at = p_marketing_consent_recorded_at,
         updated_at = now()
   where signup_request_id = p_signup_request_id
     and payload_hash = p_payload_hash;

  if p_marketing_consent and v_trial_eligible and v_trial_days in (14, 44) then
    select aliases.claim_id into v_claim_id
      from public.owner_trial_identity_aliases aliases
     where aliases.identity_key in (
       select item ->> 'identityKey'
         from jsonb_array_elements(p_trial_identity_keys) item
     )
     order by (aliases.key_version = p_trial_identity_current_version) desc
     limit 1;

    select trial_ends_at into v_trial_ends_at_before
      from public.owner_subscriptions
     where user_id = p_auth_user_id and shop_id = v_shop_id
     for update;

    if v_claim_id is null or v_trial_ends_at_before is null then
      raise exception 'PM_MARKETING_BENEFIT_IDENTITY_MISSING';
    end if;

    insert into public.owner_marketing_trial_benefit_grants (
      owner_user_id, shop_id, signup_request_id,
      trial_identity_claim_id, shop_identity_key_version, shop_identity_key,
      consent_event_id, consent_document_version,
      benefit_code, benefit_days,
      trial_ends_at_before, trial_ends_at_after, granted_at
    ) values (
      p_auth_user_id, v_shop_id, p_signup_request_id,
      v_claim_id, p_shop_identity_key_version, p_shop_identity_key,
      v_event_id, p_marketing_consent_document_version,
      'marketing_consent_signup_30d_v1', 30,
      v_trial_ends_at_before, v_trial_ends_at_before + interval '30 days',
      p_marketing_consent_recorded_at
    )
    on conflict do nothing
    returning grant_id into v_grant_id;

    if v_grant_id is not null then
      update public.owner_subscriptions
         set trial_ends_at = trial_ends_at + interval '30 days',
             updated_at = now()
       where user_id = p_auth_user_id and shop_id = v_shop_id;

      update public.signup_idempotency_requests
         set trial_days = 44,
             marketing_benefit_code = 'marketing_consent_signup_30d_v1',
             marketing_benefit_days = 30,
             updated_at = now()
       where signup_request_id = p_signup_request_id
         and payload_hash = p_payload_hash;
      v_trial_days := 44;
    else
      select trial_days into v_trial_days
        from public.signup_idempotency_requests
       where signup_request_id = p_signup_request_id
         and payload_hash = p_payload_hash;
    end if;
  end if;

  return jsonb_build_object(
    'shopId', v_shop_id,
    'reused', coalesce((v_result ->> 'reused')::boolean, false),
    'trialEligible', v_trial_eligible,
    'trialDays', v_trial_days,
    'billingRequired', coalesce((v_result ->> 'billingRequired')::boolean, false),
    'marketingConsent', p_marketing_consent,
    'marketingConsentDocumentVersion', p_marketing_consent_document_version,
    'marketingBenefitCode', case when v_trial_days = 44 then 'marketing_consent_signup_30d_v1' else null end,
    'marketingBenefitDays', case when v_trial_days = 44 then 30 else 0 end
  );
end;
$$;

create or replace function public.complete_owner_signup_v6(
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
  p_trial_identity_current_version text,
  p_marketing_consent boolean,
  p_marketing_consent_document_version text,
  p_marketing_consent_recorded_at timestamptz,
  p_shop_identity_key_version text,
  p_shop_identity_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select pm_signup_private.complete_owner_signup_v6(
    p_signup_request_id, p_payload_hash, p_auth_user_id,
    p_shop, p_profile, p_services, p_staff,
    p_identity_verification_id, p_identity_token_id,
    p_trial_identity_keys, p_trial_identity_current_version,
    p_marketing_consent, p_marketing_consent_document_version,
    p_marketing_consent_recorded_at,
    p_shop_identity_key_version, p_shop_identity_key
  )
$$;

revoke all on function public.complete_owner_signup_v4(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function pm_signup_private.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;

revoke all on function public.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function pm_signup_private.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function pm_signup_private.record_owner_marketing_consent_v1(uuid, text, uuid, text, boolean, timestamptz, timestamptz, text, text, text[])
  from public, anon, authenticated;
revoke all on function public.record_owner_marketing_consent_v1(uuid, text, uuid, text, boolean, timestamptz, timestamptz, text, text, text[])
  from public, anon, authenticated;

grant usage on schema pm_signup_private to service_role;
grant execute on function public.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text)
  to service_role;
grant execute on function pm_signup_private.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text)
  to service_role;
grant execute on function pm_signup_private.record_owner_marketing_consent_v1(uuid, text, uuid, text, boolean, timestamptz, timestamptz, text, text, text[])
  to service_role;
grant execute on function public.record_owner_marketing_consent_v1(uuid, text, uuid, text, boolean, timestamptz, timestamptz, text, text, text[])
  to service_role;

revoke all on function public.enforce_owner_subscription_new_sale_contract_v2() from public, anon, authenticated, service_role;
revoke all on function public.enforce_owner_payment_ledger_new_sale_contract_v2() from public, anon, authenticated, service_role;
revoke all on function public.prevent_owner_marketing_audit_mutation_v1() from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
