do $$
declare
  v_claims integer;
  v_trialing integer;
  v_expired integer;
  v_accounts integer;
begin
  select count(*) into v_claims from public.owner_trial_identity_claims;
  select count(*) into v_trialing from public.owner_subscriptions where subscription_status = 'trialing';
  select count(*) into v_expired from public.owner_subscriptions where subscription_status = 'expired';
  select count(*) into v_accounts from public.owner_profiles;
  if v_claims <> 1 then raise exception 'expected one trial claim, got %', v_claims; end if;
  if v_trialing <> 1 then raise exception 'expected one trial winner, got %', v_trialing; end if;
  if v_expired <> 19 then raise exception 'expected nineteen billing-required signups, got %', v_expired; end if;
  if v_accounts <> 20 then raise exception 'expected twenty successful accounts, got %', v_accounts; end if;
  if exists (
    select 1 from public.owner_subscriptions
     where current_plan_code <> 'single_monthly_v1'
        or featured_plan_code <> 'single_monthly_v1'
        or auto_renew_plan_code <> 'single_monthly_v1'
        or product_version <> '2026-08-v1'
        or price_snapshot_amount <> 29000
        or price_snapshot_currency <> 'KRW'
  ) then raise exception 'new signup product contract or price snapshot diverged'; end if;
  if exists(select 1 from public.shop_alimtalk_credit_balances)
     or exists(select 1 from public.shop_alimtalk_credit_events) then
    raise exception 'signup RPC must not create or reset Alimtalk credits';
  end if;
  if (select count(distinct phone_number) from public.owner_profiles) <> 1 then
    raise exception 'canonical phone fixture diverged';
  end if;
  if (select count(distinct ci_hash) from public.owner_profiles) <> 1
     or (select count(distinct di_hash) from public.owner_profiles) <> 1 then
    raise exception 'verified identity reuse was not preserved';
  end if;
  if exists (
    select 1 from public.signup_idempotency_requests
     where (trial_days = 14 and (trial_eligible is not true or billing_required is not false))
        or (trial_days = 0 and (trial_eligible is not false or billing_required is not true))
  ) then raise exception 'trial result invariant failed'; end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name in ('owner_trial_identity_claims','owner_trial_identity_aliases')
       and column_name ~ '(phone|email|user|shop|ci|di)'
  ) then raise exception 'PII-like ledger column detected'; end if;
end;
$$;

do $$
declare
  v_user_id uuid;
  v_shop_id text;
  v_subscription_check_blocked boolean := false;
  v_payment_check_blocked boolean := false;
  v_payment_immutable_blocked boolean := false;
begin
  select user_id, shop_id into v_user_id, v_shop_id from public.owner_subscriptions limit 1;

  begin
    update public.owner_subscriptions
       set current_plan_code='monthly', featured_plan_code='single_monthly_v1',
           auto_renew_plan_code='monthly', product_version=null,
           price_snapshot_amount=null, price_snapshot_currency=null
     where user_id=v_user_id;
  exception when check_violation then
    v_subscription_check_blocked := true;
  end;
  if not v_subscription_check_blocked then
    raise exception 'featured/auto-renew new product without snapshot was accepted';
  end if;

  insert into public.owner_payment_ledger(
    payment_id, user_id, shop_id, plan_code, product_version,
    price_snapshot_amount, price_snapshot_currency, amount, status
  ) values (
    'fixture-single-monthly-paid', v_user_id, v_shop_id, 'single_monthly_v1',
    '2026-08-v1', 29000, 'KRW', 29000, 'PAID'
  );

  begin
    insert into public.owner_payment_ledger(
      payment_id, user_id, shop_id, plan_code, product_version,
      price_snapshot_amount, price_snapshot_currency, amount, status
    ) values (
      'fixture-invalid-product', v_user_id, v_shop_id, 'single_monthly_v1',
      null, null, null, 29000, 'PAID'
    );
  exception when check_violation then
    v_payment_check_blocked := true;
  end;
  if not v_payment_check_blocked then
    raise exception 'payment product without snapshot was accepted';
  end if;

  begin
    update public.owner_payment_ledger
       set price_snapshot_amount=19000
     where payment_id='fixture-single-monthly-paid';
  exception when others then
    if sqlerrm like '%PM_PAYMENT_PRODUCT_SNAPSHOT_IMMUTABLE%' then
      v_payment_immutable_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_payment_immutable_blocked then
    raise exception 'payment product snapshot mutation was accepted';
  end if;
end;
$$;

-- Same idempotency request must return the stored server decision.
do $$
declare v_result jsonb; v_request_id uuid; v_payload_hash text;
begin
  select signup_request_id, payload_hash into v_request_id, v_payload_hash
    from public.signup_idempotency_requests where trial_days = 14;
  select public.claim_owner_signup_v5(v_request_id, v_payload_hash) into v_result;
  if v_result ->> 'action' <> 'completed' or (v_result ->> 'trialDays')::integer <> 14 then
    raise exception 'idempotent trial result changed: %', v_result;
  end if;
end;
$$;
