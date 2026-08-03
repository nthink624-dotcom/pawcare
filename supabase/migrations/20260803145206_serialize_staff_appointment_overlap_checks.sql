-- Serialize overlap checks per shop/staff pair so concurrent inserts and updates
-- cannot both pass the trigger before either transaction commits.
create or replace function public.prevent_overlapping_staff_appointments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.staff_id is null then
    return new;
  end if;

  if new.status not in ('confirmed', 'in_progress', 'almost_done') then
    return new;
  end if;

  if new.start_at is null or new.end_at is null or new.start_at >= new.end_at then
    raise exception using
      errcode = '22007',
      message = 'appointment time window is invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.shop_id::text || ':' || new.staff_id::text, 0)
  );

  if exists (
    select 1
    from public.appointments existing
    where existing.shop_id = new.shop_id
      and existing.staff_id = new.staff_id
      and existing.id <> new.id
      and existing.status in ('confirmed', 'in_progress', 'almost_done')
      and tstzrange(existing.start_at, existing.end_at, '[)')
          && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception using
      errcode = '23P01',
      message = 'appointment overlaps another active appointment for the same staff member';
  end if;

  return new;
end;
$$;

alter view public.appointment_staff_overlap_conflicts
  set (security_invoker = true);

notify pgrst, 'reload schema';
