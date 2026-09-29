-- Read-only check for the ACL/RLS alignment migration.
-- A zero count is the expected post-migration result.
with policyless_rls_tables as (
  select n.nspname as schema_name, c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (
      select 1
      from pg_policies p
      where p.schemaname = n.nspname
        and p.tablename = c.relname
    )
), browser_grants as (
  select distinct table_schema as schema_name, table_name
  from information_schema.role_table_grants
  where grantee in ('anon', 'authenticated')
)
select
  count(*)::int as policyless_rls_with_browser_grants,
  case when count(*) = 0 then 'PASS' else 'PENDING_MIGRATION' end as status
from policyless_rls_tables t
join browser_grants g using (schema_name, table_name);
