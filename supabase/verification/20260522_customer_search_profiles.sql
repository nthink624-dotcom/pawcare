-- Title: 2026-05-22 고객 검색 프로필 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 기존 고객 선택, 고객관리 검색, 동명이인 구분에 필요한 검색용 뷰와 인덱스를 준비합니다.
-- Note: 이 SQL은 화면을 바꾸지 않습니다. 고객/반려동물 검색 API가 붙을 기반만 만듭니다.

create index if not exists guardians_shop_normalized_name_idx
  on public.guardians (shop_id, lower(btrim(name)));

create index if not exists guardians_shop_normalized_phone_idx
  on public.guardians (shop_id, regexp_replace(phone, '\D', '', 'g'));

create index if not exists pets_shop_guardian_normalized_name_idx
  on public.pets (shop_id, guardian_id, lower(btrim(name)));

create index if not exists appointments_shop_guardian_date_time_idx
  on public.appointments (shop_id, guardian_id, appointment_date desc, appointment_time desc);

create or replace view public.customer_search_profiles as
select
  guardians.shop_id,
  guardians.id as guardian_id,
  guardians.name as guardian_name,
  guardians.phone as guardian_phone,
  regexp_replace(guardians.phone, '\D', '', 'g') as guardian_phone_digits,
  right(regexp_replace(guardians.phone, '\D', '', 'g'), 4) as guardian_phone_tail,
  guardians.memo as guardian_memo,
  coalesce(
    array_agg(distinct pets.name order by pets.name) filter (where pets.id is not null),
    array[]::text[]
  ) as pet_names,
  coalesce(count(distinct pets.id), 0)::integer as pet_count,
  coalesce(
    array_agg(distinct pet_labels.label order by pet_labels.label) filter (where pet_labels.id is not null),
    array[]::text[]
  ) as pet_labels,
  coalesce(
    array_agg(distinct guardian_labels.label order by guardian_labels.label) filter (where guardian_labels.id is not null),
    array[]::text[]
  ) as guardian_labels,
  max(appointments.appointment_date) filter (
    where appointments.status in ('completed')
       or appointments.appointment_date < (now() at time zone 'Asia/Seoul')::date
  ) as recent_visit_date,
  min(
    appointments.appointment_date::text || ' ' || appointments.appointment_time::text
  ) filter (
    where appointments.status in ('pending', 'confirmed', 'in_progress', 'almost_done')
      and appointments.appointment_date >= (now() at time zone 'Asia/Seoul')::date
  ) as next_appointment_text,
  count(distinct appointments.id)::integer as appointment_count,
  count(distinct appointments.id) filter (where appointments.status = 'noshow')::integer as noshow_count,
  guardians.created_at,
  guardians.updated_at
from public.guardians
left join public.pets
  on pets.shop_id = guardians.shop_id
 and pets.guardian_id = guardians.id
left join public.guardian_labels
  on guardian_labels.shop_id = guardians.shop_id
 and guardian_labels.guardian_id = guardians.id
left join public.pet_labels
  on pet_labels.shop_id = guardians.shop_id
 and pet_labels.guardian_id = guardians.id
left join public.appointments
  on appointments.shop_id = guardians.shop_id
 and appointments.guardian_id = guardians.id
where coalesce(guardians.deleted_at, null) is null
group by
  guardians.shop_id,
  guardians.id,
  guardians.name,
  guardians.phone,
  guardians.memo,
  guardians.created_at,
  guardians.updated_at;

notify pgrst, 'reload schema';
