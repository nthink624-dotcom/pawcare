alter table guardians
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_restore_until timestamptz;
