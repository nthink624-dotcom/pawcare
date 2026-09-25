set role service_role;
select public.complete_owner_signup_v5(
  (:'request_id')::uuid,
  repeat(:'hash_char', 64),
  (:'user_id')::uuid,
  jsonb_build_object('id', :'shop_id', 'name', '합성 매장', 'phone', '0212345678', 'address', '서울',
    'business_hours', '{}'::jsonb, 'regular_closed_days', '[]'::jsonb,
    'notification_settings', '{}'::jsonb, 'customer_page_settings', '{}'::jsonb),
  jsonb_build_object('login_id', :'email', 'name', '합성 오너', 'birth_date', '19900101',
    'phone_number', '01012345678', 'ci_hash', repeat('c',64), 'di_hash', repeat('d',64),
    'identity_verified_at', now()::text, 'agreements', '{}'::jsonb),
  jsonb_build_array(jsonb_build_object('id', :'service_id', 'name', '목욕', 'price', 35000,
    'duration_minutes', 60, 'description', '', 'sort_order', 1, 'price_guide', '{}'::jsonb)),
  jsonb_build_object('phone', '01012345678'),
  (:'verification_id')::uuid,
  (:'token_id')::uuid,
  jsonb_build_array(jsonb_build_object(
    'identityKey', repeat(:'hash_char',64), 'keyVersion', 'v1'
  )),
  'v1'
);
