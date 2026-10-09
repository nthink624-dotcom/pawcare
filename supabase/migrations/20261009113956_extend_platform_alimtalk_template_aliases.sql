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
