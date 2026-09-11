-- PM_ATOMIC_SIGNUP_R1. Local migration only until the owner approves a
-- Development apply. Privileged implementation functions live outside the
-- exposed public schema; public RPC wrappers remain invoker-rights and are
-- executable only by service_role.

create schema if not exists pm_signup_private;
revoke all on schema pm_signup_private from public, anon, authenticated;
grant usage on schema pm_signup_private to service_role;

create or replace function pm_signup_private.claim_owner_signup_v5(
  p_signup_request_id uuid,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.signup_idempotency_requests%rowtype;
begin
  if p_signup_request_id is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'PM_SIGNUP_INVALID_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('owner-signup:' || p_signup_request_id::text, 0));
  select * into v_row
    from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id
   for update;

  if not found then
    insert into public.signup_idempotency_requests(signup_request_id, payload_hash, status)
    values (p_signup_request_id, p_payload_hash, 'claimed')
    returning * into v_row;
    return jsonb_build_object('action', 'claimed', 'status', v_row.status);
  end if;

  if v_row.payload_hash <> p_payload_hash then
    return jsonb_build_object(
      'action', 'payload_mismatch', 'status', v_row.status,
      'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id,
      'trialEligible', v_row.trial_eligible, 'trialDays', v_row.trial_days,
      'billingRequired', v_row.billing_required
    );
  end if;
  if v_row.status = 'completed' and v_row.shop_id is not null then
    return jsonb_build_object(
      'action', 'completed', 'status', v_row.status,
      'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id,
      'trialEligible', v_row.trial_eligible, 'trialDays', v_row.trial_days,
      'billingRequired', v_row.billing_required
    );
  end if;
  if v_row.status = 'failed_compensated' then
    update public.signup_idempotency_requests
       set status = 'claimed', auth_user_id = null, shop_id = null,
           failure_reason = null, trial_eligible = null, trial_days = null,
           billing_required = null, updated_at = now()
     where signup_request_id = p_signup_request_id
     returning * into v_row;
    return jsonb_build_object('action', 'claimed', 'status', v_row.status);
  end if;
  if v_row.status = 'claimed' and v_row.updated_at <= now() - interval '10 minutes' then
    update public.signup_idempotency_requests
       set status = 'compensation_pending',
           failure_reason = 'STALE_CLAIM_REQUIRES_AUTH_RECONCILIATION',
           updated_at = now()
     where signup_request_id = p_signup_request_id
     returning * into v_row;
  elsif v_row.status = 'auth_created' and v_row.updated_at <= now() - interval '10 minutes' then
    update public.signup_idempotency_requests
       set status = 'compensation_pending',
           failure_reason = 'STALE_AUTH_CREATED_REQUIRES_RECONCILIATION',
           updated_at = now()
     where signup_request_id = p_signup_request_id
     returning * into v_row;
  end if;

  return jsonb_build_object(
    'action', case when v_row.status = 'compensation_pending' then 'compensation_pending' else 'in_progress' end,
    'status', v_row.status, 'authUserId', v_row.auth_user_id, 'shopId', v_row.shop_id
  );
end;
$$;

create or replace function pm_signup_private.mark_owner_signup_auth_created_v5(
  p_signup_request_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_signup_request_id is null or p_payload_hash !~ '^[0-9a-f]{64}$' or p_auth_user_id is null then
    raise exception 'PM_SIGNUP_INVALID_REQUEST';
  end if;
  if not exists (select 1 from auth.users where id = p_auth_user_id) then
    raise exception 'PM_SIGNUP_AUTH_USER_MISSING';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('owner-signup:' || p_signup_request_id::text, 0));
  update public.signup_idempotency_requests
     set status = 'auth_created', auth_user_id = p_auth_user_id, updated_at = now()
   where signup_request_id = p_signup_request_id
     and payload_hash = p_payload_hash
     and status = 'claimed'
     and auth_user_id is null;
  if not found then raise exception 'PM_SIGNUP_INVALID_STATE'; end if;
  return true;
end;
$$;

create or replace function pm_signup_private.complete_owner_signup_v5(
  p_signup_request_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid,
  p_shop jsonb,
  p_profile jsonb,
  p_services jsonb,
  p_staff jsonb,
  p_identity_verification_id uuid,
  p_identity_token_id uuid,
  p_trial_identity_keys jsonb,
  p_trial_identity_current_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_profile ->> 'login_id'));
  v_auth_email text;
  v_shop_id text := nullif(trim(p_shop ->> 'id'), '');
  v_row public.signup_idempotency_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('owner-signup:' || p_signup_request_id::text, 0));
  select * into v_row from public.signup_idempotency_requests
   where signup_request_id = p_signup_request_id for update;
  if not found or v_row.payload_hash <> p_payload_hash then
    raise exception 'PM_SIGNUP_PAYLOAD_MISMATCH';
  end if;
  if v_row.status = 'completed' and v_row.shop_id is not null then
    return jsonb_build_object(
      'shopId', v_row.shop_id, 'reused', true,
      'trialEligible', v_row.trial_eligible, 'trialDays', v_row.trial_days,
      'billingRequired', v_row.billing_required
    );
  end if;
  if v_row.status <> 'auth_created' or v_row.auth_user_id is distinct from p_auth_user_id then
    raise exception 'PM_SIGNUP_INVALID_STATE';
  end if;

  select lower(email) into v_auth_email from auth.users where id = p_auth_user_id;
  if v_auth_email is null or v_email = '' or v_auth_email <> v_email then
    raise exception 'PM_SIGNUP_AUTH_IDENTITY_MISMATCH';
  end if;
  if v_shop_id is null then raise exception 'PM_SIGNUP_INVALID_PAYLOAD'; end if;

  -- Never adopt, overwrite, or delete unexplained legacy fragments. Operators
  -- must reconcile them explicitly before retrying this idempotency key.
  if exists (select 1 from public.shops where owner_user_id = p_auth_user_id or id = v_shop_id)
     or exists (select 1 from public.owner_profiles where user_id = p_auth_user_id or login_id = v_email)
     or exists (select 1 from public.owner_shop_memberships where owner_user_id = p_auth_user_id)
     or exists (select 1 from public.owner_subscriptions where user_id = p_auth_user_id) then
    raise exception 'PM_SIGNUP_EXISTING_PARTIAL_DATA';
  end if;

  return public.complete_owner_signup_v4(
    p_signup_request_id, p_payload_hash, p_auth_user_id,
    p_shop, p_profile, p_services, p_staff,
    p_identity_verification_id, p_identity_token_id,
    p_trial_identity_keys, p_trial_identity_current_version
  );
end;
$$;

create or replace function public.claim_owner_signup_v5(p_signup_request_id uuid, p_payload_hash text)
returns jsonb language sql security invoker set search_path = ''
as $$ select pm_signup_private.claim_owner_signup_v5(p_signup_request_id, p_payload_hash) $$;

create or replace function public.mark_owner_signup_auth_created_v5(p_signup_request_id uuid, p_payload_hash text, p_auth_user_id uuid)
returns boolean language sql security invoker set search_path = ''
as $$ select pm_signup_private.mark_owner_signup_auth_created_v5(p_signup_request_id, p_payload_hash, p_auth_user_id) $$;

create or replace function public.complete_owner_signup_v5(
  p_signup_request_id uuid, p_payload_hash text, p_auth_user_id uuid,
  p_shop jsonb, p_profile jsonb, p_services jsonb, p_staff jsonb,
  p_identity_verification_id uuid, p_identity_token_id uuid,
  p_trial_identity_keys jsonb, p_trial_identity_current_version text
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select pm_signup_private.complete_owner_signup_v5(
    p_signup_request_id, p_payload_hash, p_auth_user_id,
    p_shop, p_profile, p_services, p_staff,
    p_identity_verification_id, p_identity_token_id,
    p_trial_identity_keys, p_trial_identity_current_version
  )
$$;

revoke all on all functions in schema pm_signup_private from public, anon, authenticated;
grant execute on function pm_signup_private.claim_owner_signup_v5(uuid, text) to service_role;
grant execute on function pm_signup_private.mark_owner_signup_auth_created_v5(uuid, text, uuid) to service_role;
grant execute on function pm_signup_private.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) to service_role;

revoke all on function public.claim_owner_signup_v5(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_owner_signup_auth_created_v5(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.claim_owner_signup_v5(uuid, text) to service_role;
grant execute on function public.mark_owner_signup_auth_created_v5(uuid, text, uuid) to service_role;
grant execute on function public.complete_owner_signup_v5(uuid, text, uuid, jsonb, jsonb, jsonb, jsonb, uuid, uuid, jsonb, text) to service_role;

notify pgrst, 'reload schema';
