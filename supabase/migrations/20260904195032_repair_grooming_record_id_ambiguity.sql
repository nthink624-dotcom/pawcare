-- Qualify media_assets predicates inside the status RPC. Its RETURNS TABLE
-- output column is also named grooming_record_id, so an
-- unqualified predicate is ambiguous in PL/pgSQL and rolls back completion.
create or replace function public.update_appointment_status_atomic_v1(
  p_appointment_id uuid,
  p_expected_previous_status text,
  p_next_status text,
  p_rejection_reason text,
  p_changed_at timestamptz,
  p_event_id uuid,
  p_event_note text,
  p_event_previous_values jsonb,
  p_event_next_values jsonb,
  p_completion jsonb default null
) returns table (
  appointment jsonb,
  grooming_record_id uuid,
  care_report_owner_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.appointments%rowtype;
  v_after public.appointments%rowtype;
  v_record_id uuid;
  v_existing_record_id uuid;
  v_completion jsonb := coalesce(p_completion, '{}'::jsonb);
begin
  if p_expected_previous_status is null
     or p_next_status not in ('pending', 'confirmed', 'in_progress', 'almost_done', 'completed', 'cancelled', 'rejected', 'noshow') then
    raise exception using errcode = '22023', message = 'appointment status payload is invalid';
  end if;

  select a.* into v_before
    from public.appointments a
    where a.id = p_appointment_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'appointment was not found';
  end if;
  if v_before.status is distinct from p_expected_previous_status then
    raise exception using errcode = '40001', message = 'appointment status changed concurrently';
  end if;
  if v_before.status = p_next_status then
    raise exception using errcode = 'P0001', message = 'appointment status is already set';
  end if;
  if p_next_status = 'pending' then
    raise exception using errcode = '22023', message = 'pending is creation-only';
  end if;
  if v_before.status in ('completed', 'cancelled', 'rejected', 'noshow')
     or (v_before.status = 'pending' and p_next_status not in ('confirmed', 'cancelled', 'rejected'))
     or (p_next_status = 'in_progress' and v_before.status <> 'confirmed')
     or (p_next_status = 'almost_done' and v_before.status <> 'in_progress')
     or (p_next_status = 'completed' and v_before.status not in ('in_progress', 'almost_done'))
     or (p_next_status = 'rejected' and v_before.status not in ('pending', 'confirmed'))
     or (p_next_status = 'noshow' and v_before.status <> 'confirmed')
     or (p_next_status = 'confirmed' and v_before.status <> 'pending') then
    raise exception using errcode = '22023', message = 'appointment status transition is not allowed';
  end if;

  if p_next_status = 'completed' then
    if nullif(v_completion ->> 'recordId', '') is null then
      raise exception using errcode = '22023', message = 'completion record is required';
    end if;
    v_record_id := (v_completion ->> 'recordId')::uuid;

    select r.id into v_existing_record_id
      from public.grooming_records r
      where r.appointment_id = v_before.id
      for update;
    if found and v_existing_record_id is distinct from v_record_id then
      raise exception using errcode = '23505', message = 'appointment completion record does not match';
    end if;

    insert into public.grooming_records (
      id, shop_id, guardian_id, pet_id, staff_id, service_id, appointment_id,
      style_notes, memo, internal_memo, price_paid, actual_duration_minutes,
      expected_duration_minutes, original_price, discount_amount,
      pet_breed_snapshot, pet_weight_snapshot, pricing_group_snapshot,
      service_name_snapshot, record_source, next_recommended_visit_date,
      care_report_data, care_report_observations, care_report_generation_id,
      care_report_owner_confirmed_at, care_report_photo_consent,
      before_media_asset_id, after_media_asset_id, groomed_at, created_at, updated_at
    ) values (
      v_record_id, v_before.shop_id, v_before.guardian_id, v_before.pet_id,
      nullif(v_completion ->> 'staffId', ''), v_before.service_id, v_before.id,
      coalesce(v_completion ->> 'styleNotes', ''), coalesce(v_completion ->> 'memo', ''),
      coalesce(v_completion ->> 'internalMemo', ''),
      coalesce((v_completion ->> 'pricePaid')::integer, 0),
      nullif(v_completion ->> 'actualDurationMinutes', '')::integer,
      nullif(v_completion ->> 'expectedDurationMinutes', '')::integer,
      nullif(v_completion ->> 'originalPrice', '')::integer,
      coalesce((v_completion ->> 'discountAmount')::integer, 0),
      nullif(v_completion ->> 'petBreedSnapshot', ''),
      nullif(v_completion ->> 'petWeightSnapshot', '')::numeric,
      nullif(v_completion ->> 'pricingGroupSnapshot', ''),
      nullif(v_completion ->> 'serviceNameSnapshot', ''),
      'owner', nullif(v_completion ->> 'nextRecommendedVisitDate', '')::date,
      v_completion -> 'careReportData',
      coalesce(v_completion -> 'careReportObservations', '{}'::jsonb),
      nullif(v_completion ->> 'careReportGenerationId', '')::uuid,
      nullif(v_completion ->> 'careReportOwnerConfirmedAt', '')::timestamptz,
      coalesce((v_completion ->> 'careReportPhotoConsent')::boolean, false),
      nullif(v_completion ->> 'beforeMediaAssetId', '')::uuid,
      nullif(v_completion ->> 'afterMediaAssetId', '')::uuid,
      coalesce(nullif(v_completion ->> 'groomedAt', '')::timestamptz, p_changed_at),
      p_changed_at, p_changed_at
    ) on conflict (id) do update set
      staff_id = excluded.staff_id,
      service_id = excluded.service_id,
      style_notes = excluded.style_notes,
      memo = excluded.memo,
      internal_memo = excluded.internal_memo,
      price_paid = excluded.price_paid,
      actual_duration_minutes = excluded.actual_duration_minutes,
      expected_duration_minutes = excluded.expected_duration_minutes,
      original_price = excluded.original_price,
      discount_amount = excluded.discount_amount,
      pet_breed_snapshot = excluded.pet_breed_snapshot,
      pet_weight_snapshot = excluded.pet_weight_snapshot,
      pricing_group_snapshot = excluded.pricing_group_snapshot,
      service_name_snapshot = excluded.service_name_snapshot,
      next_recommended_visit_date = excluded.next_recommended_visit_date,
      care_report_data = excluded.care_report_data,
      care_report_observations = excluded.care_report_observations,
      care_report_generation_id = excluded.care_report_generation_id,
      care_report_owner_confirmed_at = excluded.care_report_owner_confirmed_at,
      care_report_photo_consent = excluded.care_report_photo_consent,
      before_media_asset_id = excluded.before_media_asset_id,
      after_media_asset_id = excluded.after_media_asset_id,
      groomed_at = excluded.groomed_at,
      updated_at = excluded.updated_at;

    update public.media_assets as media_asset
       set grooming_record_id = v_record_id,
           updated_at = p_changed_at
     where media_asset.shop_id = v_before.shop_id
       and media_asset.appointment_id = v_before.id
       and media_asset.grooming_record_id is null;
  end if;

  update public.appointments
     set status = p_next_status,
         rejection_reason = p_rejection_reason,
         actual_started_at = case when p_next_status = 'in_progress' then p_changed_at else actual_started_at end,
         actual_completed_at = case when p_next_status = 'completed' then p_changed_at else actual_completed_at end,
         updated_at = p_changed_at
   where id = v_before.id
     and status = p_expected_previous_status
  returning * into v_after;
  if not found then
    raise exception using errcode = '40001', message = 'appointment status changed concurrently';
  end if;

  if p_event_id is null or p_event_previous_values is null or p_event_next_values is null then
    raise exception using errcode = '22023', message = 'appointment history is required';
  end if;
  insert into public.appointment_change_events (
    id, shop_id, appointment_id, event_type, previous_values, next_values, note, created_at
  ) values (
    p_event_id, v_after.shop_id, v_after.id, 'status', p_event_previous_values, p_event_next_values, p_event_note, p_changed_at
  );

  return query select
    to_jsonb(v_after),
    v_record_id,
    nullif(v_completion ->> 'careReportOwnerConfirmedAt', '')::timestamptz;
end;
$$;

revoke all on function public.update_appointment_status_atomic_v1(uuid, text, text, text, timestamptz, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_appointment_status_atomic_v1(uuid, text, text, text, timestamptz, uuid, text, jsonb, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
