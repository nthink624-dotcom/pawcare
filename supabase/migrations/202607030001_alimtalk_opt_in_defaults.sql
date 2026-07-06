-- Keep customer-facing reservation Alimtalk enabled by default.
-- Guardian notification settings are shop-scoped because guardians belong to a shop.

alter table if exists public.guardians
  alter column notification_settings set default '{
    "enabled": true,
    "revisit_enabled": true,
    "booking_confirmed_enabled": true,
    "booking_rejected_enabled": true,
    "booking_cancelled_enabled": true,
    "booking_rescheduled_enabled": true,
    "appointment_reminder_10m_enabled": true,
    "grooming_started_enabled": true,
    "grooming_almost_done_enabled": true,
    "grooming_completed_enabled": true,
    "birthday_greeting_enabled": true
  }'::jsonb;

update public.guardians
set notification_settings = '{
    "enabled": true,
    "revisit_enabled": true,
    "booking_confirmed_enabled": true,
    "booking_rejected_enabled": true,
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
   or notification_settings = '{"enabled": false, "revisit_enabled": false}'::jsonb;

alter table if exists public.shops
  alter column notification_settings set default '{
    "enabled": true,
    "alimtalk_sender_mode": "petmanager",
    "alimtalk_shop_channel_status": "not_requested",
    "alimtalk_shop_channel_name": "",
    "alimtalk_shop_channel_url": "",
    "alimtalk_sender_profile_key": "",
    "alimtalk_channel_requested_at": null,
    "alimtalk_channel_admin_note": "",
    "alimtalk_business_channel_verified": false,
    "alimtalk_template_request_note": "",
    "alimtalk_template_request_updated_at": null,
    "revisit_enabled": true,
    "booking_confirmed_enabled": true,
    "booking_rejected_enabled": true,
    "booking_cancelled_enabled": true,
    "booking_rescheduled_enabled": true,
    "appointment_reminder_10m_enabled": true,
    "appointment_reminder_10m_mode": "auto",
    "visit_reminder_offset_minutes": 10,
    "grooming_started_enabled": true,
    "grooming_almost_done_enabled": true,
    "pickup_ready_eta_minutes": 5,
    "grooming_completed_enabled": true,
    "grooming_start_without_photo_enabled": false,
    "grooming_complete_without_photo_enabled": false
  }'::jsonb;

update public.shops
set notification_settings =
  jsonb_set(
    jsonb_set(
      coalesce(notification_settings, '{}'::jsonb),
      '{appointment_reminder_10m_enabled}',
      'true'::jsonb,
      true
    ),
    '{appointment_reminder_10m_mode}',
    '"auto"'::jsonb,
    true
  ),
  updated_at = now()
where notification_settings is null
   or not (notification_settings ? 'appointment_reminder_10m_enabled')
   or coalesce(notification_settings->>'appointment_reminder_10m_mode', 'manual') <> 'auto';
