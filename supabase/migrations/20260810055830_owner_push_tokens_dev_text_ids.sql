create table public.owner_push_tokens (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  staff_member_id text references public.staff_members(id) on delete set null,
  provider text not null default 'expo',
  platform text not null default 'unknown',
  push_token text not null,
  device_id text,
  device_name text,
  app_id text,
  app_version text,
  locale text,
  timezone text,
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_push_tokens_provider_check check (provider in ('expo', 'fcm', 'apns', 'capacitor')),
  constraint owner_push_tokens_platform_check check (platform in ('ios', 'android', 'web', 'unknown')),
  constraint owner_push_tokens_actor_check check (owner_user_id is not null or staff_member_id is not null),
  constraint owner_push_tokens_unique_provider_token unique (provider, push_token)
);

create index owner_push_tokens_shop_enabled_idx on public.owner_push_tokens (shop_id, enabled, last_seen_at desc);
create index owner_push_tokens_owner_user_idx on public.owner_push_tokens (owner_user_id) where owner_user_id is not null;
create index owner_push_tokens_staff_member_idx on public.owner_push_tokens (staff_member_id) where staff_member_id is not null;
create index owner_push_tokens_device_idx on public.owner_push_tokens (device_id) where device_id is not null;

alter table public.owner_push_tokens enable row level security;

revoke all on table public.owner_push_tokens from anon, authenticated;
grant all on table public.owner_push_tokens to service_role;
