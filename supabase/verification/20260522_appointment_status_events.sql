-- Title: 2026-05-22 예약 상태 변경 이력 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 예약 확정, 거절, 취소, 미용 시작, 픽업 준비, 완료 같은 오너 수동 상태 변경 이력을 DB에 남깁니다.
-- Note: 미용 시작(in_progress)과 픽업 준비(almost_done)는 사진 1장을 연결해야 이력 저장이 가능하게 막습니다.

create table if not exists public.appointment_status_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  from_status text,
  to_status text not null,
  notification_type text,
  notification_id uuid references public.notifications(id) on delete set null,
  primary_media_asset_id uuid references public.media_assets(id) on delete set null,
  action_source text not null default 'owner_web',
  action_reason text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint appointment_status_events_from_status_check
    check (
      from_status is null
      or from_status in ('pending', 'confirmed', 'in_progress', 'almost_done', 'completed', 'cancelled', 'rejected', 'noshow')
    ),
  constraint appointment_status_events_to_status_check
    check (to_status in ('pending', 'confirmed', 'in_progress', 'almost_done', 'completed', 'cancelled', 'rejected', 'noshow')),
  constraint appointment_status_events_notification_type_check
    check (
      notification_type is null
      or notification_type in (
        'booking_confirmed',
        'booking_rescheduled_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed'
      )
    ),
  constraint appointment_status_events_action_source_check
    check (action_source in ('owner_web', 'owner_mobile', 'customer_page', 'system')),
  constraint appointment_status_events_photo_required_check
    check (
      to_status not in ('in_progress', 'almost_done')
      or primary_media_asset_id is not null
    )
);

create table if not exists public.appointment_status_event_media (
  event_id uuid not null references public.appointment_status_events(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  attachment_role text not null default 'message_image',
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (event_id, media_asset_id),
  constraint appointment_status_event_media_role_check
    check (attachment_role in ('message_image', 'before_photo', 'after_photo', 'result_photo', 'receipt', 'other'))
);

create index if not exists appointment_status_events_shop_created_at_idx
  on public.appointment_status_events (shop_id, created_at desc);

create index if not exists appointment_status_events_appointment_created_at_idx
  on public.appointment_status_events (appointment_id, created_at desc);

create index if not exists appointment_status_events_shop_status_created_at_idx
  on public.appointment_status_events (shop_id, to_status, created_at desc);

create index if not exists appointment_status_event_media_media_idx
  on public.appointment_status_event_media (media_asset_id);

notify pgrst, 'reload schema';
