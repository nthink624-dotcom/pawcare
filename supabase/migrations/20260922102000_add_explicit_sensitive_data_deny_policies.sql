-- Make the server-only access contract explicit for Supabase advisors and reviewers.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'shops',
    'guardians',
    'pets',
    'services',
    'appointments',
    'grooming_records',
    'grooming_record_drafts',
    'notifications',
    'staff_members',
    'owner_shop_memberships',
    'media_assets',
    'media_variants',
    'notification_media_attachments',
    'media_send_attempts',
    'shop_media_usage_months',
    'shop_media_limits'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relkind in ('r', 'p')
    ) and not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'pm_deny_direct_access'
    ) then
      execute format(
        'create policy pm_deny_direct_access on public.%I for all to anon, authenticated using (false) with check (false)',
        table_name
      );
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
