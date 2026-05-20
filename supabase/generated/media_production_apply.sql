-- PetManager media production migration bundle
-- Generated at: 2026-05-19T05:57:13.086Z
-- Target: production Supabase ysxykikqnneuhypybjry
-- Run only after explicit owner approval and production preflight checks.
-- Source migrations:
-- - supabase/migrations/202605180002_owner_scale_indexes.sql
-- - supabase/migrations/202605180003_media_assets_and_notification_attachments.sql
-- - supabase/migrations/202605180004_media_cost_controls.sql
-- - supabase/migrations/202605180005_shop_media_limits.sql

begin;

-- ============================================================
-- supabase/migrations/202605180002_owner_scale_indexes.sql
-- ============================================================
create index if not exists guardians_shop_id_created_at_idx
  on public.guardians(shop_id, created_at);

create index if not exists guardians_shop_id_deleted_at_idx
  on public.guardians(shop_id, deleted_at, deleted_restore_until);

create index if not exists pets_shop_id_guardian_id_created_at_idx
  on public.pets(shop_id, guardian_id, created_at);

create index if not exists appointments_shop_id_date_time_idx
  on public.appointments(shop_id, appointment_date, appointment_time);

create index if not exists appointments_shop_id_guardian_date_idx
  on public.appointments(shop_id, guardian_id, appointment_date);

create index if not exists appointments_shop_id_pet_date_idx
  on public.appointments(shop_id, pet_id, appointment_date);

create index if not exists appointments_shop_id_status_date_idx
  on public.appointments(shop_id, status, appointment_date);

create index if not exists grooming_records_shop_id_groomed_at_idx
  on public.grooming_records(shop_id, groomed_at desc);

create index if not exists grooming_records_shop_id_guardian_groomed_at_idx
  on public.grooming_records(shop_id, guardian_id, groomed_at desc);

create index if not exists grooming_records_shop_id_pet_groomed_at_idx
  on public.grooming_records(shop_id, pet_id, groomed_at desc);

create index if not exists notifications_shop_id_created_at_idx
  on public.notifications(shop_id, created_at desc);

create index if not exists notifications_shop_id_guardian_created_at_idx
  on public.notifications(shop_id, guardian_id, created_at desc);

-- ============================================================
-- supabase/migrations/202605180003_media_assets_and_notification_attachments.sql
-- ============================================================
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'buckets'
  ) then
    execute $storage$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'petmanager-media',
        'petmanager-media',
        false,
        10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
      )
      on conflict (id) do update
      set
        public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $storage$;
  end if;
end $$;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  grooming_record_id uuid references public.grooming_records(id) on delete set null,
  bucket text not null default 'petmanager-media',
  storage_path text not null,
  original_file_name text,
  content_type text not null,
  byte_size bigint not null default 0 check (byte_size >= 0),
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  checksum_sha256 text,
  media_kind text not null default 'message_image' check (
    media_kind in (
      'grooming_before',
      'grooming_after',
      'grooming_result',
      'message_image',
      'shop_profile',
      'customer_shared',
      'memo_attachment'
    )
  ),
  visibility text not null default 'private' check (visibility in ('private', 'customer_shared', 'public')),
  status text not null default 'uploaded' check (status in ('uploading', 'uploaded', 'processing', 'ready', 'failed', 'deleted')),
  retention_policy text not null default 'standard' check (retention_policy in ('transient', 'standard', 'archive')),
  uploaded_by_user_id uuid,
  uploaded_from text not null default 'owner_web' check (uploaded_from in ('owner_web', 'owner_mobile', 'customer_page', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, storage_path)
);

create table if not exists public.media_variants (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  variant_key text not null check (variant_key in ('thumbnail', 'preview', 'optimized', 'provider_ready')),
  bucket text not null default 'petmanager-media',
  storage_path text not null,
  content_type text not null,
  byte_size bigint not null default 0 check (byte_size >= 0),
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  created_at timestamptz not null default now(),
  unique (media_asset_id, variant_key),
  unique (bucket, storage_path)
);

create table if not exists public.notification_media_attachments (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  attachment_role text not null default 'message_image' check (
    attachment_role in ('message_image', 'before_photo', 'after_photo', 'result_photo', 'receipt', 'other')
  ),
  sort_order int not null default 0,
  channel text not null default 'alimtalk',
  provider text,
  provider_media_id text,
  provider_media_url text,
  send_status text not null default 'queued' check (send_status in ('queued', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  fail_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (notification_id, media_asset_id, attachment_role)
);

create table if not exists public.media_send_attempts (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  notification_media_attachment_id uuid references public.notification_media_attachments(id) on delete set null,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  channel text not null,
  provider text,
  provider_message_id text,
  provider_media_id text,
  recipient_phone text,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  fail_reason text,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists media_assets_shop_created_at_idx
  on public.media_assets(shop_id, created_at desc)
  where deleted_at is null;

create index if not exists media_assets_shop_kind_created_at_idx
  on public.media_assets(shop_id, media_kind, created_at desc)
  where deleted_at is null;

create index if not exists media_assets_shop_guardian_created_at_idx
  on public.media_assets(shop_id, guardian_id, created_at desc)
  where deleted_at is null;

create index if not exists media_assets_shop_pet_created_at_idx
  on public.media_assets(shop_id, pet_id, created_at desc)
  where deleted_at is null;

create index if not exists media_assets_shop_appointment_created_at_idx
  on public.media_assets(shop_id, appointment_id, created_at desc)
  where deleted_at is null;

create index if not exists media_assets_shop_grooming_record_created_at_idx
  on public.media_assets(shop_id, grooming_record_id, created_at desc)
  where deleted_at is null;

create index if not exists notification_media_attachments_notification_idx
  on public.notification_media_attachments(notification_id, sort_order);

create index if not exists notification_media_attachments_shop_sent_at_idx
  on public.notification_media_attachments(shop_id, sent_at desc)
  where send_status = 'sent';

create index if not exists notification_media_attachments_shop_guardian_sent_at_idx
  on public.notification_media_attachments(shop_id, guardian_id, sent_at desc)
  where send_status = 'sent';

create index if not exists media_send_attempts_shop_created_at_idx
  on public.media_send_attempts(shop_id, created_at desc);

create index if not exists media_send_attempts_shop_sent_at_idx
  on public.media_send_attempts(shop_id, sent_at desc)
  where status = 'sent';

create index if not exists media_send_attempts_media_created_at_idx
  on public.media_send_attempts(media_asset_id, created_at desc);

-- ============================================================
-- supabase/migrations/202605180004_media_cost_controls.sql
-- ============================================================
alter table public.media_assets
  add column if not exists source_byte_size bigint check (source_byte_size is null or source_byte_size >= 0);

alter table public.media_assets
  add column if not exists expires_at timestamptz;

create table if not exists public.shop_media_usage_months (
  shop_id text not null references public.shops(id) on delete cascade,
  usage_month date not null,
  uploaded_asset_count int not null default 0 check (uploaded_asset_count >= 0),
  uploaded_bytes bigint not null default 0 check (uploaded_bytes >= 0),
  sent_asset_count int not null default 0 check (sent_asset_count >= 0),
  sent_bytes bigint not null default 0 check (sent_bytes >= 0),
  updated_at timestamptz not null default now(),
  primary key (shop_id, usage_month)
);

create index if not exists media_assets_shop_expires_at_idx
  on public.media_assets(shop_id, expires_at)
  where deleted_at is null and expires_at is not null;

create index if not exists shop_media_usage_months_month_idx
  on public.shop_media_usage_months(usage_month, shop_id);

create or replace function public.increment_shop_media_usage(
  p_shop_id text,
  p_usage_month date,
  p_uploaded_asset_count int default 0,
  p_uploaded_bytes bigint default 0,
  p_sent_asset_count int default 0,
  p_sent_bytes bigint default 0
)
returns void
language sql
as $$
  insert into public.shop_media_usage_months (
    shop_id,
    usage_month,
    uploaded_asset_count,
    uploaded_bytes,
    sent_asset_count,
    sent_bytes,
    updated_at
  )
  values (
    p_shop_id,
    p_usage_month,
    greatest(p_uploaded_asset_count, 0),
    greatest(p_uploaded_bytes, 0),
    greatest(p_sent_asset_count, 0),
    greatest(p_sent_bytes, 0),
    now()
  )
  on conflict (shop_id, usage_month) do update
  set
    uploaded_asset_count =
      public.shop_media_usage_months.uploaded_asset_count + greatest(excluded.uploaded_asset_count, 0),
    uploaded_bytes =
      public.shop_media_usage_months.uploaded_bytes + greatest(excluded.uploaded_bytes, 0),
    sent_asset_count =
      public.shop_media_usage_months.sent_asset_count + greatest(excluded.sent_asset_count, 0),
    sent_bytes =
      public.shop_media_usage_months.sent_bytes + greatest(excluded.sent_bytes, 0),
    updated_at = now();
$$;

-- ============================================================
-- supabase/migrations/202605180005_shop_media_limits.sql
-- ============================================================
create table if not exists public.shop_media_limits (
  shop_id text primary key references public.shops(id) on delete cascade,
  monthly_soft_limit_bytes bigint not null default 157286400 check (monthly_soft_limit_bytes >= 0),
  monthly_hard_limit_bytes bigint check (monthly_hard_limit_bytes is null or monthly_hard_limit_bytes >= 0),
  transient_retention_days int not null default 30 check (transient_retention_days > 0),
  allow_original_archive boolean not null default false,
  enforcement_mode text not null default 'warn' check (enforcement_mode in ('off', 'warn', 'block')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_media_limits_enforcement_mode_idx
  on public.shop_media_limits(enforcement_mode);

commit;

-- After this succeeds, run:
-- supabase/verification/media_schema_readiness.sql
