-- Repair the column/value ordering in the trial-claim preparation trigger.
-- This migration is intentionally separate because the preceding migration was
-- already exercised in Development before the defect was detected.

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
    normalized_phone,
    first_user_id,
    first_claimed_at
  ) values (
    v_normalized_phone,
    new.id,
    prepared_at
  )
  on conflict (normalized_phone) do nothing;

  trial_granted := found;

  insert into private.owner_signup_pending (
    user_id,
    payload,
    normalized_phone,
    trial_granted,
    prepared_at
  ) values (
    new.id,
    signup_payload,
    v_normalized_phone,
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

revoke all on function private.prepare_owner_signup() from public, anon, authenticated;

;
