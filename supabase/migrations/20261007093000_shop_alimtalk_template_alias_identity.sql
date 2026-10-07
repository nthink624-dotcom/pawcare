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
      'booking_consent_request', 'booking_confirmed', 'booking_cancelled',
      'appointment_reminder_10m', 'visit_schedule_notice', 'visit_reminder_notice',
      'grooming_started', 'grooming_almost_done', 'grooming_completed', 'revisit_notice'
    )
  );

alter table public.shop_alimtalk_template_requests
  add constraint shop_alimtalk_template_requests_alias_check check (
    template_alias in (
      'booking_consent_request', 'booking_confirmed', 'booking_cancelled',
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

drop index if exists public.shop_alimtalk_template_requests_shop_type_idx;
create index if not exists shop_alimtalk_template_requests_shop_alias_idx
  on public.shop_alimtalk_template_requests (shop_id, template_alias, created_at desc);

drop index if exists public.shop_alimtalk_template_requests_one_active_review_idx;
create unique index shop_alimtalk_template_requests_one_active_review_idx
  on public.shop_alimtalk_template_requests (shop_id, template_alias)
  where inspection_status in ('submitting', 'requested', 'reviewing', 'unknown');

notify pgrst, 'reload schema';
