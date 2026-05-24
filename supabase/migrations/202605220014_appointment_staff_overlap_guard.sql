-- Title: 2026-05-22 예약 담당자 시간 겹침 방지 스키마 보강
-- Purpose: Prevent active appointments from overlapping for the same staff member.

create or replace view public.appointment_staff_overlap_conflicts as
select
  first_appointment.shop_id,
  first_appointment.staff_id,
  first_appointment.id as appointment_id,
  second_appointment.id as overlapping_appointment_id,
  first_appointment.appointment_date as appointment_date,
  first_appointment.status as appointment_status,
  second_appointment.status as overlapping_status,
  greatest(first_appointment.start_at, second_appointment.start_at) as overlap_starts_at,
  least(first_appointment.end_at, second_appointment.end_at) as overlap_ends_at,
  first_appointment.start_at as appointment_starts_at,
  first_appointment.end_at as appointment_ends_at,
  second_appointment.start_at as overlapping_starts_at,
  second_appointment.end_at as overlapping_ends_at
from public.appointments first_appointment
join public.appointments second_appointment
  on second_appointment.shop_id = first_appointment.shop_id
 and second_appointment.staff_id = first_appointment.staff_id
 and second_appointment.id::text > first_appointment.id::text
 and tstzrange(second_appointment.start_at, second_appointment.end_at, '[)')
     && tstzrange(first_appointment.start_at, first_appointment.end_at, '[)')
where first_appointment.staff_id is not null
  and second_appointment.staff_id is not null
  and first_appointment.status in ('pending', 'confirmed', 'in_progress', 'almost_done')
  and second_appointment.status in ('pending', 'confirmed', 'in_progress', 'almost_done');

create or replace function public.prevent_overlapping_staff_appointments()
returns trigger
language plpgsql
as $$
begin
  if new.staff_id is null then
    return new;
  end if;

  if new.status not in ('pending', 'confirmed', 'in_progress', 'almost_done') then
    return new;
  end if;

  if new.start_at is null or new.end_at is null or new.start_at >= new.end_at then
    raise exception 'appointment time window is invalid';
  end if;

  if exists (
    select 1
    from public.appointments existing
    where existing.shop_id = new.shop_id
      and existing.staff_id = new.staff_id
      and existing.id <> new.id
      and existing.status in ('pending', 'confirmed', 'in_progress', 'almost_done')
      and tstzrange(existing.start_at, existing.end_at, '[)')
          && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception 'appointment overlaps another active appointment for the same staff member';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_prevent_staff_overlap on public.appointments;

create trigger appointments_prevent_staff_overlap
before insert or update of shop_id, staff_id, status, start_at, end_at
on public.appointments
for each row
execute function public.prevent_overlapping_staff_appointments();

notify pgrst, 'reload schema';
