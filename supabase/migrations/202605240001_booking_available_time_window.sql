alter table if exists public.shops
  add column if not exists booking_available_start_time text not null default '10:00',
  add column if not exists booking_available_end_time text not null default '17:00';

alter table if exists public.shops
  drop constraint if exists shops_booking_available_start_time_check,
  drop constraint if exists shops_booking_available_end_time_check,
  drop constraint if exists shops_booking_available_time_order_check;

alter table if exists public.shops
  add constraint shops_booking_available_start_time_check
    check (booking_available_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint shops_booking_available_end_time_check
    check (booking_available_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint shops_booking_available_time_order_check
    check (booking_available_start_time < booking_available_end_time);

update public.shops
set
  booking_available_start_time = coalesce(nullif(booking_available_start_time, ''), '10:00'),
  booking_available_end_time = coalesce(nullif(booking_available_end_time, ''), '17:00')
where booking_available_start_time is null
   or booking_available_start_time = ''
   or booking_available_end_time is null
   or booking_available_end_time = '';
