alter table public.appointments
  add column if not exists visit_reminder_offset_minutes integer not null default 10,
  add column if not exists pickup_ready_eta_minutes integer not null default 5;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_visit_reminder_offset_minutes_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_visit_reminder_offset_minutes_check
        check (visit_reminder_offset_minutes between 0 and 180) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_pickup_ready_eta_minutes_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_pickup_ready_eta_minutes_check
        check (pickup_ready_eta_minutes between 0 and 180) not valid;
  end if;
end $$;

alter table public.appointments
  validate constraint appointments_visit_reminder_offset_minutes_check,
  validate constraint appointments_pickup_ready_eta_minutes_check;
