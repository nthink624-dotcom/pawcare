alter table if exists shops
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists shops_owner_user_id_unique
  on shops(owner_user_id)
  where owner_user_id is not null;

create table if not exists owner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  login_id text not null unique,
  name text not null,
  birth_date char(8) not null,
  agreements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists owner_profiles_shop_id_unique
  on owner_profiles(shop_id);
