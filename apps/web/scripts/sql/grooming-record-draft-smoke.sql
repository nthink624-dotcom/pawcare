\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
      from pg_attribute
     where attrelid = 'public.grooming_records'::regclass
       and attname = 'internal_memo'
       and not attisdropped
  ) then
    raise exception 'grooming_records.internal_memo is missing';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.grooming_record_drafts'::regclass) then
    raise exception 'grooming_record_drafts RLS is disabled';
  end if;

  if has_table_privilege('anon', 'public.grooming_record_drafts', 'select')
     or has_table_privilege('authenticated', 'public.grooming_record_drafts', 'select') then
    raise exception 'direct client read privileges must remain revoked';
  end if;

  if not has_table_privilege('service_role', 'public.grooming_record_drafts', 'select,insert,update,delete') then
    raise exception 'service_role draft privileges are missing';
  end if;
end
$$;

begin;

insert into public.shops (id, name, phone, address)
values ('draft-smoke-shop', '초안 검증 매장', '01000000000', '서울')
on conflict (id) do nothing;

insert into public.guardians (id, shop_id, name, phone)
values ('11111111-1111-4111-8111-111111111111', 'draft-smoke-shop', '보호자', '01011111111')
on conflict (id) do nothing;

insert into public.pets (id, shop_id, guardian_id, name, breed)
values (
  '22222222-2222-4222-8222-222222222222',
  'draft-smoke-shop',
  '11111111-1111-4111-8111-111111111111',
  '몽이',
  '말티즈'
)
on conflict (id) do nothing;

insert into public.services (id, shop_id, name, price, duration_minutes)
values ('draft-smoke-service', 'draft-smoke-shop', '전체 미용', 50000, 90)
on conflict (id) do nothing;

insert into public.appointments (
  id,
  shop_id,
  guardian_id,
  pet_id,
  service_id,
  appointment_date,
  appointment_time,
  status,
  start_at,
  end_at
) values (
  '33333333-3333-4333-8333-333333333333',
  'draft-smoke-shop',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'draft-smoke-service',
  current_date,
  '10:00',
  'confirmed',
  date_trunc('day', now()) + interval '10 hours',
  date_trunc('day', now()) + interval '11 hours 30 minutes'
)
on conflict (id) do nothing;

insert into public.grooming_record_drafts (
  shop_id,
  appointment_id,
  guardian_id,
  pet_id,
  treatment_notes,
  special_notes,
  internal_notes,
  next_recommended_visit_date
) values (
  'draft-smoke-shop',
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '6mm 클리핑',
  '귀 상태 확인',
  '다음 방문 상담',
  current_date + 28
)
on conflict (appointment_id) do update set
  treatment_notes = excluded.treatment_notes,
  special_notes = excluded.special_notes,
  internal_notes = excluded.internal_notes,
  next_recommended_visit_date = excluded.next_recommended_visit_date,
  updated_at = now();

do $$
declare
  saved_count integer;
begin
  select count(*) into saved_count
    from public.grooming_record_drafts
   where appointment_id = '33333333-3333-4333-8333-333333333333'
     and treatment_notes = '6mm 클리핑'
     and internal_notes = '다음 방문 상담';
  if saved_count <> 1 then
    raise exception 'draft upsert/recovery verification failed';
  end if;

  delete from public.grooming_record_drafts
   where appointment_id = '33333333-3333-4333-8333-333333333333';
  if not found then
    raise exception 'draft cleanup verification failed';
  end if;
end
$$;

rollback;

select 'grooming record draft smoke passed' as result;
