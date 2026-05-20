drop index if exists public.shops_owner_user_id_unique;

create index if not exists shops_owner_user_id_idx
  on public.shops(owner_user_id)
  where owner_user_id is not null;

create table if not exists public.owner_shop_memberships (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shop_id text not null references public.shops(id) on delete cascade,
  role text not null default 'owner',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, shop_id),
  constraint owner_shop_memberships_role_check
    check (role in ('owner', 'manager', 'staff'))
);

create unique index if not exists owner_shop_memberships_primary_owner_unique
  on public.owner_shop_memberships(owner_user_id)
  where is_primary;

create index if not exists owner_shop_memberships_shop_id_idx
  on public.owner_shop_memberships(shop_id);

insert into public.owner_shop_memberships (
  owner_user_id,
  shop_id,
  role,
  is_primary,
  created_at,
  updated_at
)
select
  shops.owner_user_id,
  shops.id,
  'owner',
  owner_profiles.shop_id = shops.id,
  shops.created_at,
  now()
from public.shops
left join public.owner_profiles
  on owner_profiles.user_id = shops.owner_user_id
where shops.owner_user_id is not null
on conflict (owner_user_id, shop_id) do update
set
  role = excluded.role,
  is_primary = excluded.is_primary,
  updated_at = now();
