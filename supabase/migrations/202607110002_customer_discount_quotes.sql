alter table public.appointments
  add column if not exists customer_visit_type text,
  add column if not exists discount_coupon_ids text[] not null default '{}',
  add column if not exists discount_coupon_names text[] not null default '{}',
  add column if not exists original_service_price integer not null default 0,
  add column if not exists discount_amount integer not null default 0,
  add column if not exists final_service_price integer not null default 0,
  add column if not exists discount_snapshot jsonb;

alter table public.appointments
  drop constraint if exists appointments_customer_visit_type_check;

alter table public.appointments
  add constraint appointments_customer_visit_type_check
  check (customer_visit_type is null or customer_visit_type in ('first_visit', 'revisit'));

alter table public.appointments
  drop constraint if exists appointments_discount_amount_check;

alter table public.appointments
  add constraint appointments_discount_amount_check
  check (
    original_service_price >= 0
    and discount_amount >= 0
    and final_service_price >= 0
    and discount_amount <= original_service_price
    and final_service_price = original_service_price - discount_amount
  );

comment on column public.appointments.customer_visit_type is
  'Server-resolved guardian-level visit type at customer booking creation.';
comment on column public.appointments.discount_snapshot is
  'Server-authoritative customer benefit quote snapshot used for this appointment.';
