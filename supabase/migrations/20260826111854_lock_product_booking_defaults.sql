-- Title: Lock product-wide booking defaults
-- Purpose: Remove shop-specific approval/cancellation/slot choices from effective data.

create table if not exists public.migration_20260826111854_booking_defaults_backup (
  shop_id text primary key references public.shops(id) on delete cascade,
  approval_mode text not null,
  concurrent_capacity integer not null,
  booking_slot_interval_minutes integer not null,
  booking_slot_offset_minutes integer not null,
  reservation_policy_settings jsonb not null,
  captured_at timestamptz not null default now()
);
alter table public.migration_20260826111854_booking_defaults_backup enable row level security;
revoke all on table public.migration_20260826111854_booking_defaults_backup from public, anon, authenticated;
grant select, insert, delete on table public.migration_20260826111854_booking_defaults_backup to service_role;

insert into public.migration_20260826111854_booking_defaults_backup (
  shop_id, approval_mode, concurrent_capacity, booking_slot_interval_minutes,
  booking_slot_offset_minutes, reservation_policy_settings
)
select id, approval_mode, concurrent_capacity, booking_slot_interval_minutes,
       booking_slot_offset_minutes, coalesce(reservation_policy_settings, '{}'::jsonb)
from public.shops
where approval_mode is distinct from 'auto'
   or concurrent_capacity is distinct from 1
   or booking_slot_interval_minutes is distinct from 15
   or booking_slot_offset_minutes is distinct from 0
   or coalesce(reservation_policy_settings ->> 'cancel_window', '') <> '2h'
   or lower(coalesce(reservation_policy_settings ->> 'customer_change_enabled', '')) <> 'true'
   or reservation_policy_settings ? 'pending_hold_limit'
   or reservation_policy_settings ? 'ai_booking_time_optimization_enabled'
   or reservation_policy_settings ? 'ai_booking_recommendation_mode'
   or reservation_policy_settings ? 'ai_booking_custom_instruction'
on conflict (shop_id) do nothing;

update public.shops
set
  approval_mode = 'auto',
  concurrent_capacity = 1,
  booking_slot_interval_minutes = 15,
  booking_slot_offset_minutes = 0,
  reservation_policy_settings =
    (
      coalesce(reservation_policy_settings, '{}'::jsonb)
      - 'pending_hold_limit'
      - 'ai_booking_time_optimization_enabled'
      - 'ai_booking_recommendation_mode'
      - 'ai_booking_custom_instruction'
    ) || jsonb_build_object(
      'cancel_window', '2h',
      'customer_change_enabled', true
    ),
  updated_at = now()
where approval_mode is distinct from 'auto'
   or concurrent_capacity is distinct from 1
   or booking_slot_interval_minutes is distinct from 15
   or booking_slot_offset_minutes is distinct from 0
   or coalesce(reservation_policy_settings ->> 'cancel_window', '') <> '2h'
   or lower(coalesce(reservation_policy_settings ->> 'customer_change_enabled', '')) <> 'true'
   or reservation_policy_settings ? 'pending_hold_limit'
   or reservation_policy_settings ? 'ai_booking_time_optimization_enabled'
   or reservation_policy_settings ? 'ai_booking_recommendation_mode'
   or reservation_policy_settings ? 'ai_booking_custom_instruction';

alter table if exists public.shops
  alter column approval_mode set default 'auto',
  alter column concurrent_capacity set default 1,
  alter column booking_slot_interval_minutes set default 15,
  alter column booking_slot_offset_minutes set default 0;

notify pgrst, 'reload schema';
