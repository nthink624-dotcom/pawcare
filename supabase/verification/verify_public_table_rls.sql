-- Fails when a regular table in the public schema is exposed without RLS.
-- Run after migrations in every Supabase environment.

do $$
declare
  exposed_tables text;
begin
  select string_agg(format('%I.%I', namespace.nspname, relation.relname), ', ' order by relation.relname)
    into exposed_tables
  from pg_class as relation
  join pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p')
    and not relation.relrowsecurity;

  if exposed_tables is not null then
    raise exception 'Public tables without RLS: %', exposed_tables;
  end if;
end
$$;

select
  relation.relname as table_name,
  relation.relrowsecurity as rls_enabled
from pg_class as relation
join pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relkind in ('r', 'p')
order by relation.relname;
