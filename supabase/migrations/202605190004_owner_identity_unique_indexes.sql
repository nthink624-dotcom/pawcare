alter table if exists owner_profiles
  add column if not exists ci_hash text,
  add column if not exists di_hash text;

create unique index if not exists owner_profiles_ci_hash_unique
  on owner_profiles(ci_hash)
  where ci_hash is not null;

create unique index if not exists owner_profiles_di_hash_unique
  on owner_profiles(di_hash)
  where di_hash is not null;
