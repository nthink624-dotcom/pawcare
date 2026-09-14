-- Repair the production prerequisites for atomic appointment writes without
-- reviving the legacy SECURITY DEFINER capacity RPCs.
do $$
begin
  if to_regclass('public.appointments') is null then
    raise exception using
      errcode = '42P01',
      message = 'public.appointments is required before repairing its overlap guard';
  end if;

  if to_regprocedure('public.prevent_overlapping_staff_appointments()') is null then
    raise exception using
      errcode = '42883',
      message = 'public.prevent_overlapping_staff_appointments() is required before repairing its trigger';
  end if;
end;
$$;

-- This column already has a canonical historical migration. Re-assert it here
-- because production advanced without recording or applying that migration,
-- and mobile owner writes must persist every field in the same INSERT/UPDATE.
alter table public.appointments
  add column if not exists staff_memo text;

update public.appointments
set
  staff_memo = memo,
  memo = ''
where source = 'owner'
  and btrim(coalesce(staff_memo, '')) = ''
  and btrim(coalesce(memo, '')) <> '';

update public.appointments
set staff_memo = ''
where staff_memo is null;

alter table public.appointments
  alter column staff_memo set default '',
  alter column staff_memo set not null;

drop trigger if exists appointments_prevent_staff_overlap on public.appointments;

create trigger appointments_prevent_staff_overlap
before insert or update of shop_id, staff_id, status, start_at, end_at
on public.appointments
for each row
execute function public.prevent_overlapping_staff_appointments();

alter table public.appointments
  enable trigger appointments_prevent_staff_overlap;

-- Trigger execution does not require a client-callable RPC surface. Keep only
-- the server role explicit and do not introduce SECURITY DEFINER behavior.
revoke execute on function public.prevent_overlapping_staff_appointments() from public;
revoke execute on function public.prevent_overlapping_staff_appointments() from anon, authenticated;
grant execute on function public.prevent_overlapping_staff_appointments() to service_role;

do $$
begin
  if not exists (
    select 1
      from information_schema.columns column_metadata
     where column_metadata.table_schema = 'public'
       and column_metadata.table_name = 'appointments'
       and column_metadata.column_name = 'staff_memo'
       and column_metadata.is_nullable = 'NO'
  ) then
    raise exception using
      errcode = '55000',
      message = 'appointments.staff_memo is not ready for atomic appointment writes';
  end if;

  if not exists (
    select 1
      from pg_catalog.pg_trigger trigger_metadata
      join pg_catalog.pg_class relation_metadata
        on relation_metadata.oid = trigger_metadata.tgrelid
      join pg_catalog.pg_namespace schema_metadata
        on schema_metadata.oid = relation_metadata.relnamespace
      join pg_catalog.pg_proc function_metadata
        on function_metadata.oid = trigger_metadata.tgfoid
     where schema_metadata.nspname = 'public'
       and relation_metadata.relname = 'appointments'
       and trigger_metadata.tgname = 'appointments_prevent_staff_overlap'
       and trigger_metadata.tgenabled = 'O'
       and not trigger_metadata.tgisinternal
       and function_metadata.oid = 'public.prevent_overlapping_staff_appointments()'::regprocedure
       and not function_metadata.prosecdef
  ) then
    raise exception using
      errcode = '55000',
      message = 'assigned staff overlap trigger is not enabled or not bound to its invoker guard';
  end if;

  if has_function_privilege('public', 'public.prevent_overlapping_staff_appointments()', 'EXECUTE')
     or has_function_privilege('anon', 'public.prevent_overlapping_staff_appointments()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.prevent_overlapping_staff_appointments()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.prevent_overlapping_staff_appointments()', 'EXECUTE') then
    raise exception using
      errcode = '55000',
      message = 'assigned staff overlap guard execute privileges are not least-privilege';
  end if;
end;
$$;

notify pgrst, 'reload schema';
