-- Title: 2026-05-22 직원/근무표 스키마 보강
-- Target: development Supabase first, then production Supabase after smoke check.
-- Purpose: 직원 목록, 직원 근무표, 스케줄 담당자 저장에 필요한 누락 스키마를 보강합니다.
-- Apply in Supabase SQL Editor when staff management fails with:
-- "Could not find the table 'public.staff_members' in the schema cache".

create table if not exists public.staff_members (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  name text not null,
  phone text not null default '',
  role text not null default '원장 / 전체 미용',
  default_days text[] not null default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  start_time time not null default '10:00',
  end_time time not null default '19:00',
  regular_off text not null default '일',
  annual_remain integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_members_shop_id_sort_order_idx
  on public.staff_members(shop_id, sort_order, created_at);

alter table if exists public.staff_members
  drop constraint if exists staff_members_default_days_check,
  add constraint staff_members_default_days_check
    check (
      default_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]
    );

alter table public.appointments
  add column if not exists staff_id text references public.staff_members(id) on delete set null;

create index if not exists appointments_shop_date_staff_idx
  on public.appointments (shop_id, appointment_date, staff_id);

create table if not exists public.staff_schedule_overrides (
  id text primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  staff_id text not null references public.staff_members(id) on delete cascade,
  work_date date not null,
  status text not null,
  start_time time,
  end_time time,
  period text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_schedule_overrides_status_check
    check (status in ('work', 'off', 'annual', 'half')),
  constraint staff_schedule_overrides_period_check
    check (period is null or period in ('오전', '오후')),
  constraint staff_schedule_overrides_work_time_check
    check (
      status <> 'work'
      or (
        start_time is not null
        and end_time is not null
        and start_time < end_time
      )
    )
);

create unique index if not exists staff_schedule_overrides_shop_staff_date_idx
  on public.staff_schedule_overrides (shop_id, staff_id, work_date);

create index if not exists staff_schedule_overrides_shop_date_idx
  on public.staff_schedule_overrides (shop_id, work_date);

insert into public.staff_members (
  id,
  shop_id,
  name,
  phone,
  role,
  default_days,
  start_time,
  end_time,
  regular_off,
  annual_remain,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  shops.id || '-staff-owner',
  shops.id,
  '원장',
  shops.phone,
  '원장 / 전체 미용',
  array['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  '10:00',
  '19:00',
  '일',
  0,
  true,
  1,
  now(),
  now()
from public.shops
where not exists (
  select 1
  from public.staff_members
  where staff_members.shop_id = shops.id
    and staff_members.is_active = true
)
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  default_days = excluded.default_days,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  regular_off = excluded.regular_off,
  annual_remain = excluded.annual_remain,
  is_active = true,
  sort_order = 1,
  updated_at = now();

notify pgrst, 'reload schema';
