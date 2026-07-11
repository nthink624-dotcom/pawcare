-- Align guardian personal Alimtalk preferences with the shared PC/mobile data contract.
-- `booking_rejected_enabled` is a shop-level/legacy flow, not a customer-level preference.

alter table if exists public.guardians
  alter column notification_settings set default '{
    "enabled": true,
    "revisit_enabled": true,
    "booking_confirmed_enabled": true,
    "booking_cancelled_enabled": true,
    "booking_rescheduled_enabled": true,
    "appointment_reminder_10m_enabled": true,
    "grooming_started_enabled": true,
    "grooming_almost_done_enabled": true,
    "grooming_completed_enabled": true,
    "birthday_greeting_enabled": true
  }'::jsonb;

update public.guardians
set notification_settings = coalesce(notification_settings, '{}'::jsonb) - 'booking_rejected_enabled',
    updated_at = now()
where notification_settings ? 'booking_rejected_enabled';

update public.guardians
set notification_settings =
  '{
    "enabled": true,
    "revisit_enabled": true,
    "booking_confirmed_enabled": true,
    "booking_cancelled_enabled": true,
    "booking_rescheduled_enabled": true,
    "appointment_reminder_10m_enabled": true,
    "grooming_started_enabled": true,
    "grooming_almost_done_enabled": true,
    "grooming_completed_enabled": true,
    "birthday_greeting_enabled": true
  }'::jsonb,
  updated_at = now()
where notification_settings is null
   or notification_settings = '{}'::jsonb;
