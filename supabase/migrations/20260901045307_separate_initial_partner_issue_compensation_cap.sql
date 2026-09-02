-- The automatic first-payment bonus is a fixed 30 days. Verified issue
-- compensation is tracked separately in policy terms: up to 60 additional
-- days in the three-month eligibility window, for a total bonus ceiling of 90.

alter table public.early_partner_benefit_claims
  drop constraint if exists early_partner_benefit_claims_cumulative_bonus_days_check;

alter table public.early_partner_benefit_claims
  add constraint early_partner_benefit_claims_cumulative_bonus_days_check
  check (cumulative_bonus_days between 30 and 90);

create or replace function public.grant_early_partner_manual_bonus_v1(
  p_shop_id text,
  p_days smallint,
  p_reason_code text,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_claim public.early_partner_benefit_claims%rowtype;
  v_subscription public.owner_subscriptions%rowtype;
  v_existing_grant public.early_partner_benefit_grants%rowtype;
  v_base_period_ends_at timestamptz;
  v_next_period_ends_at timestamptz;
  v_next_billing_at timestamptz;
begin
  if current_user <> 'service_role' then
    raise exception 'PM_EARLY_PARTNER_SERVICE_ROLE_REQUIRED';
  end if;
  if p_days not in (7, 14) then
    raise exception 'PM_EARLY_PARTNER_INVALID_BONUS_DAYS';
  end if;
  if p_reason_code not in ('core_issue', 'major_issue')
     or (p_reason_code = 'core_issue' and p_days <> 7)
     or (p_reason_code = 'major_issue' and p_days <> 14) then
    raise exception 'PM_EARLY_PARTNER_INVALID_REASON';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'PM_EARLY_PARTNER_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into v_existing_grant
    from public.early_partner_benefit_grants
   where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'status', 'already_granted',
      'claimId', v_existing_grant.claim_id,
      'grantId', v_existing_grant.grant_id,
      'grantedDays', v_existing_grant.granted_days,
      'currentPeriodEndsAt', (
        select current_period_ends_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      ),
      'nextBillingAt', (
        select next_billing_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      )
    );
  end if;

  select * into v_claim
    from public.early_partner_benefit_claims
   where shop_id = p_shop_id
   for update;
  if not found then
    raise exception 'PM_EARLY_PARTNER_CLAIM_NOT_FOUND';
  end if;

  select * into v_existing_grant
    from public.early_partner_benefit_grants
   where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'status', 'already_granted',
      'claimId', v_existing_grant.claim_id,
      'grantId', v_existing_grant.grant_id,
      'grantedDays', v_existing_grant.granted_days,
      'currentPeriodEndsAt', (
        select current_period_ends_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      ),
      'nextBillingAt', (
        select next_billing_at from public.owner_subscriptions
         where user_id = v_existing_grant.user_id and shop_id = v_existing_grant.shop_id
      )
    );
  end if;

  if now() > v_claim.benefit_window_ends_at then
    raise exception 'PM_EARLY_PARTNER_WINDOW_EXPIRED';
  end if;
  -- cumulative_bonus_days includes the initial 30. Therefore a total of 90
  -- enforces a separate 60-day cap for verified issue compensation.
  if v_claim.cumulative_bonus_days + p_days > 90 then
    raise exception 'PM_EARLY_PARTNER_BONUS_CAP_EXCEEDED';
  end if;

  select * into v_subscription
    from public.owner_subscriptions
   where user_id = v_claim.user_id
     and shop_id = v_claim.shop_id
   for update;
  if not found then
    raise exception 'PM_EARLY_PARTNER_SUBSCRIPTION_NOT_FOUND';
  end if;

  v_base_period_ends_at := greatest(coalesce(v_subscription.current_period_ends_at, now()), now());
  v_next_period_ends_at := v_base_period_ends_at + make_interval(days => p_days);
  v_next_billing_at := case when v_subscription.cancel_at_period_end then null else v_next_period_ends_at end;

  update public.owner_subscriptions
     set current_period_ends_at = v_next_period_ends_at,
         next_billing_at = v_next_billing_at,
         updated_at = now()
   where user_id = v_claim.user_id
     and shop_id = v_claim.shop_id;

  update public.early_partner_benefit_claims
     set cumulative_bonus_days = cumulative_bonus_days + p_days,
         updated_at = now()
   where claim_id = v_claim.claim_id;

  insert into public.early_partner_benefit_grants (
    claim_id, user_id, shop_id, idempotency_key, grant_type, reason_code,
    granted_days, period_ends_at_before, period_ends_at_after, actor_type,
    actor_id, payload
  ) values (
    v_claim.claim_id, v_claim.user_id, v_claim.shop_id, p_idempotency_key,
    'manual_issue_bonus', p_reason_code, p_days, v_base_period_ends_at,
    v_next_period_ends_at, 'admin', p_actor_id, coalesce(p_payload, '{}'::jsonb)
  );

  insert into public.early_partner_benefit_audit_events (
    shop_id, user_id, claim_id, event_type, idempotency_key, payload
  ) values (
    v_claim.shop_id, v_claim.user_id, v_claim.claim_id, 'manual_issue_bonus_granted',
    'early-partner:audit:' || p_idempotency_key,
    jsonb_build_object(
      'reasonCode', p_reason_code,
      'grantedDays', p_days,
      'periodEndsAtBefore', v_base_period_ends_at,
      'periodEndsAtAfter', v_next_period_ends_at,
      'nextBillingAt', v_next_billing_at,
      'actorId', p_actor_id
    ) || coalesce(p_payload, '{}'::jsonb)
  );

  return jsonb_build_object(
    'status', 'granted',
    'claimId', v_claim.claim_id,
    'grantedDays', p_days,
    'currentPeriodEndsAt', v_next_period_ends_at,
    'nextBillingAt', v_next_billing_at,
    'cumulativeBonusDays', v_claim.cumulative_bonus_days + p_days,
    'cumulativeIssueBonusDays', v_claim.cumulative_bonus_days + p_days - 30,
    'benefitWindowEndsAt', v_claim.benefit_window_ends_at
  );
end;
$$;

revoke all on function public.grant_early_partner_manual_bonus_v1(text, smallint, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.grant_early_partner_manual_bonus_v1(text, smallint, text, uuid, text, jsonb)
  to service_role;
