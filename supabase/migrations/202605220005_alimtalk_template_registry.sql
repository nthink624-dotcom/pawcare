-- Title: 2026-05-22 알림톡 템플릿 현황 스키마 보강
-- Purpose: Persist Ssodaa/Kakao template registration state, custom templates, and app template mappings.

create table if not exists public.platform_alimtalk_templates (
  id uuid primary key default gen_random_uuid(),
  template_alias text,
  notification_type text,
  template_config_key text,
  provider text not null default 'ssodaa',
  provider_template_code text,
  template_name text not null default '',
  template_content text not null default '',
  category_code text not null default '',
  category_name text not null default '',
  message_type text not null default 'BA',
  emphasize_type text not null default 'NONE',
  template_title text not null default '',
  template_subtitle text not null default '',
  template_extra text not null default '',
  template_ad text not null default '',
  buttons jsonb not null default '[]'::jsonb,
  inspection_status text not null default 'draft',
  service_status text not null default 'inactive',
  rejection_reason text not null default '',
  is_custom boolean not null default false,
  last_provider_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_alimtalk_templates_alias_check
    check (
      template_alias is null
      or
      template_alias in (
        'booking_received',
        'booking_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'booking_rescheduled_confirmed',
        'appointment_reminder_10m',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed',
        'revisit_notice',
        'birthday_greeting'
      )
    ),
  constraint platform_alimtalk_templates_notification_type_check
    check (
      notification_type is null
      or notification_type in (
        'booking_received',
        'booking_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'booking_rescheduled_confirmed',
        'appointment_reminder_10m',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed',
        'revisit_notice',
        'birthday_greeting'
      )
    ),
  constraint platform_alimtalk_templates_config_key_check
    check (
      template_config_key is null
      or template_config_key in (
        'templateBookingReceived',
        'templateBookingConfirmed',
        'templateBookingRejected',
        'templateBookingCancelled',
        'templateBookingRescheduledConfirmed',
        'templateAppointmentReminder10m',
        'templateGroomingStarted',
        'templateGroomingAlmostDone',
        'templateGroomingCompleted',
        'templateRevisitNotice',
        'templateBirthdayGreeting'
      )
    ),
  constraint platform_alimtalk_templates_message_type_check
    check (message_type in ('BA', 'EX', 'AD', 'MI')),
  constraint platform_alimtalk_templates_emphasize_type_check
    check (emphasize_type in ('NONE', 'TEXT', 'IMAGE', 'ITEM_LIST')),
  constraint platform_alimtalk_templates_inspection_status_check
    check (inspection_status in ('draft', 'requested', 'reviewing', 'approved', 'rejected', 'unknown')),
  constraint platform_alimtalk_templates_service_status_check
    check (service_status in ('active', 'inactive', 'paused', 'deleted', 'unknown'))
);

alter table public.platform_alimtalk_templates
  alter column template_alias drop not null,
  alter column provider_template_code drop not null,
  add column if not exists notification_type text,
  add column if not exists template_title text not null default '',
  add column if not exists template_subtitle text not null default '',
  add column if not exists template_extra text not null default '',
  add column if not exists template_ad text not null default '',
  add column if not exists is_custom boolean not null default false;

alter table public.platform_alimtalk_templates
  drop constraint if exists platform_alimtalk_templates_alias_check,
  drop constraint if exists platform_alimtalk_templates_notification_type_check;

alter table public.platform_alimtalk_templates
  add constraint platform_alimtalk_templates_alias_check
    check (
      template_alias is null
      or template_alias in (
        'booking_received',
        'booking_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'booking_rescheduled_confirmed',
        'appointment_reminder_10m',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed',
        'revisit_notice',
        'birthday_greeting'
      )
    ),
  add constraint platform_alimtalk_templates_notification_type_check
    check (
      notification_type is null
      or notification_type in (
        'booking_received',
        'booking_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'booking_rescheduled_confirmed',
        'appointment_reminder_10m',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed',
        'revisit_notice',
        'birthday_greeting'
      )
    );

create unique index if not exists platform_alimtalk_templates_provider_code_unique_idx
  on public.platform_alimtalk_templates (provider, provider_template_code);

drop index if exists public.platform_alimtalk_templates_alias_active_unique_idx;

create unique index if not exists platform_alimtalk_templates_alias_active_unique_idx
  on public.platform_alimtalk_templates (template_alias)
  where template_alias is not null and service_status = 'active';

create index if not exists platform_alimtalk_templates_notification_type_idx
  on public.platform_alimtalk_templates (notification_type, updated_at desc)
  where notification_type is not null;

create index if not exists platform_alimtalk_templates_status_idx
  on public.platform_alimtalk_templates (inspection_status, service_status, updated_at desc);

create table if not exists public.platform_alimtalk_template_events (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.platform_alimtalk_templates(id) on delete cascade,
  template_alias text,
  provider_template_code text,
  event_type text not null,
  previous_status text,
  next_status text,
  message text not null default '',
  provider_payload jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint platform_alimtalk_template_events_type_check
    check (event_type in ('draft_saved', 'registered', 'review_requested', 'provider_synced', 'approved', 'rejected', 'mapped', 'unmapped'))
);

alter table public.platform_alimtalk_template_events
  alter column template_alias drop not null,
  alter column provider_template_code drop not null;

create index if not exists platform_alimtalk_template_events_template_idx
  on public.platform_alimtalk_template_events (template_id, created_at desc);

create index if not exists platform_alimtalk_template_events_alias_idx
  on public.platform_alimtalk_template_events (template_alias, created_at desc);

notify pgrst, 'reload schema';
