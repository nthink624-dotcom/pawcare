alter table if exists owner_profiles
  add column if not exists phone_number text,
  add column if not exists identity_verified_at timestamptz;
