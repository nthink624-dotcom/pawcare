# 2026-05-22 고객/반려동물 라벨 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 고객/반려동물 라벨 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_customer_labels.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 고객관리 화면/API 연결 작업 후 라벨 저장을 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.guardian_labels') as guardian_labels_table;
```

```sql
select to_regclass('public.pet_labels') as pet_labels_table;
```

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('guardian_labels', 'pet_labels')
order by table_name, ordinal_position;
```

## API 연결 후 테스트

1. 고객 상세에서 고객 라벨을 추가하면 `guardian_labels`에 저장되어야 합니다.
2. 반려동물별 라벨을 추가하면 `pet_labels`에 저장되어야 합니다.
3. 같은 고객/반려동물에 같은 라벨을 중복 저장하면 막혀야 합니다.
4. `피부 민감`, `상담 필요`, `대형견`처럼 오너가 직접 붙이는 라벨은 새로고침 후에도 유지되어야 합니다.
5. `노쇼 2회`, `다견`, `다음 예약 있음`처럼 예약/반려동물 수로 계산 가능한 값은 이 테이블에 중복 저장하지 않는 것이 원칙입니다.
6. 라벨 색상은 상태 인디케이터 기준과 맞춰 `neutral`, `teal`, `amber`, `burgundy`, `slate` 중 하나만 저장합니다.

## 주의

- 이 SQL은 프론트 UI를 바꾸지 않습니다.
- 이 SQL만 적용해도 기존 고객 목록 화면에 라벨이 자동 연결되지는 않습니다. 이후 API/화면 연결 작업이 필요합니다.
- 고객 삭제 시 고객 라벨은 함께 삭제되고, 반려동물 삭제 시 반려동물 라벨도 함께 삭제됩니다.
