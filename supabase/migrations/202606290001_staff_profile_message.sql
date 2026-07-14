create table if not exists public.staff_members (
  id text primary key default gen_random_uuid()::text,
  shop_id text not null references public.shops(id) on delete cascade,
  name text not null,
  display_name text,
  profile_image_url text,
  title_prefix text,
  position text,
  chip_color_index integer,
  profile_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_members
  add column if not exists display_name text,
  add column if not exists profile_image_url text,
  add column if not exists title_prefix text,
  add column if not exists position text,
  add column if not exists chip_color_index integer,
  add column if not exists profile_message text;

create index if not exists staff_members_shop_id_idx
  on public.staff_members(shop_id);

alter table public.staff_members enable row level security;
