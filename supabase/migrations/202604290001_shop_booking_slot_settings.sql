alter table if exists shops
  add column if not exists booking_slot_interval_minutes integer not null default 30,
  add column if not exists booking_slot_offset_minutes integer not null default 0;

alter table if exists shops
  drop constraint if exists shops_booking_slot_interval_minutes_check,
  drop constraint if exists shops_booking_slot_offset_minutes_check;

alter table if exists shops
  add constraint shops_booking_slot_interval_minutes_check
    check (booking_slot_interval_minutes in (10, 15, 20, 30, 60)),
  add constraint shops_booking_slot_offset_minutes_check
    check (booking_slot_offset_minutes >= 0 and booking_slot_offset_minutes < 60);
