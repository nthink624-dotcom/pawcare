alter table public.appointments
  add column if not exists visit_reminder_offset_minutes integer not null default 10,
  add column if not exists pickup_ready_eta_minutes integer not null default 5;

alter table public.appointments
  add constraint appointments_visit_reminder_offset_minutes_check
    check (visit_reminder_offset_minutes between 0 and 180) not valid,
  add constraint appointments_pickup_ready_eta_minutes_check
    check (pickup_ready_eta_minutes between 0 and 180) not valid;

alter table public.appointments
  validate constraint appointments_visit_reminder_offset_minutes_check,
  validate constraint appointments_pickup_ready_eta_minutes_check;
