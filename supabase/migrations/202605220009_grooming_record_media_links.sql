-- Title: 2026-05-22 미용 기록 사진/알림 연결 스키마 보강
-- Purpose: Connect completed grooming records to staff, before/after photos, status events, and customer notification.

alter table if exists public.grooming_records
  add column if not exists staff_id text references public.staff_members(id) on delete set null,
  add column if not exists started_status_event_id uuid references public.appointment_status_events(id) on delete set null,
  add column if not exists pickup_ready_status_event_id uuid references public.appointment_status_events(id) on delete set null,
  add column if not exists completed_status_event_id uuid references public.appointment_status_events(id) on delete set null,
  add column if not exists before_media_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists after_media_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists customer_notification_id uuid references public.notifications(id) on delete set null,
  add column if not exists shared_with_customer_at timestamptz,
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists grooming_records_shop_staff_groomed_at_idx
  on public.grooming_records (shop_id, staff_id, groomed_at desc)
  where staff_id is not null;

create index if not exists grooming_records_appointment_idx
  on public.grooming_records (appointment_id)
  where appointment_id is not null;

create index if not exists grooming_records_before_media_idx
  on public.grooming_records (before_media_asset_id)
  where before_media_asset_id is not null;

create index if not exists grooming_records_after_media_idx
  on public.grooming_records (after_media_asset_id)
  where after_media_asset_id is not null;

create index if not exists grooming_records_customer_notification_idx
  on public.grooming_records (customer_notification_id)
  where customer_notification_id is not null;

notify pgrst, 'reload schema';
