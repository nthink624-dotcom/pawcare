create table if not exists owner_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shop_id text not null unique references shops(id) on delete cascade,
  current_plan_code text not null check (current_plan_code in ('monthly', 'quarterly', 'halfyearly', 'yearly')),
  billing_cycle text not null check (billing_cycle in ('1m', '3m', '6m', '12m')),
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  next_billing_at timestamptz,
  payment_method_exists boolean not null default false,
  payment_method_label text,
  subscription_status text not null check (subscription_status in ('trialing', 'trial_will_end', 'active', 'past_due', 'canceled', 'expired')),
  cancel_at_period_end boolean not null default false,
  last_payment_status text not null default 'none' check (last_payment_status in ('none', 'scheduled', 'paid', 'failed', 'cancelled')),
  last_payment_failed_at timestamptz,
  last_payment_at timestamptz,
  last_payment_id text,
  billing_key text,
  billing_issue_id text,
  portone_customer_id text not null unique,
  featured_plan_code text not null default 'yearly' check (featured_plan_code in ('monthly', 'quarterly', 'halfyearly', 'yearly')),
  auto_renew_plan_code text not null default 'monthly' check (auto_renew_plan_code in ('monthly', 'quarterly', 'halfyearly', 'yearly')),
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  last_schedule_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_subscriptions_status_idx on owner_subscriptions(subscription_status);
create index if not exists owner_subscriptions_next_billing_idx on owner_subscriptions(next_billing_at);

create table if not exists owner_billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  event_type text not null,
  payment_id text,
  schedule_id text,
  amount integer,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists owner_billing_events_user_id_idx on owner_billing_events(user_id, created_at desc);
create index if not exists owner_billing_events_shop_id_idx on owner_billing_events(shop_id, created_at desc);
