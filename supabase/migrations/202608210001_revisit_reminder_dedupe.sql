create unique index if not exists notifications_automatic_revisit_grooming_record_unique
  on public.notifications ((metadata ->> 'groomingRecordId'))
  where type = 'revisit_notice'
    and status in ('queued', 'sent', 'mocked', 'skipped')
    and metadata ->> 'source' = 'automatic_revisit_reminder_processor'
    and metadata ->> 'groomingRecordId' is not null;
