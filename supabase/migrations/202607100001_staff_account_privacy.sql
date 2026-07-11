alter table if exists public.staff_members
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists staff_members_auth_user_id_unique
  on public.staff_members(auth_user_id)
  where auth_user_id is not null;

create index if not exists staff_members_shop_auth_user_idx
  on public.staff_members(shop_id, auth_user_id)
  where auth_user_id is not null;

comment on column public.staff_members.auth_user_id is
  'Optional auth user linked to this staff profile. Staff API access is scoped to this staff member and excludes guardian raw phone numbers.';
