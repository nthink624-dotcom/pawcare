-- Title: 2026-05-22 미용 기록 사진/알림 연결 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 완료된 미용 기록에서 담당자, 시작 사진, 완료 사진, 상태 이벤트, 고객에게 보낸 알림을 따라갈 수 있게 합니다.
-- Note: 이 SQL은 매출 기능을 추가하지 않습니다. 미용 기록과 사진/알림 연결만 보강합니다.

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
