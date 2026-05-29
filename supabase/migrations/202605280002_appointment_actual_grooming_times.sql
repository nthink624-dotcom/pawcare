-- Title: 2026-05-28 예약 실제 미용 시작/완료 시각
-- Purpose: Store the owner-clicked grooming start and completion timestamps separately from scheduled times.

alter table if exists public.appointments
  add column if not exists actual_started_at timestamptz,
  add column if not exists actual_completed_at timestamptz;

create index if not exists appointments_shop_actual_started_at_idx
  on public.appointments (shop_id, actual_started_at desc)
  where actual_started_at is not null;

create index if not exists appointments_shop_actual_completed_at_idx
  on public.appointments (shop_id, actual_completed_at desc)
  where actual_completed_at is not null;

notify pgrst, 'reload schema';
