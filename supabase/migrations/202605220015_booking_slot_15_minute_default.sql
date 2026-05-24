-- Title: 2026-05-22 예약 계산 기본 단위 15분 전환
-- Purpose: Set the default booking calculation interval to 15 minutes while preserving non-default custom intervals.

alter table if exists public.shops
  add column if not exists booking_slot_interval_minutes integer not null default 15,
  add column if not exists booking_slot_offset_minutes integer not null default 0;

update public.shops
set
  booking_slot_interval_minutes = 15,
  booking_slot_offset_minutes = case
    when booking_slot_offset_minutes is null then 0
    when booking_slot_offset_minutes < 0 then 0
    when booking_slot_offset_minutes >= 15 then 0
    when booking_slot_offset_minutes % 5 <> 0 then 0
    else booking_slot_offset_minutes
  end,
  updated_at = coalesce(updated_at, now())
where booking_slot_interval_minutes is null
   or booking_slot_interval_minutes = 30;

update public.shops
set booking_slot_offset_minutes = 0
where booking_slot_offset_minutes is null
   or booking_slot_offset_minutes < 0
   or booking_slot_offset_minutes >= booking_slot_interval_minutes
   or booking_slot_offset_minutes % 5 <> 0;

alter table if exists public.shops
  alter column booking_slot_interval_minutes set default 15,
  alter column booking_slot_offset_minutes set default 0;

alter table if exists public.shops
  drop constraint if exists shops_booking_slot_interval_minutes_check,
  drop constraint if exists shops_booking_slot_offset_minutes_check;

alter table if exists public.shops
  add constraint shops_booking_slot_interval_minutes_check
    check (booking_slot_interval_minutes in (10, 15, 20, 30, 60)),
  add constraint shops_booking_slot_offset_minutes_check
    check (
      booking_slot_offset_minutes >= 0
      and booking_slot_offset_minutes < booking_slot_interval_minutes
      and booking_slot_offset_minutes % 5 = 0
    );

notify pgrst, 'reload schema';
