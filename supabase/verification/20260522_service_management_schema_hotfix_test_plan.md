# 2026-05-22 서비스/요금표 저장 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 서비스/요금표 저장 스키마 보강`

## 적용 순서

1. 직원/근무표 스키마 보강 SQL을 먼저 적용합니다. 이미 적용했다면 건너뜁니다.
2. 개발 Supabase에서 `20260522_service_management_schema_hotfix.sql`을 실행합니다.
3. 아래 스모크 테스트를 통과하면 운영 Supabase에도 같은 SQL을 실행합니다.

## 개발 DB 확인

SQL Editor에서 아래 쿼리를 실행합니다.

```sql
select
  id,
  name,
  category,
  description,
  sort_order,
  capacity_label,
  staff_selection_mode,
  price_guide
from public.services
limit 5;
```

```sql
select
  shop_id,
  duration_guide,
  extra_cost_guide
from public.shop_service_guides
limit 5;
```

```sql
select to_regclass('public.service_staff_assignments') as service_staff_assignments_table;
```

## 화면 테스트

아직 프론트/API 연결은 하지 않았으므로 이 SQL만 적용해도 서비스 관리 화면 저장 방식은 바로 바뀌지 않습니다.

프론트 연결을 허용한 다음에는 아래를 확인합니다.

1. 서비스 추가 후 새로고침해도 서비스가 남아 있어야 합니다.
2. 서비스명, 카테고리, 가격, 소요시간, 설명 문구, 노출 여부가 새로고침 후 유지되어야 합니다.
3. 서비스별 요금표를 수정한 뒤 새로고침해도 유지되어야 합니다.
4. 추가 비용 기준과 기본 소요시간 기준을 수정한 뒤 새로고침해도 유지되어야 합니다.
5. 담당 가능 직원을 특정 직원으로 바꾸면 `service_staff_assignments`에 매핑이 생겨야 합니다.
6. 담당 가능 직원을 전체 직원으로 바꾸면 특정 직원 매핑이 비워지고 서비스는 전체 직원 가능 상태로 남아야 합니다.

## 주의

- 이 SQL은 기존 서비스, 예약, 고객 데이터를 삭제하지 않습니다.
- 현재 서비스 화면은 여전히 `localStorage` 기반입니다. 이 스키마는 다음 단계인 API/프론트 연결을 위한 선행 작업입니다.
- 운영 적용 전에는 대상 프로젝트가 운영 Supabase인지 다시 확인해야 합니다.
