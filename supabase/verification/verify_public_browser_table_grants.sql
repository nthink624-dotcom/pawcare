-- Read-only inventory of direct and inherited table privileges held by API
-- browser roles. Expected result: zero rows. RLS alone is not a substitute for
-- revoking unnecessary table-level privileges.
select
  c.relname as table_name,
  r.rolname as grantee,
  array_remove(array[
    case when has_table_privilege(r.rolname, c.oid, 'select') then 'select' end,
    case when has_table_privilege(r.rolname, c.oid, 'insert') then 'insert' end,
    case when has_table_privilege(r.rolname, c.oid, 'update') then 'update' end,
    case when has_table_privilege(r.rolname, c.oid, 'delete') then 'delete' end,
    case when has_table_privilege(r.rolname, c.oid, 'truncate') then 'truncate' end
  ], null) as privileges,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join pg_roles r
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and r.rolname in ('anon', 'authenticated')
  and (
    has_table_privilege(r.rolname, c.oid, 'select')
    or has_table_privilege(r.rolname, c.oid, 'insert')
    or has_table_privilege(r.rolname, c.oid, 'update')
    or has_table_privilege(r.rolname, c.oid, 'delete')
    or has_table_privilege(r.rolname, c.oid, 'truncate')
  )
order by c.relname, r.rolname;
