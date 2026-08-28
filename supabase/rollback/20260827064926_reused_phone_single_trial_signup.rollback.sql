-- Development/Test rollback only. This rollback is deliberately fail-closed:
-- anti-abuse receipts and duplicate verified identities must never be erased.

do $$
declare
  v_has_new_product_payment boolean := false;
begin
  if exists (select 1 from public.owner_trial_identity_claims) then
    raise exception 'PM_TRIAL_ROLLBACK_BLOCKED_CLAIMS_EXIST';
  end if;
  if exists (
    select 1 from public.owner_profiles where ci_hash is not null group by ci_hash having count(*) > 1
  ) or exists (
    select 1 from public.owner_profiles where di_hash is not null group by di_hash having count(*) > 1
  ) then
    raise exception 'PM_TRIAL_ROLLBACK_BLOCKED_DUPLICATE_IDENTITIES';
  end if;
  if exists (
    select 1 from public.owner_subscriptions where current_plan_code = 'single_monthly_v1'
  ) then
    raise exception 'PM_TRIAL_ROLLBACK_BLOCKED_NEW_PRODUCT_SUBSCRIPTIONS';
  end if;
  if to_regclass('public.owner_payment_ledger') is not null then
    execute 'select exists (select 1 from public.owner_payment_ledger where plan_code = $1)'
      into v_has_new_product_payment
      using 'single_monthly_v1';
    if v_has_new_product_payment then
      raise exception 'PM_TRIAL_ROLLBACK_BLOCKED_NEW_PRODUCT_PAYMENTS';
    end if;
  end if;
end;
$$;

drop function if exists public.owner_trial_identity_key_retirement_status_v1(text, text);
drop function if exists public.backfill_owner_trial_identity_claim_v2(jsonb, uuid, timestamptz);
drop function if exists public.complete_owner_signup_v4(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text);
drop function if exists public.claim_owner_signup_v4(uuid, text);
drop table if exists public.owner_trial_identity_aliases;
drop table if exists public.owner_trial_identity_key_policy;
drop table if exists public.owner_trial_identity_claims;

alter table public.owner_subscriptions
  drop constraint if exists owner_subscriptions_single_monthly_v1_contract_check,
  drop constraint if exists owner_subscriptions_current_plan_code_check,
  drop constraint if exists owner_subscriptions_featured_plan_code_check,
  drop constraint if exists owner_subscriptions_auto_renew_plan_code_check;

alter table public.owner_subscriptions
  add constraint owner_subscriptions_current_plan_code_check
    check (current_plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_featured_plan_code_check
    check (featured_plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_auto_renew_plan_code_check
    check (auto_renew_plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  drop column if exists price_snapshot_currency,
  drop column if exists price_snapshot_amount,
  drop column if exists product_version;

do $$
begin
  if to_regclass('public.owner_payment_ledger') is not null then
    drop trigger if exists owner_payment_product_snapshot_immutable_v1 on public.owner_payment_ledger;
    alter table public.owner_payment_ledger
      drop constraint if exists owner_payment_ledger_single_monthly_v1_contract_check,
      drop constraint if exists owner_payment_ledger_plan_code_check;
    alter table public.owner_payment_ledger
      add constraint owner_payment_ledger_plan_code_check
        check (plan_code is null or plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
      drop column if exists price_snapshot_currency,
      drop column if exists price_snapshot_amount,
      drop column if exists product_version;
  end if;
end;
$$;

drop function if exists public.enforce_owner_payment_product_snapshot_immutable_v1();

alter table public.signup_idempotency_requests
  drop constraint if exists signup_idempotency_requests_trial_days_check,
  drop column if exists billing_required,
  drop column if exists trial_days,
  drop column if exists trial_eligible;

drop index if exists public.owner_profiles_ci_hash_idx;
drop index if exists public.owner_profiles_di_hash_idx;

create unique index if not exists owner_profiles_ci_hash_unique
  on public.owner_profiles(ci_hash)
  where ci_hash is not null;

create unique index if not exists owner_profiles_di_hash_unique
  on public.owner_profiles(di_hash)
  where di_hash is not null;

notify pgrst, 'reload schema';
