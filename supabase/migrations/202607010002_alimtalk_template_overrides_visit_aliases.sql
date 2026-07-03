-- Purpose: Allow visit reminder template aliases to be saved as PetManager-side Alimtalk body overrides.

alter table if exists public.platform_alimtalk_template_overrides
  drop constraint if exists platform_alimtalk_template_overrides_alias_check;

alter table if exists public.platform_alimtalk_template_overrides
  add constraint platform_alimtalk_template_overrides_alias_check
    check (
      template_alias in (
        'booking_received',
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
    );

notify pgrst, 'reload schema';
