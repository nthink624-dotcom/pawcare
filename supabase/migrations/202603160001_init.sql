create extension if not exists pgcrypto;

create table if not exists shops (
  id text primary key,
  name text not null,
  phone text not null,
  address text not null,
  description text not null default '',
  business_hours jsonb not null default '{}'::jsonb,
  regular_closed_days int[] not null default '{}',
  temporary_closed_dates date[] not null default '{}',
  concurrent_capacity int not null default 1 check (concurrent_capacity between 1 and 5),
  approval_mode text not null default 'manual' check (approval_mode in ('manual', 'auto')),
  notification_settings jsonb not null default '{
    "enabled": false,
    "revisit_enabled": false,
    "booking_confirmed_enabled": false,
    "booking_rejected_enabled": false,
    "booking_cancelled_enabled": false,
    "booking_rescheduled_enabled": false,
    "grooming_almost_done_enabled": false,
    "grooming_completed_enabled": false
  }'::jsonb,
  customer_page_settings jsonb not null default '{
    "shop_name": "",
    "tagline": "",
    "hero_image_url": "",
    "primary_color": "#1F6B5B",
    "notices": [],
    "operating_hours_note": "",
    "holiday_notice": "",
    "parking_notice": "",
    "kakao_inquiry_url": "",
    "show_notices": true,
    "show_parking_notice": true,
    "show_services": true,
    "booking_button_label": "예약하기",
    "show_kakao_inquiry": true,
    "font_preset": "soft",
    "font_scale": "comfortable"
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guardians (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references shops(id) on delete cascade,
  name text not null,
  phone text not null,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references shops(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  name text not null,
  breed text not null,
  weight numeric,
  age int,
  notes text not null default '',
  grooming_cycle_weeks int not null default 4,
  avatar_seed text not null default '🐶',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  name text not null,
  price int not null,
  duration_minutes int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references shops(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  service_id text not null references services(id),
  appointment_date date not null,
  appointment_time time not null,
  status text not null check (status in ('pending','confirmed','in_progress','almost_done','completed','cancelled','noshow')),
  memo text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  source text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists grooming_records (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references shops(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  pet_id uuid not null references pets(id) on delete cascade,
  service_id text not null references services(id),
  appointment_id uuid references appointments(id) on delete set null,
  style_notes text not null default '',
  memo text not null default '',
  price_paid int not null default 0,
  groomed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references shops(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  pet_id uuid references pets(id) on delete set null,
  guardian_id uuid references guardians(id) on delete set null,
  type text not null,
  channel text not null,
  message text not null,
  status text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists landing_interests (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  owner_name text not null,
  phone text not null,
  needs text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists landing_feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('feature','bug','idea')),
  text text not null,
  created_at timestamptz not null default now()
);
