-- Title: Atomic customer booking, payment claim, and tenant integrity
-- Purpose: Keep one customer booking request, its participants, and an optional provider payment claim in one transaction.

create schema if not exists private;

create table if not exists private.customer_booking_requests (
  idempotency_key_hash char(64) primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  payload_hash char(64) not null,
  appointment_id uuid references public.appointments(id) on delete restrict,
  guardian_id uuid references public.guardians(id) on delete restrict,
  primary_pet_id uuid references public.pets(id) on delete restrict,
  payment_id text unique,
  provider_order_id text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_booking_requests_completed_shape_check
    check (
      (completed_at is null and appointment_id is null and guardian_id is null and primary_pet_id is null)
      or (completed_at is not null and appointment_id is not null and guardian_id is not null and primary_pet_id is not null)
    )
);

create index if not exists customer_booking_requests_shop_created_idx
  on private.customer_booking_requests (shop_id, created_at desc);

-- A provider order is a global payment-provider token, not a shop-local label.
-- Keep unpaid requests nullable, but prevent a successful claim from being reused.
create unique index if not exists customer_booking_requests_provider_order_id_unique
  on private.customer_booking_requests (provider_order_id)
  where provider_order_id is not null;

alter table private.customer_booking_requests enable row level security;
revoke all on table private.customer_booking_requests from public, anon, authenticated;
grant select, insert, update on table private.customer_booking_requests to service_role;

-- Composite reference keys make tenant scope part of the relationship rather than
-- an application convention. NOT VALID protects all new rows without rejecting a
-- deployment solely because a legacy row needs a separately reviewed repair.
create unique index if not exists guardians_id_shop_id_key
  on public.guardians (id, shop_id);
create unique index if not exists pets_id_guardian_shop_id_key
  on public.pets (id, guardian_id, shop_id);
create unique index if not exists services_id_shop_id_key
  on public.services (id, shop_id);
create unique index if not exists staff_members_id_shop_id_key
  on public.staff_members (id, shop_id);
create unique index if not exists appointments_id_shop_id_key
  on public.appointments (id, shop_id);

alter table public.appointments
  drop constraint if exists appointments_guardian_shop_tenant_fk,
  add constraint appointments_guardian_shop_tenant_fk
    foreign key (guardian_id, shop_id)
    references public.guardians (id, shop_id) on delete cascade not valid,
  drop constraint if exists appointments_pet_guardian_shop_tenant_fk,
  add constraint appointments_pet_guardian_shop_tenant_fk
    foreign key (pet_id, guardian_id, shop_id)
    references public.pets (id, guardian_id, shop_id) on delete cascade not valid,
  drop constraint if exists appointments_service_shop_tenant_fk,
  add constraint appointments_service_shop_tenant_fk
    foreign key (service_id, shop_id)
    references public.services (id, shop_id) on delete restrict not valid,
  drop constraint if exists appointments_staff_shop_tenant_fk,
  add constraint appointments_staff_shop_tenant_fk
    foreign key (staff_id, shop_id)
    references public.staff_members (id, shop_id) on delete set null (staff_id) not valid;

alter table public.appointment_pet_participants
  drop constraint if exists appointment_pet_participants_guardian_shop_tenant_fk,
  add constraint appointment_pet_participants_guardian_shop_tenant_fk
    foreign key (guardian_id, shop_id)
    references public.guardians (id, shop_id) on delete cascade not valid,
  drop constraint if exists appointment_pet_participants_pet_guardian_shop_tenant_fk,
  add constraint appointment_pet_participants_pet_guardian_shop_tenant_fk
    foreign key (pet_id, guardian_id, shop_id)
    references public.pets (id, guardian_id, shop_id) on delete cascade not valid,
  drop constraint if exists appointment_pet_participants_appointment_shop_tenant_fk,
  add constraint appointment_pet_participants_appointment_shop_tenant_fk
    foreign key (appointment_id, shop_id)
    references public.appointments (id, shop_id) on delete cascade not valid,
  drop constraint if exists appointment_pet_participants_service_shop_tenant_fk,
  add constraint appointment_pet_participants_service_shop_tenant_fk
    foreign key (service_id, shop_id)
    references public.services (id, shop_id) on delete set null (service_id) not valid;

create or replace function private.assert_linked_row_shop(
  p_shop_id text,
  p_appointment_id uuid,
  p_guardian_id uuid,
  p_pet_id uuid
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
  v_pet public.pets%rowtype;
begin
  if p_appointment_id is not null then
    select a.* into v_appointment
      from public.appointments a
      where a.id = p_appointment_id and a.shop_id = p_shop_id
      for key share;
    if not found then
      raise exception using errcode = '23503', message = 'appointment does not belong to shop';
    end if;
  end if;
  if p_guardian_id is not null and not exists (
    select 1 from public.guardians g where g.id = p_guardian_id and g.shop_id = p_shop_id
  ) then
    raise exception using errcode = '23503', message = 'guardian does not belong to shop';
  end if;
  if p_pet_id is not null then
    select p.* into v_pet
      from public.pets p
      where p.id = p_pet_id and p.shop_id = p_shop_id
      for key share;
    if not found then
      raise exception using errcode = '23503', message = 'pet does not belong to shop';
    end if;
  end if;
  if p_appointment_id is not null and p_guardian_id is not null
     and v_appointment.guardian_id is distinct from p_guardian_id then
    raise exception using errcode = '23503', message = 'appointment guardian does not match linked guardian';
  end if;
  if p_appointment_id is not null and p_pet_id is not null
     and v_appointment.pet_id is distinct from p_pet_id then
    raise exception using errcode = '23503', message = 'appointment pet does not match linked pet';
  end if;
  if p_guardian_id is not null and p_pet_id is not null
     and v_pet.guardian_id is distinct from p_guardian_id then
    raise exception using errcode = '23503', message = 'pet does not belong to linked guardian';
  end if;
end;
$$;

create or replace function private.assert_notification_tenant_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_linked_row_shop(new.shop_id, new.appointment_id, new.guardian_id, new.pet_id);
  return new;
end;
$$;

drop trigger if exists notifications_assert_tenant_integrity on public.notifications;
create trigger notifications_assert_tenant_integrity
before insert or update of shop_id, appointment_id, guardian_id, pet_id on public.notifications
for each row execute function private.assert_notification_tenant_integrity();

create or replace function private.assert_media_asset_tenant_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.assert_linked_row_shop(new.shop_id, new.appointment_id, new.guardian_id, new.pet_id);
  return new;
end;
$$;

drop trigger if exists media_assets_assert_tenant_integrity on public.media_assets;
create trigger media_assets_assert_tenant_integrity
before insert or update of shop_id, appointment_id, guardian_id, pet_id on public.media_assets
for each row execute function private.assert_media_asset_tenant_integrity();

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
    on conflict (appointment_id, pet_id) do nothing;
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

-- The status row, its audit history, the completion record, and any linked
-- grooming media must either commit together or not at all.  The function is
-- intentionally server-only: client code never receives a callable mutation
-- that bypasses the tenant and transition checks below.
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
     or (p_next_status in ('rejected', 'noshow') and v_before.status <> 'confirmed')
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

    update public.media_assets
       set grooming_record_id = v_record_id,
           updated_at = p_changed_at
     where shop_id = v_before.shop_id
       and appointment_id = v_before.id
       and grooming_record_id is null;
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

revoke all on function private.assert_linked_row_shop(text, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.assert_notification_tenant_integrity() from public, anon, authenticated;
revoke all on function private.assert_media_asset_tenant_integrity() from public, anon, authenticated;
revoke all on function public.create_customer_booking_atomic_v1(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_customer_booking_atomic_v1(text, text, jsonb) to service_role;
revoke all on function public.update_appointment_status_atomic_v1(uuid, text, text, text, timestamptz, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_appointment_status_atomic_v1(uuid, text, text, text, timestamptz, uuid, text, jsonb, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
