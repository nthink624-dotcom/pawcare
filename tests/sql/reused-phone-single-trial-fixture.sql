do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if; end $$;
create schema auth;

create table auth.users (id uuid primary key, email text unique);

create table public.shops (
  id text primary key, owner_user_id uuid references auth.users(id),
  name text not null default '', phone text not null default '', address text not null default '',
  description text not null default '', business_hours jsonb not null default '{}'::jsonb,
  regular_closed_days integer[] not null default '{}', temporary_closed_dates date[] not null default '{}',
  concurrent_capacity integer not null default 1, booking_slot_interval_minutes integer not null default 15,
  booking_slot_offset_minutes integer not null default 0, booking_available_start_time text not null default '10:00',
  booking_available_end_time text not null default '17:00', approval_mode text not null default 'auto',
  notification_settings jsonb not null default '{}'::jsonb, customer_page_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.owner_profiles (
  user_id uuid primary key references auth.users(id), shop_id text references public.shops(id),
  login_id text not null unique, name text not null, birth_date text not null, phone_number text not null,
  ci_hash text, di_hash text, identity_verified_at timestamptz, agreements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index owner_profiles_ci_hash_unique on public.owner_profiles(ci_hash) where ci_hash is not null;
create unique index owner_profiles_di_hash_unique on public.owner_profiles(di_hash) where di_hash is not null;

create table public.owner_shop_memberships (
  owner_user_id uuid not null references auth.users(id), shop_id text not null references public.shops(id),
  role text not null, is_primary boolean not null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), primary key(owner_user_id, shop_id)
);

create table public.services (
  id text primary key, shop_id text not null references public.shops(id), name text not null,
  price integer not null, price_type text not null, duration_minutes integer not null, is_active boolean not null,
  category text not null, description text not null, sort_order integer not null,
  price_guide jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_members (
  id text primary key, shop_id text not null references public.shops(id), name text not null,
  display_name text not null, profile_message text not null, title_prefix text not null,
  chip_color_index integer not null, phone text not null, role text not null, position text not null,
  default_days text[] not null, start_time text not null, end_time text not null, regular_off text not null,
  annual_remain integer not null, is_active boolean not null, sort_order integer not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.owner_identity_verifications (
  id uuid primary key, purpose text not null, status text not null, verification_token_id uuid,
  consumed_at timestamptz, consumed_action text, verified_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.owner_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shop_id text not null unique references public.shops(id) on delete cascade,
  current_plan_code text not null check (current_plan_code in ('free','monthly','quarterly','halfyearly','yearly')),
  billing_cycle text not null check (billing_cycle in ('0m','1m','3m','6m','12m')),
  trial_started_at timestamptz not null, trial_ends_at timestamptz not null, next_billing_at timestamptz,
  payment_method_exists boolean not null default false, payment_method_label text,
  subscription_status text not null check (subscription_status in ('trialing','trial_will_end','active','past_due','canceled','expired')),
  cancel_at_period_end boolean not null default false,
  last_payment_status text not null default 'none' check (last_payment_status in ('none','scheduled','paid','failed','cancelled')),
  portone_customer_id text not null unique, featured_plan_code text not null, auto_renew_plan_code text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.owner_payment_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references public.shops(id) on delete cascade,
  plan_code text check (plan_code in ('free','monthly','quarterly','halfyearly','yearly')),
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

create table public.shop_alimtalk_credit_balances (
  shop_id text primary key references public.shops(id), included_total integer not null,
  included_used integer not null, included_period_started_at timestamptz not null,
  included_period_ends_at timestamptz not null, purchased_total integer not null,
  purchased_used integer not null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_alimtalk_credit_events (
  id bigserial primary key, shop_id text not null references public.shops(id), event_type text not null,
  credit_bucket text not null, amount_delta integer not null, included_remaining_after integer not null,
  purchased_remaining_after integer not null, balance_after integer not null, reason text not null,
  metadata jsonb not null default '{}'::jsonb
);
