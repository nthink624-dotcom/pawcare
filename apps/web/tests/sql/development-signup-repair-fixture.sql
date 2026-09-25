create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;

create table auth.users (
  id uuid primary key
);

create table public.shops (
  id text primary key,
  owner_user_id uuid references auth.users(id),
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  description text not null default '',
  business_hours jsonb not null default '{}'::jsonb,
  regular_closed_days integer[] not null default '{}',
  temporary_closed_dates date[] not null default '{}',
  concurrent_capacity integer not null default 1,
  booking_slot_interval_minutes integer not null default 15,
  booking_slot_offset_minutes integer not null default 0,
  booking_available_start_time text not null default '10:00',
  booking_available_end_time text not null default '17:00',
  approval_mode text not null default 'auto',
  reservation_policy_settings jsonb not null default '{}'::jsonb,
  notification_settings jsonb not null default '{}'::jsonb,
  customer_page_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.owner_profiles (
  user_id uuid primary key references auth.users(id),
  shop_id text references public.shops(id),
  login_id text unique,
  ci_hash text,
  di_hash text
);

insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001');
insert into public.shops (
  id, owner_user_id, approval_mode, concurrent_capacity,
  booking_slot_interval_minutes, booking_slot_offset_minutes,
  reservation_policy_settings
) values (
  'fixture-shop', '00000000-0000-0000-0000-000000000001', 'manual', 2, 30, 5,
  '{"cancel_window":"24h","customer_change_enabled":false,"pending_hold_limit":3}'::jsonb
);
insert into public.owner_profiles(user_id, shop_id, login_id)
values ('00000000-0000-0000-0000-000000000001', 'fixture-shop', 'fixture@example.invalid');
