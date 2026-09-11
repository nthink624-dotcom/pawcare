-- Some Development histories predate the multi-shop foundation migration even
-- though the application already writes memberships. Keep signup provisioning
-- self-contained and idempotent.

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

alter table public.owner_shop_memberships enable row level security;
revoke all on table public.owner_shop_memberships from public, anon, authenticated;
grant select, insert, update, delete on table public.owner_shop_memberships to service_role;

;
