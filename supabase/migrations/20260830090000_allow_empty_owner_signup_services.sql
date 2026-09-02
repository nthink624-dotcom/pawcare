-- PREPARED LOCALLY ONLY: do not apply or push without the owner's separate approval.
-- Owner signup now defers price-guide creation to the post-signup setup flow.
-- Keep the existing v5 -> v4 -> v1 atomic chain and allow p_services = [] while
-- continuing to reject null/non-array input and validating every supplied row.

create or replace function public.complete_owner_signup_v1(
  p_signup_request_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid,
  p_shop jsonb,
  p_profile jsonb,
  p_services jsonb,
  p_staff jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.signup_idempotency_requests%rowtype;
  v_shop_id text := nullif(trim(p_shop ->> 'id'), '');
  v_service jsonb;
begin
  if p_signup_request_id is null or length(coalesce(p_payload_hash, '')) <> 64 then
    raise exception 'PM_SIGNUP_INVALID_REQUEST';
  end if;
  if p_auth_user_id is null or not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'PM_SIGNUP_AUTH_USER_MISSING';
  end if;
  if v_shop_id is null or jsonb_typeof(p_services) <> 'array' then
    raise exception 'PM_SIGNUP_INVALID_PAYLOAD';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_signup_request_id::text, 0));
  select * into v_existing
    from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id;

  if found then
    if v_existing.payload_hash <> p_payload_hash then
      raise exception 'PM_SIGNUP_PAYLOAD_MISMATCH';
    end if;
    if v_existing.status = 'completed' and v_existing.shop_id is not null then
      return jsonb_build_object('shopId', v_existing.shop_id, 'reused', true);
    end if;
    if v_existing.status in ('processing', 'compensation_pending') then
      raise exception 'PM_SIGNUP_IN_PROGRESS';
    end if;
  else
    insert into public.signup_idempotency_requests (
      signup_request_id, payload_hash, status, auth_user_id, shop_id
    ) values (
      p_signup_request_id, p_payload_hash, 'processing', p_auth_user_id, v_shop_id
    );
  end if;

  if exists (select 1 from public.owner_profiles where login_id = lower(trim(p_profile ->> 'login_id'))) then
    raise exception 'PM_SIGNUP_DUPLICATE_EMAIL';
  end if;
  if nullif(p_profile ->> 'ci_hash', '') is not null
     and exists (select 1 from public.owner_profiles where ci_hash = p_profile ->> 'ci_hash') then
    raise exception 'PM_SIGNUP_DUPLICATE_IDENTITY';
  end if;
  if nullif(p_profile ->> 'di_hash', '') is not null
     and exists (select 1 from public.owner_profiles where di_hash = p_profile ->> 'di_hash') then
    raise exception 'PM_SIGNUP_DUPLICATE_IDENTITY';
  end if;

  insert into public.shops (
    id, owner_user_id, name, phone, address, description,
    business_hours, regular_closed_days, temporary_closed_dates,
    concurrent_capacity, booking_slot_interval_minutes, booking_slot_offset_minutes,
    booking_available_start_time, booking_available_end_time, approval_mode,
    notification_settings, customer_page_settings, created_at, updated_at
  ) values (
    v_shop_id,
    p_auth_user_id,
    trim(p_shop ->> 'name'),
    trim(p_shop ->> 'phone'),
    trim(p_shop ->> 'address'),
    '',
    coalesce(p_shop -> 'business_hours', '{}'::jsonb),
    array(select jsonb_array_elements_text(coalesce(p_shop -> 'regular_closed_days', '[]'::jsonb))::integer),
    array[]::date[],
    1, 15, 0, '10:00', '17:00', 'auto',
    coalesce(p_shop -> 'notification_settings', '{}'::jsonb),
    coalesce(p_shop -> 'customer_page_settings', '{}'::jsonb),
    now(), now()
  );

  insert into public.owner_profiles (
    user_id, shop_id, login_id, name, birth_date, phone_number,
    ci_hash, di_hash, identity_verified_at, agreements, created_at, updated_at
  ) values (
    p_auth_user_id,
    v_shop_id,
    lower(trim(p_profile ->> 'login_id')),
    trim(p_profile ->> 'name'),
    p_profile ->> 'birth_date',
    p_profile ->> 'phone_number',
    nullif(p_profile ->> 'ci_hash', ''),
    nullif(p_profile ->> 'di_hash', ''),
    (p_profile ->> 'identity_verified_at')::timestamptz,
    coalesce(p_profile -> 'agreements', '{}'::jsonb),
    now(), now()
  );

  insert into public.owner_shop_memberships (
    owner_user_id, shop_id, role, is_primary, created_at, updated_at
  ) values (p_auth_user_id, v_shop_id, 'owner', true, now(), now());

  for v_service in select value from jsonb_array_elements(p_services)
  loop
    if nullif(trim(v_service ->> 'name'), '') is null
       or (v_service ->> 'price')::integer < 0
       or (v_service ->> 'duration_minutes')::integer not between 5 and 1440 then
      raise exception 'PM_SIGNUP_INVALID_SERVICE';
    end if;
    insert into public.services (
      id, shop_id, name, price, price_type, duration_minutes, is_active,
      category, description, sort_order, price_guide, created_at, updated_at
    ) values (
      v_service ->> 'id',
      v_shop_id,
      trim(v_service ->> 'name'),
      (v_service ->> 'price')::integer,
      'starting',
      (v_service ->> 'duration_minutes')::integer,
      true,
      '미용',
      coalesce(v_service ->> 'description', ''),
      (v_service ->> 'sort_order')::integer,
      coalesce(v_service -> 'price_guide', '{}'::jsonb),
      now(), now()
    );
  end loop;

  insert into public.staff_members (
    id, shop_id, name, display_name, profile_message, title_prefix, chip_color_index,
    phone, role, position, default_days, start_time, end_time, regular_off,
    annual_remain, is_active, sort_order, created_at, updated_at
  ) values (
    v_shop_id || '-staff-owner', v_shop_id, '원장', '원장', '', '', 0,
    coalesce(p_staff ->> 'phone', ''), '원장 / 전체 미용', '원장',
    array['mon','tue','wed','thu','fri','sat'], '10:00', '19:00', '일',
    0, true, 1, now(), now()
  );

  update public.signup_idempotency_requests
     set status = 'completed', auth_user_id = p_auth_user_id, shop_id = v_shop_id,
         failure_reason = null, updated_at = now()
   where signup_request_id = p_signup_request_id;

  return jsonb_build_object('shopId', v_shop_id, 'reused', false);
end;
$$;

revoke all on function public.complete_owner_signup_v1(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_owner_signup_v1(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
