-- PM_DB_RELEASE_CORRECTIVE_20260919
-- Generated from the verified corrective draft after local full-chain tests.
-- This file is intentionally transaction-boundary free: the approved production
-- application wrapper owns the one atomic transaction with its prerequisite chain.

lock table public.owner_subscriptions in share row exclusive mode;
lock table public.owner_payment_ledger in share row exclusive mode;

alter table public.owner_subscriptions
  drop constraint if exists owner_subscriptions_single_monthly_contract_check,
  drop constraint if exists owner_subscriptions_single_monthly_v1_contract_check;
alter table public.owner_subscriptions
  add constraint owner_subscriptions_single_monthly_contract_check check (
    (
      current_plan_code is distinct from 'single_monthly_v1'
      and featured_plan_code is distinct from 'single_monthly_v1'
      and auto_renew_plan_code is distinct from 'single_monthly_v1'
    )
    or (
      (product_version is not distinct from '2026-08-v1' or product_version is not distinct from '2026-09-v1')
      and price_snapshot_amount is not distinct from 29000
      and price_snapshot_currency is not distinct from 'KRW'
    )
  );

alter table public.owner_payment_ledger
  drop constraint if exists owner_payment_ledger_single_monthly_contract_check,
  drop constraint if exists owner_payment_ledger_single_monthly_v1_contract_check;
alter table public.owner_payment_ledger
  add constraint owner_payment_ledger_single_monthly_contract_check check (
    plan_code is distinct from 'single_monthly_v1'
    or (
      (product_version is not distinct from '2026-08-v1' or product_version is not distinct from '2026-09-v1')
      and price_snapshot_amount is not distinct from 29000
      and price_snapshot_currency is not distinct from 'KRW'
    )
  );

create or replace function public.enforce_owner_subscription_new_sale_contract_v2()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_is_current_contract boolean := (
    new.current_plan_code is not distinct from 'single_monthly_v1'
    and new.featured_plan_code is not distinct from 'single_monthly_v1'
    and new.auto_renew_plan_code is not distinct from 'single_monthly_v1'
    and new.product_version is not distinct from '2026-09-v1'
    and new.price_snapshot_amount is not distinct from 29000
    and new.price_snapshot_currency is not distinct from 'KRW'
  );
  v_contract_changed boolean := tg_op = 'UPDATE' and (
    old.current_plan_code is distinct from new.current_plan_code
    or old.featured_plan_code is distinct from new.featured_plan_code
    or old.auto_renew_plan_code is distinct from new.auto_renew_plan_code
    or old.product_version is distinct from new.product_version
    or old.price_snapshot_amount is distinct from new.price_snapshot_amount
    or old.price_snapshot_currency is distinct from new.price_snapshot_currency
  );
begin
  if tg_op = 'INSERT' and v_is_current_contract is not true then
    raise exception 'PM_NEW_SUBSCRIPTION_REQUIRES_SINGLE_MONTHLY_2026_09_V1';
  end if;
  if v_contract_changed and v_is_current_contract is not true then
    raise exception 'PM_SUBSCRIPTION_CONTRACT_CHANGE_REQUIRES_SINGLE_MONTHLY_2026_09_V1';
  end if;
  return null;
end;
$$;
drop trigger if exists owner_subscription_new_sale_contract_v2 on public.owner_subscriptions;
create trigger owner_subscription_new_sale_contract_v2
after insert or update on public.owner_subscriptions
for each row execute function public.enforce_owner_subscription_new_sale_contract_v2();

create or replace function public.enforce_owner_payment_ledger_new_sale_contract_v2()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_is_current_contract boolean := (
    new.plan_code is not distinct from 'single_monthly_v1'
    and new.product_version is not distinct from '2026-09-v1'
    and new.price_snapshot_amount is not distinct from 29000
    and new.price_snapshot_currency is not distinct from 'KRW'
  );
  v_contract_changed boolean := tg_op = 'UPDATE' and (
    old.plan_code is distinct from new.plan_code
    or old.product_version is distinct from new.product_version
    or old.price_snapshot_amount is distinct from new.price_snapshot_amount
    or old.price_snapshot_currency is distinct from new.price_snapshot_currency
  );
begin
  -- NULL plan_code is the existing server contract for unknown payment events.
  if tg_op = 'INSERT' and new.plan_code is not null and v_is_current_contract is not true then
    raise exception 'PM_NEW_PAYMENT_REQUIRES_SINGLE_MONTHLY_2026_09_V1';
  end if;
  if v_contract_changed and new.plan_code is not null and v_is_current_contract is not true then
    raise exception 'PM_PAYMENT_CONTRACT_CHANGE_REQUIRES_SINGLE_MONTHLY_2026_09_V1';
  end if;
  return null;
end;
$$;
drop trigger if exists owner_payment_ledger_new_sale_contract_v2 on public.owner_payment_ledger;
create trigger owner_payment_ledger_new_sale_contract_v2
after insert or update on public.owner_payment_ledger
for each row execute function public.enforce_owner_payment_ledger_new_sale_contract_v2();

create or replace function public.enforce_owner_subscription_identity_immutable_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.user_id is distinct from new.user_id or old.shop_id is distinct from new.shop_id then
    raise exception 'PM_SUBSCRIPTION_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;
drop trigger if exists owner_subscription_identity_immutable_v1 on public.owner_subscriptions;
create trigger owner_subscription_identity_immutable_v1
before update on public.owner_subscriptions
for each row execute function public.enforce_owner_subscription_identity_immutable_v1();

create or replace function public.enforce_owner_payment_ledger_identity_immutable_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.payment_id is distinct from new.payment_id
     or old.user_id is distinct from new.user_id
     or old.shop_id is distinct from new.shop_id
     or old.plan_code is distinct from new.plan_code
     or old.product_version is distinct from new.product_version
     or old.price_snapshot_amount is distinct from new.price_snapshot_amount
     or old.price_snapshot_currency is distinct from new.price_snapshot_currency then
    raise exception 'PM_PAYMENT_LEDGER_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;
drop trigger if exists owner_payment_ledger_identity_immutable_v1 on public.owner_payment_ledger;
create trigger owner_payment_ledger_identity_immutable_v1
before update on public.owner_payment_ledger
for each row execute function public.enforce_owner_payment_ledger_identity_immutable_v1();

-- Only the v6 public wrapper and its private implementation remain callable by
-- service_role. The recorder is internal to v6 and has no direct RPC caller.
revoke all on function public.complete_owner_signup_v1(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.claim_owner_signup_v2(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.mark_owner_signup_auth_created_v2(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.complete_owner_signup_v2(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, integer, timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.claim_owner_signup_v4(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.complete_owner_signup_v4(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.claim_owner_signup_v5(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_owner_signup_auth_created_v5(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function pm_signup_private.claim_owner_signup_v5(uuid, text) from public, anon, authenticated;
revoke all on function pm_signup_private.mark_owner_signup_auth_created_v5(uuid, text, uuid) from public, anon, authenticated;
revoke all on function pm_signup_private.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function pm_signup_private.record_owner_marketing_consent_v1(uuid, text, uuid, text, boolean, timestamptz, timestamptz, text, text, text[]) from public, anon, authenticated, service_role;
revoke all on function public.record_owner_marketing_consent_v1(uuid, text, uuid, text, boolean, timestamptz, timestamptz, text, text, text[]) from public, anon, authenticated, service_role;

revoke all on function public.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function pm_signup_private.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text) from public, anon, authenticated;
grant usage on schema pm_signup_private to service_role;
grant execute on function public.claim_owner_signup_v5(uuid, text) to service_role;
grant execute on function public.mark_owner_signup_auth_created_v5(uuid, text, uuid) to service_role;
grant execute on function pm_signup_private.claim_owner_signup_v5(uuid, text) to service_role;
grant execute on function pm_signup_private.mark_owner_signup_auth_created_v5(uuid, text, uuid) to service_role;
grant execute on function public.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text) to service_role;
grant execute on function pm_signup_private.complete_owner_signup_v6(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text, boolean, text, timestamptz, text, text) to service_role;

revoke all on function public.enforce_owner_subscription_new_sale_contract_v2() from public, anon, authenticated, service_role;
revoke all on function public.enforce_owner_payment_ledger_new_sale_contract_v2() from public, anon, authenticated, service_role;
revoke all on function public.enforce_owner_subscription_identity_immutable_v1() from public, anon, authenticated, service_role;
revoke all on function public.enforce_owner_payment_ledger_identity_immutable_v1() from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';
