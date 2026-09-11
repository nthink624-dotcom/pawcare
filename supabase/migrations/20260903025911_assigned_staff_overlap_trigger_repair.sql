-- Restore the trigger that invokes the existing, transaction-serialized
-- assigned-staff overlap guard.  The function itself remains unchanged.
drop trigger if exists appointments_prevent_staff_overlap on public.appointments;

create trigger appointments_prevent_staff_overlap
before insert or update of shop_id, staff_id, status, start_at, end_at
on public.appointments
for each row
execute function public.prevent_overlapping_staff_appointments();

alter table public.appointments
  enable trigger appointments_prevent_staff_overlap;

do $$
begin
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
  ) then
    raise exception using
      errcode = '55000',
      message = 'assigned staff overlap trigger is not enabled or not bound to its guard';
  end if;
end;
$$;

notify pgrst, 'reload schema';
