-- Purpose: Allow the owner-triggered alternative-time proposal Alimtalk template type.

alter table if exists public.platform_alimtalk_templates
  drop constraint if exists platform_alimtalk_templates_notification_type_check;

alter table if exists public.platform_alimtalk_templates
  add constraint platform_alimtalk_templates_notification_type_check
  check (
    notification_type is null
    or notification_type in (
      'booking_received',
      'booking_confirmed',
      'booking_rejected',
      'booking_cancelled',
      'booking_time_proposed',
      'booking_rescheduled_confirmed',
      'appointment_reminder_10m',
      'grooming_started',
      'grooming_almost_done',
      'grooming_completed',
      'revisit_notice',
      'birthday_greeting'
    )
  );
