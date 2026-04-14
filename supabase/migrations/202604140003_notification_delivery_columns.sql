alter table if exists notifications
  add column if not exists template_type text,
  add column if not exists provider_message_id text,
  add column if not exists recipient_phone text,
  add column if not exists fail_reason text,
  add column if not exists scheduled_at timestamptz;
