-- Extend existing registries for the booking deposit request contract.
-- Keep the platform mapping registry in sync with the notification aliases used by web and mobile.

alter table public.platform_alimtalk_templates
  drop constraint if exists platform_alimtalk_templates_alias_check,
  drop constraint if exists platform_alimtalk_templates_notification_type_check,
  drop constraint if exists platform_alimtalk_templates_config_key_check;

alter table public.platform_alimtalk_templates
  add constraint platform_alimtalk_templates_alias_check
    check (
      template_alias is null
      or template_alias in (
        'booking_received',
        'booking_consent_request',
        'booking_deposit_request',
        'booking_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'booking_time_proposed',
        'booking_rescheduled_confirmed',
        'appointment_reminder_10m',
        'visit_schedule_notice',
        'visit_reminder_notice',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed',
        'grooming_completed_without_report',
        'revisit_notice',
        'birthday_greeting'
      )
    ),
  add constraint platform_alimtalk_templates_notification_type_check
    check (
      notification_type is null
      or notification_type in (
        'booking_received',
        'booking_consent_request',
        'booking_deposit_request',
        'booking_confirmed',
        'booking_rejected',
        'booking_cancelled',
        'booking_time_proposed',
        'booking_rescheduled_confirmed',
        'appointment_reminder_10m',
        'visit_schedule_notice',
        'visit_reminder_notice',
        'grooming_started',
        'grooming_almost_done',
        'grooming_completed',
        'revisit_notice',
        'birthday_greeting'
      )
    ),
  add constraint platform_alimtalk_templates_config_key_check
    check (
      template_config_key is null
      or template_config_key in (
        'templateBookingReceived',
        'templateBookingConsentRequest',
        'templateBookingDepositRequest',
        'templateBookingConfirmed',
        'templateBookingRejected',
        'templateBookingCancelled',
        'templateBookingTimeProposed',
        'templateBookingRescheduledConfirmed',
        'templateBookingManageLinkRequested',
        'templateAppointmentReminder10m',
        'templateVisitScheduleNotice',
        'templateVisitReminderNotice',
        'templateGroomingStarted',
        'templateGroomingAlmostDone',
        'templateGroomingCompleted',
        'templateGroomingCompletedWithoutReport',
        'templateRevisitNotice',
        'templateBirthdayGreeting'
      )
    );

notify pgrst, 'reload schema';

alter table public.shop_alimtalk_template_requests
  add column if not exists template_alias text;

update public.shop_alimtalk_template_requests
set template_alias = notification_type
where template_alias is null;

alter table public.shop_alimtalk_template_requests
  alter column template_alias set not null;

alter table public.shop_alimtalk_template_requests
  drop constraint if exists shop_alimtalk_template_requests_type_check;

alter table public.shop_alimtalk_template_requests
  add constraint shop_alimtalk_template_requests_type_check check (
    notification_type in (
      'booking_consent_request', 'booking_deposit_request', 'booking_confirmed', 'booking_cancelled',
      'appointment_reminder_10m', 'visit_schedule_notice', 'visit_reminder_notice',
      'grooming_started', 'grooming_almost_done', 'grooming_completed', 'revisit_notice'
    )
  );

alter table public.shop_alimtalk_template_requests
  add constraint shop_alimtalk_template_requests_alias_check check (
    template_alias in (
      'booking_consent_request', 'booking_deposit_request', 'booking_confirmed', 'booking_cancelled',
      'appointment_reminder_10m', 'visit_schedule_notice', 'visit_reminder_notice',
      'grooming_started', 'grooming_almost_done', 'grooming_completed',
      'grooming_completed_without_report', 'revisit_notice'
    )
  );

alter table public.shop_alimtalk_template_requests
  drop constraint if exists shop_alimtalk_template_requests_alias_type_check;

alter table public.shop_alimtalk_template_requests
  add constraint shop_alimtalk_template_requests_alias_type_check check (
    (template_alias = 'grooming_completed_without_report' and notification_type = 'grooming_completed')
    or template_alias = notification_type
  );


notify pgrst, 'reload schema';
