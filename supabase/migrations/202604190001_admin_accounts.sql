create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone_number text,
  login_id text not null unique,
  password_hash text not null,
  is_super_admin boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists admin_accounts_login_id_idx on public.admin_accounts (login_id);
create index if not exists admin_accounts_email_idx on public.admin_accounts (email);
