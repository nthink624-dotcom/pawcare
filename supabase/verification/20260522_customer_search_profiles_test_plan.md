# 2026-05-22 고객 검색 프로필 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 고객 검색 프로필 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_customer_search_profiles.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 기존 고객 선택/API 연결 후 검색 결과가 구분 가능한지 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.customer_search_profiles') as customer_search_profiles_view;
```

```sql
select
  guardian_name,
  guardian_phone_tail,
  pet_names,
  pet_count,
  recent_visit_date,
  next_appointment_text,
  appointment_count,
  noshow_count
from public.customer_search_profiles
limit 20;
```

```sql
select
  schemaname,
  indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'guardians_shop_normalized_name_idx',
    'guardians_shop_normalized_phone_idx',
    'pets_shop_guardian_normalized_name_idx',
    'appointments_shop_guardian_date_time_idx'
  )
order by indexname;
```

## API 연결 후 테스트

1. 고객명으로 검색하면 같은 이름의 고객도 전화번호 끝자리와 반려동물 목록으로 구분되어야 합니다.
2. 반려동물명으로 검색하면 보호자와 함께 결과가 나와야 합니다.
3. 연락처 일부 검색은 숫자만 기준으로 처리되어야 합니다.
4. 다견 고객은 `pet_count`, `pet_names`로 구분되어야 합니다.
5. 최근 방문일과 다음 예약 정보가 기존 고객 선택 화면에서 표시될 수 있어야 합니다.
6. 삭제된 고객은 검색 뷰에 나오지 않아야 합니다.

## 주의

- 이 SQL은 프론트 화면을 바꾸지 않습니다.
- 이 SQL은 고객 정보를 새로 수집하지 않고, 이미 있는 `guardians`, `pets`, `appointments`, `guardian_labels`, `pet_labels`를 검색용으로 묶어 보여줍니다.
- `guardian_phone_digits`는 검색 API 내부 용도로만 쓰고, 화면에는 끝자리 중심으로 노출하는 방향을 권장합니다.
