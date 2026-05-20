alter table public.appointments
  add column if not exists staff_id text references public.staff_members(id) on delete set null;

create index if not exists appointments_shop_date_staff_idx
  on public.appointments (shop_id, appointment_date, staff_id);
