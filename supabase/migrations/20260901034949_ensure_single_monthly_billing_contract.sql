-- Minimal forward-compatible prerequisite for the single monthly billing
-- contract. It intentionally does not alter signup, phone-trial, CI, or DI
-- behavior; those changes remain in their dedicated migration.

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
  end if;
end;
$$;

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

drop trigger if exists owner_payment_product_snapshot_immutable_v1 on public.owner_payment_ledger;
create trigger owner_payment_product_snapshot_immutable_v1
before update of product_version, price_snapshot_amount, price_snapshot_currency
on public.owner_payment_ledger
for each row execute function public.enforce_owner_payment_product_snapshot_immutable_v1();

revoke all on function public.enforce_owner_payment_product_snapshot_immutable_v1()
  from public, anon, authenticated, service_role;
