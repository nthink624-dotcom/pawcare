-- Purpose: Repair legacy rows where a grooming record was created for an appointment
-- but the appointment itself was not persisted as completed.

with latest_linked_grooming_record as (
  select distinct on (appointment_id)
    appointment_id,
    shop_id,
    groomed_at,
    updated_at
  from public.grooming_records
  where appointment_id is not null
  order by appointment_id, groomed_at desc, updated_at desc
)
update public.appointments as appointment
set
  status = 'completed',
  actual_completed_at = coalesce(appointment.actual_completed_at, latest_linked_grooming_record.groomed_at),
  status_changed_at = coalesce(
    appointment.status_changed_at,
    latest_linked_grooming_record.groomed_at,
    latest_linked_grooming_record.updated_at,
    appointment.updated_at,
    appointment.created_at,
    now()
  ),
  status_action_source = coalesce(appointment.status_action_source, 'grooming_record_backfill'),
  updated_at = now()
from latest_linked_grooming_record
where appointment.id = latest_linked_grooming_record.appointment_id
  and appointment.shop_id = latest_linked_grooming_record.shop_id
  and appointment.status in ('confirmed', 'in_progress', 'almost_done');

notify pgrst, 'reload schema';
