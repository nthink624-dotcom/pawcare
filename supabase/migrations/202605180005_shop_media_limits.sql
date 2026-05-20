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
