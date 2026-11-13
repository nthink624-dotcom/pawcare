-- Permit deletion only for demonstrably unbilled trials.
-- Password reauthentication, service-role-only access, paid-state and retention gates stay in force.
begin;

create or replace function public.claim_owner_account_deletion_v1(
  p_owner_user_id uuid,
  p_idempotency_key_hash text
)
returns table (request_id uuid, state text, shop_ids text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.owner_account_deletion_requests%rowtype;
  v_shop_ids text[];
  v_has_active_billing boolean;
  v_has_retention_candidate boolean;
begin
  if p_owner_user_id is null or p_idempotency_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'OWNER_ACCOUNT_DELETION_INVALID_REQUEST' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_user_id::text, 891271));

  select * into v_request
  from private.owner_account_deletion_requests
  where idempotency_key_hash = p_idempotency_key_hash
  for update;

  if found then
    if v_request.owner_user_id is not null and v_request.owner_user_id <> p_owner_user_id then
      raise exception 'OWNER_ACCOUNT_DELETION_IDEMPOTENCY_CONFLICT' using errcode = '23505';
    end if;
    return query select v_request.id, v_request.state, v_request.shop_ids;
    return;
  end if;

  select coalesce(array_agg(s.id order by s.id), '{}'::text[])
  into v_shop_ids
  from public.shops s
  where s.owner_user_id = p_owner_user_id;

  if cardinality(v_shop_ids) = 0 then
    raise exception 'OWNER_ACCOUNT_DELETION_OWNER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.owner_subscriptions os
    where os.user_id = p_owner_user_id
      and (
        os.subscription_status in ('active', 'past_due')
        or (
          os.subscription_status in ('trialing', 'trial_will_end')
          and not (
            os.payment_method_exists is false
            and os.billing_key_encrypted is null
            and os.billing_key_encryption_version is null
            and os.billing_issue_id is null
            and os.last_schedule_id is null
            and os.next_billing_at is null
            and os.last_payment_id is null
            and os.last_payment_at is null
            and os.last_payment_failed_at is null
            and os.current_period_started_at is null
            and os.current_period_ends_at is null
            and os.trial_started_at is not null
            and os.trial_ends_at is not null
            and os.last_payment_status is not distinct from 'none'
          )
        )
      )
  ) into v_has_active_billing;

  if v_has_active_billing then
    raise exception 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL' using errcode = 'P0001';
  end if;

  -- The approved retention period/basis has not been encoded in this schema.
  -- Never discard payment or dispute evidence until that explicit policy exists.
  select exists (
    select 1 from public.owner_payment_ledger opl where opl.user_id = p_owner_user_id
    union all
    select 1 from public.owner_billing_events obe where obe.user_id = p_owner_user_id
  ) into v_has_retention_candidate;

  if v_has_retention_candidate then
    raise exception 'OWNER_ACCOUNT_DELETION_RETENTION_POLICY_REQUIRED' using errcode = 'P0001';
  end if;

  insert into private.owner_account_deletion_requests (owner_user_id, shop_ids, idempotency_key_hash)
  values (p_owner_user_id, v_shop_ids, p_idempotency_key_hash)
  returning * into v_request;

  return query select v_request.id, v_request.state, v_request.shop_ids;
end;
$$;

revoke all on function public.claim_owner_account_deletion_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_owner_account_deletion_v1(uuid, text) to service_role;

commit;
