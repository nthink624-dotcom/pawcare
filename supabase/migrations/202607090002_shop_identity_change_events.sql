create table if not exists public.shop_identity_change_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  owner_user_id uuid,
  changed_by_user_id uuid,
  field_name text not null,
  previous_value text not null default '',
  next_value text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint shop_identity_change_events_field_name_check
    check (field_name in ('name', 'address'))
);

create index if not exists shop_identity_change_events_shop_created_idx
  on public.shop_identity_change_events(shop_id, created_at desc);

create index if not exists shop_identity_change_events_owner_created_idx
  on public.shop_identity_change_events(owner_user_id, created_at desc);

comment on table public.shop_identity_change_events is
  'Tracks shop name/address changes for single-store billing and abuse review.';
