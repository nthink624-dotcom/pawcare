alter table if exists public.owner_subscriptions
  drop constraint if exists owner_subscriptions_current_plan_code_check,
  drop constraint if exists owner_subscriptions_billing_cycle_check,
  drop constraint if exists owner_subscriptions_featured_plan_code_check,
  drop constraint if exists owner_subscriptions_auto_renew_plan_code_check;

alter table if exists public.owner_subscriptions
  add constraint owner_subscriptions_current_plan_code_check
    check (current_plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_billing_cycle_check
    check (billing_cycle in ('0m', '1m', '3m', '6m', '12m')),
  add constraint owner_subscriptions_featured_plan_code_check
    check (featured_plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  add constraint owner_subscriptions_auto_renew_plan_code_check
    check (auto_renew_plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly'));
