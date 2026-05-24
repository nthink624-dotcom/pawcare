-- Title: 2026-05-22 예약 반려동물 참여자 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 한 예약에 포함된 기본/추가 반려동물을 모두 DB에 연결해 다견 예약을 정확히 추적합니다.
-- Note: 기존 appointments.pet_id는 대표 반려동물로 유지하고, 추가 반려동물은 이 테이블에 연결합니다.

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
