-- Title: 2026-05-22 알림 발송 결과 이력 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 고객/예약 기록에서 알림톡 발송 성공, 실패, 쏘다 조회 결과, 알림톡 크레딧 차감/환불 연결을 확인할 수 있게 합니다.
-- Note: 실제 발송은 계속 오너 수동 액션 기준입니다. 이 SQL은 자동 발송/크론을 만들지 않습니다.

alter table if exists public.notifications
  add column if not exists provider_delivery_status text,
  add column if not exists provider_delivery_error text,
  add column if not exists provider_delivery_found boolean,
  add column if not exists provider_delivery_checked_at timestamptz,
  add column if not exists credit_consume_event_id uuid references public.shop_alimtalk_credit_events(id) on delete set null,
  add column if not exists credit_refund_event_id uuid references public.shop_alimtalk_credit_events(id) on delete set null,
  add column if not exists sent_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists action_source text not null default 'owner_web';

alter table if exists public.notifications
  drop constraint if exists notifications_action_source_check;

alter table if exists public.notifications
  add constraint notifications_action_source_check
    check (action_source in ('owner_web', 'owner_mobile', 'admin', 'customer_page', 'system'));

create index if not exists notifications_shop_created_at_idx
  on public.notifications (shop_id, created_at desc);

create index if not exists notifications_shop_guardian_created_at_idx
  on public.notifications (shop_id, guardian_id, created_at desc)
  where guardian_id is not null;

create index if not exists notifications_shop_appointment_created_at_idx
  on public.notifications (shop_id, appointment_id, created_at desc)
  where appointment_id is not null;

create index if not exists notifications_provider_message_idx
  on public.notifications (provider, provider_message_id)
  where provider_message_id is not null;

create table if not exists public.notification_delivery_checks (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  provider text not null default 'ssodaa',
  provider_message_id text,
  recipient_phone_tail text,
  lookup_status text not null,
  delivery_status text,
  delivery_error text,
  provider_delivery_found boolean,
  provider_payload jsonb not null default '{}'::jsonb,
  checked_by_user_id uuid references auth.users(id) on delete set null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint notification_delivery_checks_lookup_status_check
    check (lookup_status in ('checked', 'found', 'not_found', 'failed', 'skipped'))
);

create index if not exists notification_delivery_checks_notification_idx
  on public.notification_delivery_checks (notification_id, checked_at desc)
  where notification_id is not null;

create index if not exists notification_delivery_checks_shop_checked_idx
  on public.notification_delivery_checks (shop_id, checked_at desc);

create index if not exists notification_delivery_checks_provider_message_idx
  on public.notification_delivery_checks (provider, provider_message_id)
  where provider_message_id is not null;

notify pgrst, 'reload schema';
