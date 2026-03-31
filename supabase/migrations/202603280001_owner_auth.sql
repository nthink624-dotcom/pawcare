alter table if exists shops
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists shops_owner_user_id_unique
  on shops(owner_user_id)
  where owner_user_id is not null;
