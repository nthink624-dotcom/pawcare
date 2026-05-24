-- Title: 2026-05-22 예약 상태 동기화 메타데이터 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: PC웹/모바일웹이 같은 예약 상태를 안정적으로 공유하고, 마지막 상태 변경 출처와 사진/요청 연결을 빠르게 확인할 수 있게 합니다.
-- Note: 이 SQL은 자동 상태 변경이나 자동 알림톡 발송을 만들지 않습니다.

alter table if exists public.appointments
  drop constraint if exists appointments_status_check;

alter table if exists public.appointments
  add constraint appointments_status_check
    check (status in ('pending', 'confirmed', 'in_progress', 'almost_done', 'completed', 'cancelled', 'rejected', 'noshow'));

alter table if exists public.appointments
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists status_action_source text,
  add column if not exists last_status_event_id uuid references public.appointment_status_events(id) on delete set null,
  add column if not exists last_status_media_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists last_customer_request_id uuid references public.appointment_customer_requests(id) on delete set null;

alter table if exists public.appointments
  drop constraint if exists appointments_status_action_source_check;

alter table if exists public.appointments
  add constraint appointments_status_action_source_check
    check (
      status_action_source is null
      or status_action_source in ('owner_web', 'owner_mobile', 'customer_page', 'admin', 'system')
    );

update public.appointments
set status_changed_at = coalesce(status_changed_at, updated_at, created_at, now())
where status_changed_at is null;

create index if not exists appointments_shop_updated_at_idx
  on public.appointments (shop_id, updated_at desc);

create index if not exists appointments_shop_status_changed_at_idx
  on public.appointments (shop_id, status_changed_at desc)
  where status_changed_at is not null;

create index if not exists appointments_last_status_event_idx
  on public.appointments (last_status_event_id)
  where last_status_event_id is not null;

create index if not exists appointments_last_customer_request_idx
  on public.appointments (last_customer_request_id)
  where last_customer_request_id is not null;

notify pgrst, 'reload schema';
