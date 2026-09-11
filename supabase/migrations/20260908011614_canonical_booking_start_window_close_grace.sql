-- The customer-visible booking window is an inclusive start-time window.
-- A separate close grace bounds the appointment end without weakening staff,
-- closure, blocked-window, capacity, or overlap checks.
update public.shops
set reservation_policy_settings = jsonb_set(
  coalesce(reservation_policy_settings, '{}'::jsonb),
  '{booking_close_grace_minutes}',
  to_jsonb(
    case
      when jsonb_typeof(reservation_policy_settings -> 'booking_close_grace_minutes') = 'number'
       and reservation_policy_settings ->> 'booking_close_grace_minutes' in ('0', '15', '30', '60')
        then (reservation_policy_settings ->> 'booking_close_grace_minutes')::integer
      else 0
    end
  ),
  true
);

alter table public.shops
  drop constraint if exists shops_booking_close_grace_minutes_check,
  add constraint shops_booking_close_grace_minutes_check
    check (
      jsonb_typeof(reservation_policy_settings -> 'booking_close_grace_minutes') = 'number'
      and reservation_policy_settings ->> 'booking_close_grace_minutes' in ('0', '15', '30', '60')
    );

create or replace function private.assert_appointment_booking_start_cutoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop public.shops%rowtype;
  v_staff public.staff_members%rowtype;
  v_override public.staff_schedule_overrides%rowtype;
  v_hours jsonb;
  v_weekday integer := extract(dow from new.appointment_date)::integer;
  v_weekday_keys constant text[] := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_weekday_key text := v_weekday_keys[extract(dow from new.appointment_date)::integer + 1];
  v_staff_start time;
  v_staff_end time;
  v_business_open time;
  v_business_close time;
  v_booking_start time;
  v_booking_end time;
  v_latest_end_local timestamp without time zone;
  v_duration interval := new.end_at - new.start_at;
  v_close_grace_minutes integer;
  v_cycle text;
  v_week_of_month integer;
  v_is_regular_closed boolean := false;
begin
  if new.status in ('cancelled', 'rejected', 'noshow') then
    return new;
  end if;
  if new.appointment_date is null or new.appointment_time is null
     or new.start_at is null or new.end_at is null
     or v_duration <= interval '0 minutes' or v_duration > interval '24 hours' then
    raise exception using errcode = '22023', message = 'booking window is invalid';
  end if;
  if (new.start_at at time zone 'Asia/Seoul')::date <> new.appointment_date
     or date_trunc('minute', new.start_at at time zone 'Asia/Seoul')::time <> new.appointment_time then
    raise exception using errcode = '22023', message = 'booking timezone is invalid';
  end if;

  select s.* into v_shop
    from public.shops s
   where s.id = new.shop_id
   for key share;
  if not found then
    raise exception using errcode = '23503', message = 'booking shop does not exist';
  end if;

  v_hours := v_shop.business_hours -> v_weekday::text;
  if jsonb_typeof(v_hours) <> 'object' or coalesce((v_hours ->> 'enabled')::boolean, false) is not true then
    raise exception using errcode = '22023', message = 'booking shop is closed';
  end if;
  if new.appointment_date = any(v_shop.temporary_closed_dates) then
    raise exception using errcode = '22023', message = 'booking shop is closed';
  end if;

  if v_weekday = any(v_shop.regular_closed_days) then
    v_cycle := coalesce(v_shop.regular_closed_cycle, 'weekly');
    v_week_of_month := ceil(extract(day from new.appointment_date)::numeric / 7)::integer;
    v_is_regular_closed := case v_cycle
      when 'weekly' then true
      when 'biweekly' then v_shop.regular_closed_anchor_date is null
        or mod(abs(((date_trunc('week', new.appointment_date)::date - date_trunc('week', v_shop.regular_closed_anchor_date)::date) / 7)::integer), 2) = 0
      when 'monthly_1_3' then v_week_of_month in (1, 3)
      when 'monthly_2_4' then v_week_of_month in (2, 4)
      else true
    end;
  end if;
  if v_is_regular_closed then
    raise exception using errcode = '22023', message = 'booking shop is closed';
  end if;

  if nullif(btrim(v_shop.booking_available_start_time), '') is null
     or nullif(btrim(v_shop.booking_available_end_time), '') is null then
    raise exception using errcode = '22023', message = 'booking start window is invalid';
  end if;
  v_business_open := (v_hours ->> 'open')::time;
  v_business_close := (v_hours ->> 'close')::time;
  v_booking_start := v_shop.booking_available_start_time::time;
  v_booking_end := v_shop.booking_available_end_time::time;
  v_close_grace_minutes := coalesce((v_shop.reservation_policy_settings ->> 'booking_close_grace_minutes')::integer, 0);

  if v_business_open >= v_business_close or v_booking_start >= v_booking_end
     or new.appointment_time < greatest(v_business_open, v_booking_start)
     or new.appointment_time > v_booking_end then
    raise exception using errcode = '22023', message = 'booking start is outside the inclusive start window';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(coalesce(v_shop.reservation_policy_settings -> 'booking_blocked_windows', '[]'::jsonb)) blocked_window
     where new.appointment_time < (blocked_window.value ->> 'end')::time
       and new.appointment_time + v_duration > (blocked_window.value ->> 'start')::time
  ) then
    raise exception using errcode = '22023', message = 'booking overlaps a blocked window';
  end if;

  v_latest_end_local := new.appointment_date + v_business_close
    + make_interval(mins => v_close_grace_minutes);

  if new.staff_id is not null then
    select staff.* into v_staff
      from public.staff_members staff
     where staff.id = new.staff_id and staff.shop_id = new.shop_id and staff.is_active
     for key share;
    if not found then
      raise exception using errcode = '23503', message = 'booking staff does not belong to shop';
    end if;

    select schedule_override.* into v_override
      from public.staff_schedule_overrides schedule_override
     where schedule_override.shop_id = new.shop_id
       and schedule_override.staff_id = new.staff_id
       and schedule_override.work_date = new.appointment_date;
    if found then
      if v_override.status in ('off', 'annual') then
        raise exception using errcode = '22023', message = 'booking staff is not working';
      elsif v_override.status = 'half' then
        v_staff_start := case when v_override.period = '오전' then time '13:00' else v_staff.start_time end;
        v_staff_end := case when v_override.period = '오후' then time '13:00' else v_staff.end_time end;
      elsif v_override.status = 'work' and v_override.start_time is not null and v_override.end_time is not null then
        v_staff_start := v_override.start_time;
        v_staff_end := v_override.end_time;
      else
        raise exception using errcode = '22023', message = 'booking staff schedule is invalid';
      end if;
    else
      if not (v_weekday_key = any(v_staff.default_days)) then
        raise exception using errcode = '22023', message = 'booking staff is not working';
      end if;
      v_staff_start := v_staff.start_time;
      v_staff_end := v_staff.end_time;
    end if;

    if new.appointment_time < v_staff_start then
      raise exception using errcode = '22023', message = 'booking start is before staff availability';
    end if;
    if v_staff_end = v_business_close then
      v_latest_end_local := new.appointment_date + v_business_close
        + make_interval(mins => v_close_grace_minutes);
    else
      v_latest_end_local := least(
        new.appointment_date + v_staff_end,
        new.appointment_date + v_business_close
      );
    end if;
  end if;

  if (new.end_at at time zone 'Asia/Seoul') > v_latest_end_local then
    raise exception using errcode = '22023', message = 'booking end exceeds the close grace boundary';
  end if;

  return new;
end;
$$;

revoke all on function private.assert_appointment_booking_start_cutoff() from public, anon, authenticated;
grant execute on function private.assert_appointment_booking_start_cutoff() to service_role;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_trigger trigger_metadata
      join pg_catalog.pg_class relation_metadata on relation_metadata.oid = trigger_metadata.tgrelid
      join pg_catalog.pg_namespace schema_metadata on schema_metadata.oid = relation_metadata.relnamespace
      join pg_catalog.pg_proc function_metadata on function_metadata.oid = trigger_metadata.tgfoid
     where schema_metadata.nspname = 'public'
       and relation_metadata.relname = 'appointments'
       and trigger_metadata.tgname = 'appointments_assert_booking_start_cutoff'
       and trigger_metadata.tgenabled = 'O'
       and function_metadata.oid = 'private.assert_appointment_booking_start_cutoff()'::regprocedure
  ) then
    raise exception using errcode = '55000', message = 'booking window trigger is not enabled or bound to its guard';
  end if;
end;
$$;

notify pgrst, 'reload schema';
