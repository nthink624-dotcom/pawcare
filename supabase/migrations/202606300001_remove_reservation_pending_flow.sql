-- Title: Remove customer reservation pending flow
-- Purpose: Customer reservations are created as confirmed immediately; keep legacy pending rows from reappearing.

update public.appointments
set
  status = 'confirmed',
  rejection_reason = null,
  status_changed_at = coalesce(status_changed_at, updated_at, created_at, now()),
  status_action_source = coalesce(status_action_source, 'system'),
  updated_at = now()
where status = 'pending';

update public.shops
set
  approval_mode = 'auto',
  concurrent_capacity = 1,
  reservation_policy_settings = jsonb_set(
    coalesce(reservation_policy_settings, '{}'::jsonb),
    '{pending_hold_limit}',
    '1'::jsonb,
    true
  ),
  updated_at = now()
where approval_mode <> 'auto'
   or concurrent_capacity <> 1
   or coalesce(reservation_policy_settings ->> 'pending_hold_limit', '') <> '1';

alter table if exists public.shops
  alter column approval_mode set default 'auto';

alter table if exists public.appointments
  drop constraint if exists appointments_status_check;

alter table if exists public.appointments
  add constraint appointments_status_check
    check (status in ('confirmed', 'in_progress', 'almost_done', 'completed', 'cancelled', 'rejected', 'noshow'));

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
  and first_appointment.status in ('confirmed', 'in_progress', 'almost_done')
  and second_appointment.status in ('confirmed', 'in_progress', 'almost_done');

create or replace function public.prevent_overlapping_staff_appointments()
returns trigger
language plpgsql
as $$
begin
  if new.staff_id is null then
    return new;
  end if;

  if new.status not in ('confirmed', 'in_progress', 'almost_done') then
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
      and existing.status in ('confirmed', 'in_progress', 'almost_done')
      and tstzrange(existing.start_at, existing.end_at, '[)')
          && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception 'appointment overlaps another active appointment for the same staff member';
  end if;

  return new;
end;
$$;

create or replace view public.customer_search_profiles as
select
  guardians.shop_id,
  guardians.id as guardian_id,
  guardians.name as guardian_name,
  guardians.phone as guardian_phone,
  regexp_replace(guardians.phone, '\D', '', 'g') as guardian_phone_digits,
  right(regexp_replace(guardians.phone, '\D', '', 'g'), 4) as guardian_phone_tail,
  guardians.memo as guardian_memo,
  coalesce(
    array_agg(distinct pets.name order by pets.name) filter (where pets.id is not null),
    array[]::text[]
  ) as pet_names,
  coalesce(count(distinct pets.id), 0)::integer as pet_count,
  coalesce(
    array_agg(distinct pet_labels.label order by pet_labels.label) filter (where pet_labels.id is not null),
    array[]::text[]
  ) as pet_labels,
  coalesce(
    array_agg(distinct guardian_labels.label order by guardian_labels.label) filter (where guardian_labels.id is not null),
    array[]::text[]
  ) as guardian_labels,
  max(appointments.appointment_date) filter (
    where appointments.status in ('completed')
       or appointments.appointment_date < (now() at time zone 'Asia/Seoul')::date
  ) as recent_visit_date,
  min(
    appointments.appointment_date::text || ' ' || appointments.appointment_time::text
  ) filter (
    where appointments.status in ('confirmed', 'in_progress', 'almost_done')
      and appointments.appointment_date >= (now() at time zone 'Asia/Seoul')::date
  ) as next_appointment_text,
  count(distinct appointments.id)::integer as appointment_count,
  count(distinct appointments.id) filter (where appointments.status = 'noshow')::integer as noshow_count,
  guardians.created_at,
  guardians.updated_at
from public.guardians
left join public.pets
  on pets.shop_id = guardians.shop_id
 and pets.guardian_id = guardians.id
left join public.guardian_labels
  on guardian_labels.shop_id = guardians.shop_id
 and guardian_labels.guardian_id = guardians.id
left join public.pet_labels
  on pet_labels.shop_id = guardians.shop_id
 and pet_labels.guardian_id = guardians.id
left join public.appointments
  on appointments.shop_id = guardians.shop_id
 and appointments.guardian_id = guardians.id
where coalesce(guardians.deleted_at, null) is null
group by
  guardians.shop_id,
  guardians.id,
  guardians.name,
  guardians.phone,
  guardians.memo,
  guardians.created_at,
  guardians.updated_at;

notify pgrst, 'reload schema';
