create table if not exists public.owner_login_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text references public.shops(id) on delete set null,
  login_id text not null,
  session_tracking_id uuid not null unique,
  device_type text not null default 'unknown' check (device_type in ('desktop', 'mobile', 'tablet', 'bot', 'unknown')),
  browser_name text not null default 'Unknown',
  os_name text not null default 'Unknown',
  user_agent text not null default '',
  ip_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_login_sessions_owner_user_idx
  on public.owner_login_sessions(owner_user_id, last_login_at desc);

create index if not exists owner_login_sessions_shop_idx
  on public.owner_login_sessions(shop_id, last_login_at desc)
  where shop_id is not null;

create index if not exists owner_login_sessions_active_idx
  on public.owner_login_sessions(owner_user_id, revoked_at, last_seen_at desc);
