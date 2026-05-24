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
  sort_order
)
select
  shops.id || '-staff-owner',
  shops.id,
  coalesce(nullif(owner_profiles.name, ''), '원장'),
  coalesce(nullif(owner_profiles.phone_number, ''), shops.phone, ''),
  '원장 / 전체 미용',
  array['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  '10:00',
  '19:00',
  '일',
  0,
  true,
  1
from public.shops
left join public.owner_profiles on owner_profiles.shop_id = shops.id
where not exists (
  select 1
  from public.staff_members
  where staff_members.shop_id = shops.id
);

update public.shops
set
  business_hours = '{
    "0": { "open": "10:00", "close": "19:00", "enabled": false },
    "1": { "open": "10:00", "close": "19:00", "enabled": true },
    "2": { "open": "10:00", "close": "19:00", "enabled": true },
    "3": { "open": "10:00", "close": "19:00", "enabled": true },
    "4": { "open": "10:00", "close": "19:00", "enabled": true },
    "5": { "open": "10:00", "close": "19:00", "enabled": true },
    "6": { "open": "10:00", "close": "19:00", "enabled": true }
  }'::jsonb,
  regular_closed_days = array[0]
where business_hours = '{}'::jsonb;

insert into public.services (
  id,
  shop_id,
  name,
  price,
  price_type,
  duration_minutes,
  is_active
)
select
  shops.id || '-svc-' || seed_services.service_key,
  shops.id,
  seed_services.name,
  seed_services.price,
  'starting',
  seed_services.duration_minutes,
  true
from public.shops
cross join (
  values
    ('full-grooming', '전체 미용', 80000, 120),
    ('bath-partial', '목욕 + 부분정리', 55000, 90),
    ('bath', '목욕', 35000, 60),
    ('hygiene', '위생 미용', 25000, 45),
    ('partial-grooming', '부분 미용', 30000, 45),
    ('spa-medicated', '스파/약욕 케어', 40000, 60),
    ('nail-trim', '발톱 정리', 10000, 30)
) as seed_services(service_key, name, price, duration_minutes)
where not exists (
  select 1
  from public.services
  where services.shop_id = shops.id
);

update public.shops
set
  concurrent_capacity = 1,
  booking_slot_interval_minutes = coalesce(booking_slot_interval_minutes, 30),
  booking_slot_offset_minutes = coalesce(booking_slot_offset_minutes, 0)
where concurrent_capacity <> 1
  or booking_slot_interval_minutes is null
  or booking_slot_offset_minutes is null;
