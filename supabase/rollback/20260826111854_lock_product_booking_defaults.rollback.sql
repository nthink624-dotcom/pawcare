update public.shops as shops
set approval_mode = backup.approval_mode,
    concurrent_capacity = backup.concurrent_capacity,
    booking_slot_interval_minutes = backup.booking_slot_interval_minutes,
    booking_slot_offset_minutes = backup.booking_slot_offset_minutes,
    reservation_policy_settings = backup.reservation_policy_settings,
    updated_at = now()
from public.migration_20260826111854_booking_defaults_backup as backup
where shops.id = backup.shop_id;
alter table public.shops
  alter column approval_mode set default 'auto',
  alter column concurrent_capacity set default 1,
  alter column booking_slot_interval_minutes set default 15,
  alter column booking_slot_offset_minutes set default 0;
revoke all on table public.migration_20260826111854_booking_defaults_backup from public, anon, authenticated, service_role;
drop table public.migration_20260826111854_booking_defaults_backup;
notify pgrst, 'reload schema';
