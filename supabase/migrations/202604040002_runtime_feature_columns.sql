alter table if exists guardians
  add column if not exists notification_settings jsonb not null default '{
    "enabled": false,
    "revisit_enabled": false
  }'::jsonb;

alter table if exists pets
  add column if not exists birthday date;

alter table if exists services
  add column if not exists price_type text not null default 'starting' check (price_type in ('fixed', 'starting'));

alter table if exists appointments
  add column if not exists rejection_reason text;

alter table if exists notifications
  add column if not exists template_key text,
  add column if not exists provider text,
  add column if not exists metadata jsonb;
