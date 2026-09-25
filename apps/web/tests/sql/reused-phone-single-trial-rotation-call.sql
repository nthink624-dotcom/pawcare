set role service_role;
select public.complete_owner_signup_v4(
  'a0000000-0000-0000-0000-000000000001', repeat('3',64),
  'a1000000-0000-0000-0000-000000000001',
  jsonb_build_object('id','rotation-shop','name','회전 매장','phone','0212345678','address','서울',
    'business_hours','{}'::jsonb,'regular_closed_days','[]'::jsonb,
    'notification_settings','{}'::jsonb,'customer_page_settings','{}'::jsonb),
  jsonb_build_object('login_id','rotation@example.invalid','name','합성 오너','birth_date','19900101',
    'phone_number','01012345678','ci_hash',repeat('c',64),'di_hash',repeat('d',64),
    'identity_verified_at',now()::text,'agreements','{}'::jsonb),
  jsonb_build_array(jsonb_build_object('id','rotation-service','name','목욕','price',35000,
    'duration_minutes',60,'description','','sort_order',1,'price_guide','{}'::jsonb)),
  jsonb_build_object('phone','01012345678'),
  'a2000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  jsonb_build_array(
    jsonb_build_object('identityKey',repeat('e',64),'keyVersion','v2'),
    jsonb_build_object('identityKey',repeat('1',64),'keyVersion','v1')
  ),
  'v2'
);

reset role;

do $$
declare v_status jsonb;
begin
  if not exists (
    select 1 from public.owner_subscriptions
     where user_id='a1000000-0000-0000-0000-000000000001'
       and subscription_status='expired'
       and current_plan_code='single_monthly_v1'
       and product_version='2026-08-v1'
       and price_snapshot_amount=29000
       and price_snapshot_currency='KRW'
  ) then raise exception 'rotated key regained trial'; end if;
  if (select count(*) from public.owner_trial_identity_claims) <> 1 then
    raise exception 'rotation created a second claim';
  end if;
  if not exists (
    select 1 from public.owner_trial_identity_aliases old_alias
    join public.owner_trial_identity_aliases new_alias using(claim_id)
     where old_alias.identity_key=repeat('1',64) and new_alias.identity_key=repeat('e',64)
  ) then raise exception 'current and previous aliases were not joined'; end if;
  select public.owner_trial_identity_key_retirement_status_v1('v1','v2') into v_status;
  if (v_status ->> 'retirementSafe')::boolean is not true then
    raise exception 'v1 retirement coverage was not proven: %', v_status;
  end if;
end;
$$;

-- Restore the fixture's v1 policy for the independent failure/retry case.
update public.owner_trial_identity_key_policy set is_current=false, lookup_required=false where key_version='v2';
update public.owner_trial_identity_key_policy set is_current=true, lookup_required=true where key_version='v1';
