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
  coalesce(nullif(owner_profiles.phone_number, ''), shops.phone, ''),
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
left join public.owner_profiles on owner_profiles.shop_id = shops.id
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

update public.staff_members
set
  name = '원장',
  role = '원장 / 전체 미용',
  updated_at = now()
from public.shops
where staff_members.id = shops.id || '-staff-owner'
  and staff_members.shop_id = shops.id
  and (
    staff_members.name <> '원장'
    or staff_members.role <> '원장 / 전체 미용'
  );
