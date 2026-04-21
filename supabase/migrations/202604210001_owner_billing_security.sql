alter table if exists public.owner_subscriptions
  add column if not exists billing_key_encrypted text,
  add column if not exists billing_key_encryption_version smallint;

create table if not exists public.owner_payment_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  plan_code text check (plan_code in ('free', 'monthly', 'quarterly', 'halfyearly', 'yearly')),
  schedule_id text,
  amount integer,
  status text not null default 'UNKNOWN',
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  last_event_type text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_payment_ledger_user_id_idx
  on public.owner_payment_ledger(user_id, updated_at desc);

create index if not exists owner_payment_ledger_shop_id_idx
  on public.owner_payment_ledger(shop_id, updated_at desc);

create index if not exists owner_payment_ledger_status_idx
  on public.owner_payment_ledger(status, updated_at desc);
