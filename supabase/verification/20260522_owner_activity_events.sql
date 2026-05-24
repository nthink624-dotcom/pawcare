-- Title: 2026-05-22 오너 운영 변경 이력 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 오너가 PC웹/모바일웹에서 직접 바꾼 고객, 예약, 스태프, 서비스, 설정 변경 이력을 공용으로 남깁니다.
-- Note: 이 SQL은 동작을 바꾸지 않고, 변경 이력을 저장할 공간만 만듭니다.

create table if not exists public.owner_activity_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text not null default '',
  action_source text not null default 'owner_web',
  action_type text not null,
  entity_type text not null,
  entity_id text,
  appointment_id uuid references public.appointments(id) on delete set null,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  staff_id text references public.staff_members(id) on delete set null,
  service_id text references public.services(id) on delete set null,
  previous_payload jsonb not null default '{}'::jsonb,
  next_payload jsonb not null default '{}'::jsonb,
  note text not null default '',
  request_id text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint owner_activity_events_action_source_check
    check (action_source in ('owner_web', 'owner_mobile', 'admin', 'customer_page', 'system')),
  constraint owner_activity_events_action_type_check
    check (
      action_type in (
        'created',
        'updated',
        'deleted',
        'restored',
        'status_changed',
        'approved',
        'rejected',
        'assigned',
        'unassigned',
        'sent',
        'failed',
        'imported',
        'exported'
      )
    ),
  constraint owner_activity_events_entity_type_check
    check (
      entity_type in (
        'appointment',
        'appointment_customer_request',
        'guardian',
        'pet',
        'grooming_record',
        'notification',
        'staff_member',
        'staff_schedule_override',
        'service',
        'shop_settings',
        'customer_page_settings',
        'alimtalk_credit',
        'media_asset',
        'label',
        'other'
      )
    )
);

create index if not exists owner_activity_events_shop_created_idx
  on public.owner_activity_events (shop_id, created_at desc);

create index if not exists owner_activity_events_actor_created_idx
  on public.owner_activity_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists owner_activity_events_entity_idx
  on public.owner_activity_events (entity_type, entity_id, created_at desc)
  where entity_id is not null;

create index if not exists owner_activity_events_appointment_idx
  on public.owner_activity_events (appointment_id, created_at desc)
  where appointment_id is not null;

create index if not exists owner_activity_events_guardian_idx
  on public.owner_activity_events (guardian_id, created_at desc)
  where guardian_id is not null;

create index if not exists owner_activity_events_staff_idx
  on public.owner_activity_events (staff_id, created_at desc)
  where staff_id is not null;

notify pgrst, 'reload schema';
