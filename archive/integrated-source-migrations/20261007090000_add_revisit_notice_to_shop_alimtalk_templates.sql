alter table public.shop_alimtalk_template_requests
  drop constraint if exists shop_alimtalk_template_requests_type_check;

alter table public.shop_alimtalk_template_requests
  add constraint shop_alimtalk_template_requests_type_check check (
    notification_type in (
      'booking_confirmed', 'booking_cancelled',
      'appointment_reminder_10m', 'visit_schedule_notice', 'visit_reminder_notice',
      'grooming_started', 'grooming_almost_done', 'grooming_completed', 'revisit_notice'
    )
  );
