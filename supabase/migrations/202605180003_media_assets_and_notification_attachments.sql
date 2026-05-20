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
