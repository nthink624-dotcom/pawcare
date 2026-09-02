-- Allow one owner phone number to create multiple accounts while granting the
-- 14-day trial only once. Provisioning runs inside the auth.users insert
-- transaction so a failed signup cannot leave partial owner data behind.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.normalize_owner_phone_number(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when regexp_replace(value, '[^0-9]', '', 'g') like '82%'
      and length(regexp_replace(value, '[^0-9]', '', 'g')) >= 11
      then left('0' || substr(regexp_replace(value, '[^0-9]', '', 'g'), 3), 11)
    else left(regexp_replace(value, '[^0-9]', '', 'g'), 11)
  end
$$;

create table if not exists public.owner_trial_phone_claims (
  normalized_phone text primary key,
  first_user_id uuid not null,
  first_claimed_at timestamptz not null default now(),
  constraint owner_trial_phone_claims_normalized_phone_check
    check (normalized_phone ~ '^01[0-9]{8,9}$')
);

alter table public.owner_trial_phone_claims enable row level security;
revoke all on table public.owner_trial_phone_claims from public, anon, authenticated;
grant select, insert on table public.owner_trial_phone_claims to service_role;

insert into public.owner_trial_phone_claims (normalized_phone, first_user_id, first_claimed_at)
select distinct on (normalized_phone)
  normalized_phone,
  user_id,
  created_at
from (
  select
    private.normalize_owner_phone_number(phone_number) as normalized_phone,
    user_id,
    created_at
  from public.owner_profiles
  where phone_number is not null
) existing
where normalized_phone ~ '^01[0-9]{8,9}$'
order by normalized_phone, created_at, user_id
on conflict (normalized_phone) do nothing;

drop index if exists public.owner_profiles_ci_hash_unique;
drop index if exists public.owner_profiles_di_hash_unique;
create index if not exists owner_profiles_ci_hash_idx
  on public.owner_profiles(ci_hash)
  where ci_hash is not null;
create index if not exists owner_profiles_di_hash_idx
  on public.owner_profiles(di_hash)
  where di_hash is not null;

create table if not exists private.owner_signup_pending (
  user_id uuid primary key,
  payload jsonb not null,
  normalized_phone text not null,
  trial_granted boolean not null,
  prepared_at timestamptz not null default now()
);

create or replace function private.prepare_owner_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_payload jsonb;
  v_normalized_phone text;
  v_verification_id uuid;
  v_verification_token_id uuid;
  trial_granted boolean;
  prepared_at timestamptz := now();
begin
  signup_payload := new.raw_user_meta_data -> 'petmanager_owner_signup';
  if signup_payload is null then
    return new;
  end if;

  v_normalized_phone := private.normalize_owner_phone_number(signup_payload ->> 'phone_number');
  if v_normalized_phone !~ '^01[0-9]{8,9}$' then
    raise exception 'owner signup phone is invalid' using errcode = '22023';
  end if;

  v_verification_id := (signup_payload ->> 'verification_id')::uuid;
  v_verification_token_id := (signup_payload ->> 'verification_token_id')::uuid;

  update public.owner_identity_verifications
  set
    status = 'consumed',
    consumed_at = prepared_at,
    consumed_action = 'signup',
    updated_at = prepared_at
  where id = v_verification_id
    and verification_token_id = v_verification_token_id
    and purpose = 'signup'
    and status = 'verified'
    and consumed_at is null
    and verified_expires_at > prepared_at
    and private.normalize_owner_phone_number(phone_number) = v_normalized_phone;

  if not found then
    raise exception 'owner signup identity verification is unavailable' using errcode = 'P0001';
  end if;

  insert into public.owner_trial_phone_claims (
    v_normalized_phone,
    first_user_id,
    first_claimed_at
  ) values (
    normalized_phone,
    new.id,
    prepared_at
  )
  on conflict (normalized_phone) do nothing;

  trial_granted := found;

  insert into private.owner_signup_pending (
    user_id,
    payload,
    v_normalized_phone,
    trial_granted,
    prepared_at
  ) values (
    new.id,
    signup_payload,
    normalized_phone,
    trial_granted,
    prepared_at
  );

  new.raw_user_meta_data :=
    (new.raw_user_meta_data - 'petmanager_owner_signup') ||
    jsonb_build_object(
      'login_id', lower(trim(new.email)),
      'name', trim(signup_payload ->> 'name'),
      'subscription_status', case when trial_granted then 'trialing' else 'expired' end,
      'trial_started_at', prepared_at,
      'trial_ends_at', case when trial_granted then prepared_at + interval '14 days' else prepared_at end,
      'next_billing_at', null,
      'current_plan_code', 'quarterly',
      'auto_renew_enabled', false,
      'auto_renew_plan_code', 'quarterly',
      'cancel_at_period_end', false,
      'featured_plan_code', 'quarterly'
    );

  return new;
end;
$$;

create or replace function private.provision_owner_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending private.owner_signup_pending%rowtype;
  shop_id text;
  signup_at timestamptz;
  trial_ends_at timestamptz;
  subscription_status text;
begin
  select * into pending
  from private.owner_signup_pending
  where user_id = new.id;

  if not found then
    return new;
  end if;

  shop_id := pending.payload ->> 'shop_id';
  signup_at := pending.prepared_at;
  trial_ends_at := case
    when pending.trial_granted then signup_at + interval '14 days'
    else signup_at
  end;
  subscription_status := case when pending.trial_granted then 'trialing' else 'expired' end;

  insert into public.shops (
    id,
    owner_user_id,
    name,
    phone,
    address,
    description,
    business_hours,
    regular_closed_days,
    temporary_closed_dates,
    concurrent_capacity,
    booking_slot_interval_minutes,
    booking_slot_offset_minutes,
    booking_available_start_time,
    booking_available_end_time,
    approval_mode,
    notification_settings,
    customer_page_settings,
    created_at,
    updated_at
  ) values (
    shop_id,
    new.id,
    pending.payload ->> 'shop_name',
    pending.payload ->> 'shop_phone',
    pending.payload ->> 'shop_address',
    '',
    pending.payload -> 'business_hours',
    array[0],
    array[]::date[],
    1,
    15,
    0,
    '10:00',
    '17:00',
    'auto',
    pending.payload -> 'notification_settings',
    pending.payload -> 'customer_page_settings',
    signup_at,
    signup_at
  );

  insert into public.owner_profiles (
    user_id,
    shop_id,
    login_id,
    name,
    birth_date,
    phone_number,
    ci_hash,
    di_hash,
    identity_verified_at,
    agreements,
    created_at,
    updated_at
  ) values (
    new.id,
    shop_id,
    lower(trim(new.email)),
    trim(pending.payload ->> 'name'),
    pending.payload ->> 'birth_date',
    pending.normalized_phone,
    nullif(pending.payload ->> 'ci_hash', ''),
    nullif(pending.payload ->> 'di_hash', ''),
    signup_at,
    pending.payload -> 'agreements',
    signup_at,
    signup_at
  );

  insert into public.owner_shop_memberships (
    owner_user_id,
    shop_id,
    role,
    is_primary,
    created_at,
    updated_at
  ) values (
    new.id,
    shop_id,
    'owner',
    true,
    signup_at,
    signup_at
  );

  insert into public.staff_members (
    id,
    shop_id,
    name,
    display_name,
    profile_message,
    title_prefix,
    chip_color_index,
    phone,
    role,
    position,
    default_days,
    start_time,
    end_time,
    regular_off,
    annual_remain,
    is_active,
    sort_order,
    created_at,
    updated_at
  ) values (
    shop_id || '-staff-owner',
    shop_id,
    '원장',
    '원장',
    '아이 성향에 맞춰 차분하게 미용해드려요.',
    '',
    0,
    pending.normalized_phone,
    '원장 / 전체 미용',
    '원장',
    array['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    '10:00',
    '19:00',
    '일',
    0,
    true,
    1,
    signup_at,
    signup_at
  );

  insert into public.services (
    id,
    shop_id,
    name,
    price,
    price_type,
    duration_minutes,
    is_active,
    sort_order,
    price_guide,
    created_at,
    updated_at
  )
  select
    shop_id || '-svc-' || service_key,
    shop_id,
    service_name,
    service_price,
    'starting',
    service_duration,
    true,
    service_order,
    case when service_order = 1 then pending.payload -> 'default_price_guide' else '{}'::jsonb end,
    signup_at,
    signup_at
  from (values
    ('full-grooming', '전체 미용', 80000, 120, 1),
    ('bath-partial', '목욕 + 부분정리', 55000, 90, 2),
    ('bath', '목욕', 35000, 60, 3),
    ('hygiene', '위생 미용', 25000, 45, 4),
    ('partial-grooming', '부분 미용', 30000, 45, 5),
    ('spa-medicated', '스파/약욕 케어', 40000, 60, 6),
    ('nail-trim', '발톱 정리', 10000, 30, 7)
  ) as defaults(service_key, service_name, service_price, service_duration, service_order);

  insert into public.owner_subscriptions (
    user_id,
    shop_id,
    current_plan_code,
    billing_cycle,
    trial_started_at,
    trial_ends_at,
    next_billing_at,
    payment_method_exists,
    subscription_status,
    cancel_at_period_end,
    last_payment_status,
    portone_customer_id,
    featured_plan_code,
    auto_renew_plan_code,
    created_at,
    updated_at
  ) values (
    new.id,
    shop_id,
    'quarterly',
    '1m',
    signup_at,
    trial_ends_at,
    null,
    false,
    subscription_status,
    false,
    'none',
    'owner_' || new.id,
    'quarterly',
    'quarterly',
    signup_at,
    signup_at
  );

  insert into public.shop_alimtalk_credit_balances (
    shop_id,
    included_total,
    included_used,
    included_period_started_at,
    included_period_ends_at,
    purchased_total,
    purchased_used,
    created_at,
    updated_at
  ) values (
    shop_id,
    0,
    0,
    signup_at,
    trial_ends_at,
    0,
    0,
    signup_at,
    signup_at
  );

  delete from private.owner_signup_pending where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists petmanager_prepare_owner_signup on auth.users;
create trigger petmanager_prepare_owner_signup
before insert on auth.users
for each row
execute function private.prepare_owner_signup();

drop trigger if exists petmanager_provision_owner_signup on auth.users;
create trigger petmanager_provision_owner_signup
after insert on auth.users
for each row
execute function private.provision_owner_signup();

revoke all on function private.normalize_owner_phone_number(text) from public, anon, authenticated;
revoke all on function private.prepare_owner_signup() from public, anon, authenticated;
revoke all on function private.provision_owner_signup() from public, anon, authenticated;
revoke all on table private.owner_signup_pending from public, anon, authenticated;

;
