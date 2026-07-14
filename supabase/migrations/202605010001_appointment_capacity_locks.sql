alter table if exists appointments
  drop constraint if exists appointments_status_check;

alter table if exists appointments
  add constraint appointments_status_check
  check (status in ('pending','confirmed','in_progress','almost_done','completed','cancelled','rejected','noshow'));

create or replace function public.create_appointment_with_capacity_lock(
  p_id uuid,
  p_shop_id text,
  p_guardian_id uuid,
  p_pet_id uuid,
  p_service_id text,
  p_appointment_date date,
  p_appointment_time time,
  p_status text,
  p_memo text,
  p_rejection_reason text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_source text,
  p_created_at timestamptz,
  p_updated_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_peak_overlap int;
  v_row appointments;
begin
  perform pg_advisory_xact_lock(hashtext(p_shop_id || ':' || p_appointment_date::text));

  select concurrent_capacity
    into v_capacity
    from shops
   where id = p_shop_id
   for update;

  if v_capacity is null then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  with overlapping as (
    select start_at, end_at
      from appointments
     where shop_id = p_shop_id
       and status not in ('cancelled', 'rejected', 'noshow')
       and tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ),
  boundaries as (
    select p_start_at as boundary_at
    union
    select p_end_at
    union
    select greatest(start_at, p_start_at) from overlapping
    union
    select least(end_at, p_end_at) from overlapping
  ),
  segments as (
    select boundary_at as segment_start, lead(boundary_at) over (order by boundary_at) as segment_end
      from boundaries
  )
  select coalesce(max((
    select count(*)
      from overlapping
     where overlapping.start_at <= segments.segment_start
       and segments.segment_start < overlapping.end_at
  )), 0)
    into v_peak_overlap
    from segments
   where segment_end is not null
     and segment_start < segment_end;

  if v_peak_overlap >= v_capacity then
    raise exception 'APPOINTMENT_SLOT_UNAVAILABLE';
  end if;

  insert into appointments (
    id,
    shop_id,
    guardian_id,
    pet_id,
    service_id,
    appointment_date,
    appointment_time,
    status,
    memo,
    rejection_reason,
    start_at,
    end_at,
    source,
    created_at,
    updated_at
  )
  values (
    p_id,
    p_shop_id,
    p_guardian_id,
    p_pet_id,
    p_service_id,
    p_appointment_date,
    p_appointment_time,
    p_status,
    p_memo,
    p_rejection_reason,
    p_start_at,
    p_end_at,
    p_source,
    p_created_at,
    p_updated_at
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.update_appointment_with_capacity_lock(
  p_appointment_id uuid,
  p_service_id text,
  p_appointment_date date,
  p_appointment_time time,
  p_memo text,
  p_status text,
  p_rejection_reason text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_updated_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id text;
  v_capacity int;
  v_peak_overlap int;
  v_row appointments;
begin
  select shop_id
    into v_shop_id
    from appointments
   where id = p_appointment_id
   for update;

  if v_shop_id is null then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_shop_id || ':' || p_appointment_date::text));

  select concurrent_capacity
    into v_capacity
    from shops
   where id = v_shop_id
   for update;

  if v_capacity is null then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  with overlapping as (
    select start_at, end_at
      from appointments
     where shop_id = v_shop_id
       and id <> p_appointment_id
       and status not in ('cancelled', 'rejected', 'noshow')
       and tstzrange(start_at, end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  ),
  boundaries as (
    select p_start_at as boundary_at
    union
    select p_end_at
    union
    select greatest(start_at, p_start_at) from overlapping
    union
    select least(end_at, p_end_at) from overlapping
  ),
  segments as (
    select boundary_at as segment_start, lead(boundary_at) over (order by boundary_at) as segment_end
      from boundaries
  )
  select coalesce(max((
    select count(*)
      from overlapping
     where overlapping.start_at <= segments.segment_start
       and segments.segment_start < overlapping.end_at
  )), 0)
    into v_peak_overlap
    from segments
   where segment_end is not null
     and segment_start < segment_end;

  if v_peak_overlap >= v_capacity then
    raise exception 'APPOINTMENT_SLOT_UNAVAILABLE';
  end if;

  update appointments
     set service_id = p_service_id,
         appointment_date = p_appointment_date,
         appointment_time = p_appointment_time,
         memo = p_memo,
         status = p_status,
         rejection_reason = p_rejection_reason,
         start_at = p_start_at,
         end_at = p_end_at,
         updated_at = p_updated_at
   where id = p_appointment_id
  returning * into v_row;

  return v_row;
end;
$$;
