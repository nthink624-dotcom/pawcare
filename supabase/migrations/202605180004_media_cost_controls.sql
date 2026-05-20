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
