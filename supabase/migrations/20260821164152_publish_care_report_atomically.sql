-- Publish one owner-reviewed AI care report only when the completed grooming
-- record already exists. The final record update and draft cleanup must commit
-- together so the owner cannot see a false-success state while the customer
-- result remains in "care report pending".

create or replace function public.publish_ai_care_report(
  p_shop_id text,
  p_appointment_id uuid,
  p_care_report jsonb,
  p_photo_consent boolean,
  p_confirmed_at timestamptz
)
returns table (
  record_id uuid,
  owner_confirmed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_record_id uuid;
  v_generation_id uuid;
begin
  if p_care_report is null or jsonb_typeof(p_care_report) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'CARE_REPORT_INVALID_PAYLOAD';
  end if;

  select draft.care_report_generation_id
    into v_generation_id
  from public.grooming_record_drafts as draft
  where draft.shop_id = p_shop_id
    and draft.appointment_id = p_appointment_id
  for update;

  select record.id,
         coalesce(v_generation_id, record.care_report_generation_id)
    into v_record_id, v_generation_id
  from public.grooming_records as record
  where record.shop_id = p_shop_id
    and record.appointment_id = p_appointment_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CARE_REPORT_FINAL_RECORD_MISSING';
  end if;

  update public.grooming_records
  set care_report_data = p_care_report,
      care_report_observations = '{}'::jsonb,
      care_report_generation_id = v_generation_id,
      care_report_photo_consent = p_photo_consent,
      care_report_owner_confirmed_at = p_confirmed_at,
      updated_at = p_confirmed_at
  where id = v_record_id;

  delete from public.grooming_record_drafts
  where shop_id = p_shop_id
    and appointment_id = p_appointment_id;

  return query
  select v_record_id, p_confirmed_at;
end;
$$;

revoke all on function public.publish_ai_care_report(text, uuid, jsonb, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.publish_ai_care_report(text, uuid, jsonb, boolean, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
