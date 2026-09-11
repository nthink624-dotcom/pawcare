-- Repair the already-applied booking/payment integrity migration without
-- changing its recorded source.  The participant conflict target below uses
-- a named constraint because RETURNS TABLE exposes appointment_id as a
-- PL/pgSQL output variable; a bare conflict-column list is ambiguous.

alter table public.appointment_pet_participants
  add constraint appointment_pet_participants_appointment_pet_unique
  unique using index appointment_pet_participants_appointment_pet_unique_idx;

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in (
    'pending',
    'confirmed',
    'in_progress',
    'almost_done',
    'completed',
    'cancelled',
    'rejected',
    'noshow'
  ));

create or replace function public.create_customer_booking_atomic_v1(
  p_idempotency_key_hash text,
  p_payload_hash text,
  p_payload jsonb
) returns table (
  appointment_id uuid,
  guardian_id uuid,
  primary_pet_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.customer_booking_requests%rowtype;
  v_shop_id text := nullif(btrim(p_payload ->> 'shopId'), '');
  v_guardian_id uuid;
  v_primary_pet_id uuid;
  v_appointment_id uuid;
  v_service_id text := nullif(btrim(p_payload ->> 'serviceId'), '');
  v_staff_id text := nullif(btrim(p_payload ->> 'staffId'), '');
  v_payment_id text := nullif(btrim(p_payload ->> 'paymentId'), '');
  v_provider_order_id text := nullif(btrim(p_payload ->> 'providerOrderId'), '');
  v_rebooking_guardian_id uuid := nullif(btrim(p_payload ->> 'rebookingGuardianId'), '')::uuid;
  v_rebooking_pet_id uuid := nullif(btrim(p_payload ->> 'rebookingPetId'), '')::uuid;
  v_guardian_name text := nullif(btrim(p_payload ->> 'guardianName'), '');
  v_guardian_phone text := regexp_replace(coalesce(p_payload ->> 'phone', ''), '\D', '', 'g');
  v_primary_pet_name text := nullif(btrim(p_payload ->> 'petName'), '');
  v_appointment_date date := (p_payload ->> 'appointmentDate')::date;
  v_appointment_time time := (p_payload ->> 'appointmentTime')::time;
  v_duration integer := (p_payload ->> 'durationMinutes')::integer;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_capacity integer;
  v_extra_pet jsonb;
  v_extra_pet_id uuid;
  v_sort_order integer := 1;
begin
  if p_idempotency_key_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'booking request fingerprints are invalid';
  end if;
  if v_shop_id is null or v_service_id is null or v_guardian_name is null or v_guardian_phone = ''
     or v_primary_pet_name is null or v_appointment_date is null or v_appointment_time is null
     or v_duration is null or v_duration not between 15 and 1440 then
    raise exception using errcode = '22023', message = 'customer booking payload is invalid';
  end if;
  if (v_payment_id is null) <> (v_provider_order_id is null) then
    raise exception using errcode = '22023', message = 'payment claim is incomplete';
  end if;

  insert into private.customer_booking_requests (idempotency_key_hash, shop_id, payload_hash, payment_id, provider_order_id)
  values (p_idempotency_key_hash, v_shop_id, p_payload_hash, v_payment_id, v_provider_order_id)
  on conflict (idempotency_key_hash) do nothing;

  select * into v_request
    from private.customer_booking_requests
   where idempotency_key_hash = p_idempotency_key_hash
   for update;

  if v_request.shop_id <> v_shop_id or v_request.payload_hash <> p_payload_hash
     or v_request.payment_id is distinct from v_payment_id
     or v_request.provider_order_id is distinct from v_provider_order_id then
    raise exception using errcode = '23505', message = 'booking idempotency key does not match its original request';
  end if;

  if v_request.completed_at is not null then
    return query select v_request.appointment_id, v_request.guardian_id, v_request.primary_pet_id, true;
    return;
  end if;

  -- The same normalized owner identity cannot create two partially overlapping
  -- guardian/pet rows while concurrent requests are being resolved.
  perform pg_advisory_xact_lock(hashtextextended(v_shop_id || ':guardian:' || lower(regexp_replace(v_guardian_name, '\s+', '', 'g')) || ':' || v_guardian_phone, 0));

  if not exists (select 1 from public.shops s where s.id = v_shop_id) then
    raise exception using errcode = '23503', message = 'shop does not exist';
  end if;
  if not exists (select 1 from public.services s where s.id = v_service_id and s.shop_id = v_shop_id and s.is_active) then
    raise exception using errcode = '23503', message = 'service does not belong to shop';
  end if;
  if v_staff_id is not null and not exists (
    select 1 from public.staff_members s where s.id = v_staff_id and s.shop_id = v_shop_id and s.is_active
  ) then
    raise exception using errcode = '23503', message = 'staff does not belong to shop';
  end if;

  if (v_rebooking_guardian_id is null) <> (v_rebooking_pet_id is null) then
    raise exception using errcode = '22023', message = 'rebooking identity is incomplete';
  end if;

  if v_rebooking_guardian_id is not null then
    select g.id into v_guardian_id
      from public.guardians g
     where g.id = v_rebooking_guardian_id and g.shop_id = v_shop_id and g.deleted_at is null
     for update;
    if v_guardian_id is null then
      raise exception using errcode = '23503', message = 'rebooking guardian does not belong to shop';
    end if;
  else
    select g.id into v_guardian_id
      from public.guardians g
     where g.shop_id = v_shop_id
       and lower(regexp_replace(g.phone, '\D', '', 'g')) = v_guardian_phone
       and lower(regexp_replace(g.name, '\s+', '', 'g')) = lower(regexp_replace(v_guardian_name, '\s+', '', 'g'))
     order by g.created_at
     limit 1
     for update;
  end if;

  if v_guardian_id is null then
    insert into public.guardians (shop_id, name, phone, memo)
    values (v_shop_id, v_guardian_name, v_guardian_phone, '')
    returning id into v_guardian_id;
  else
    update public.guardians
       set name = v_guardian_name, phone = v_guardian_phone, deleted_at = null, deleted_restore_until = null, updated_at = now()
     where id = v_guardian_id and shop_id = v_shop_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_shop_id || ':pet:' || v_guardian_id::text || ':' || lower(v_primary_pet_name), 0));
  if v_rebooking_pet_id is not null then
    select p.id into v_primary_pet_id
      from public.pets p
     where p.id = v_rebooking_pet_id and p.shop_id = v_shop_id and p.guardian_id = v_guardian_id
     for update;
    if v_primary_pet_id is null then
      raise exception using errcode = '23503', message = 'rebooking pet does not belong to guardian and shop';
    end if;
  else
    select p.id into v_primary_pet_id
      from public.pets p
     where p.shop_id = v_shop_id and p.guardian_id = v_guardian_id and lower(p.name) = lower(v_primary_pet_name)
     order by p.created_at
     limit 1
     for update;
  end if;

  if v_primary_pet_id is null then
    insert into public.pets (shop_id, guardian_id, name, breed, weight, age, notes, grooming_cycle_weeks, avatar_seed)
    values (
      v_shop_id, v_guardian_id, v_primary_pet_name,
      coalesce(nullif(btrim(p_payload ->> 'breed'), ''), '미정'),
      nullif(p_payload ->> 'weightKg', '')::numeric,
      null, '', 4, left(v_primary_pet_name, 1)
    ) returning id into v_primary_pet_id;
  end if;

  v_start_at := ((v_appointment_date::text || ' ' || v_appointment_time::text)::timestamp at time zone 'Asia/Seoul');
  v_end_at := v_start_at + make_interval(mins => v_duration);

  if v_staff_id is null then
    select greatest(1, coalesce(s.concurrent_capacity, 1)) into v_capacity from public.shops s where s.id = v_shop_id for update;
    perform pg_advisory_xact_lock(hashtextextended(v_shop_id || ':unassigned-capacity', 0));
    if (
      select count(*) from public.appointments a
       where a.shop_id = v_shop_id
         and a.staff_id is null
         and a.status in ('confirmed', 'in_progress', 'almost_done')
         and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(v_start_at, v_end_at, '[)')
    ) >= v_capacity then
      raise exception using errcode = '23P01', message = 'appointment exceeds shop capacity';
    end if;
  end if;

  insert into public.appointments (
    shop_id, guardian_id, pet_id, service_id, staff_id, appointment_date, appointment_time,
    status, memo, rejection_reason, start_at, end_at, source, customer_visit_type,
    discount_coupon_ids, discount_coupon_names, original_service_price, discount_amount,
    final_service_price, discount_snapshot, status_changed_at, status_action_source
  ) values (
    v_shop_id, v_guardian_id, v_primary_pet_id, v_service_id, v_staff_id, v_appointment_date, v_appointment_time,
    'confirmed', coalesce(p_payload ->> 'memo', ''), null, v_start_at, v_end_at, 'customer',
    nullif(p_payload ->> 'customerVisitType', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'discountCouponIds', '[]'::jsonb))), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'discountCouponNames', '[]'::jsonb))), '{}'::text[]),
    coalesce(nullif(p_payload ->> 'originalServicePrice', '')::integer, 0),
    coalesce(nullif(p_payload ->> 'discountAmount', '')::integer, 0),
    coalesce(nullif(p_payload ->> 'finalServicePrice', '')::integer, 0),
    coalesce(p_payload -> 'discountSnapshot', '{}'::jsonb), now(), 'customer_page'
  ) returning id into v_appointment_id;

  insert into public.appointment_pet_participants (
    shop_id, appointment_id, guardian_id, pet_id, role, service_id, sort_order
  ) values (v_shop_id, v_appointment_id, v_guardian_id, v_primary_pet_id, 'primary', v_service_id, 0);

  for v_extra_pet in select value from jsonb_array_elements(coalesce(p_payload -> 'extraPets', '[]'::jsonb)) loop
    if nullif(btrim(v_extra_pet ->> 'name'), '') is null or lower(btrim(v_extra_pet ->> 'name')) = lower(v_primary_pet_name) then
      continue;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_shop_id || ':pet:' || v_guardian_id::text || ':' || lower(btrim(v_extra_pet ->> 'name')), 0));
    select p.id into v_extra_pet_id
      from public.pets p
     where p.shop_id = v_shop_id and p.guardian_id = v_guardian_id and lower(p.name) = lower(btrim(v_extra_pet ->> 'name'))
     order by p.created_at limit 1 for update;
    if v_extra_pet_id is null then
      insert into public.pets (shop_id, guardian_id, name, breed, weight, age, notes, grooming_cycle_weeks, avatar_seed)
      values (
        v_shop_id, v_guardian_id, btrim(v_extra_pet ->> 'name'),
        coalesce(nullif(btrim(v_extra_pet ->> 'breed'), ''), '미정'), null, null, '', 4, left(btrim(v_extra_pet ->> 'name'), 1)
      ) returning id into v_extra_pet_id;
    end if;
    insert into public.appointment_pet_participants (
      shop_id, appointment_id, guardian_id, pet_id, role, service_id, sort_order
    ) values (v_shop_id, v_appointment_id, v_guardian_id, v_extra_pet_id, 'additional', v_service_id, v_sort_order)
    on conflict on constraint appointment_pet_participants_appointment_pet_unique do nothing;
    v_sort_order := v_sort_order + 1;
  end loop;

  update private.customer_booking_requests
     set appointment_id = v_appointment_id,
         guardian_id = v_guardian_id,
         primary_pet_id = v_primary_pet_id,
         completed_at = now(),
         updated_at = now()
   where idempotency_key_hash = p_idempotency_key_hash;

  return query select v_appointment_id, v_guardian_id, v_primary_pet_id, false;
end;
$$;

revoke all on function public.create_customer_booking_atomic_v1(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_customer_booking_atomic_v1(text, text, jsonb) to service_role;
revoke all on function public.update_appointment_status_atomic_v1(uuid, text, text, text, timestamptz, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_appointment_status_atomic_v1(uuid, text, text, text, timestamptz, uuid, text, jsonb, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
