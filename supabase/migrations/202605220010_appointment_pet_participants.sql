-- Title: 2026-05-22 예약 반려동물 참여자 스키마 보강
-- Purpose: Persist all pets included in one appointment, including additional pets submitted during customer booking.

create table if not exists public.appointment_pet_participants (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  role text not null default 'additional',
  service_id text references public.services(id) on delete set null,
  memo text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_pet_participants_role_check
    check (role in ('primary', 'additional'))
);

create unique index if not exists appointment_pet_participants_appointment_pet_unique_idx
  on public.appointment_pet_participants (appointment_id, pet_id);

create unique index if not exists appointment_pet_participants_one_primary_idx
  on public.appointment_pet_participants (appointment_id)
  where role = 'primary';

create index if not exists appointment_pet_participants_shop_appointment_idx
  on public.appointment_pet_participants (shop_id, appointment_id, sort_order);

create index if not exists appointment_pet_participants_pet_idx
  on public.appointment_pet_participants (pet_id, created_at desc);

create index if not exists appointment_pet_participants_guardian_idx
  on public.appointment_pet_participants (guardian_id, created_at desc);

insert into public.appointment_pet_participants (
  shop_id,
  appointment_id,
  guardian_id,
  pet_id,
  role,
  service_id,
  sort_order,
  created_at,
  updated_at
)
select
  appointments.shop_id,
  appointments.id,
  appointments.guardian_id,
  appointments.pet_id,
  'primary',
  appointments.service_id,
  0,
  coalesce(appointments.created_at, now()),
  coalesce(appointments.updated_at, now())
from public.appointments
on conflict (appointment_id, pet_id) do nothing;

notify pgrst, 'reload schema';
