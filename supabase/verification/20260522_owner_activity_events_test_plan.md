# 2026-05-22 오너 운영 변경 이력 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 오너 운영 변경 이력 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_owner_activity_events.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. API 연결 후 고객/예약/스태프/설정 변경 시 이벤트가 남는지 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.owner_activity_events') as owner_activity_events_table;
```

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'owner_activity_events'
order by ordinal_position;
```

```sql
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.owner_activity_events'::regclass
order by conname;
```

## API 연결 후 테스트

1. 오너가 고객 정보를 수정하면 `entity_type = 'guardian'`, `action_type = 'updated'` 이벤트가 남아야 합니다.
2. 예약 상태를 바꾸면 `entity_type = 'appointment'`, `action_type = 'status_changed'` 이벤트가 남아야 합니다.
3. 모바일웹에서 바꾼 이벤트는 `action_source = 'owner_mobile'`로 남아야 합니다.
4. 스태프 근무표 수정은 `entity_type = 'staff_schedule_override'`로 남아야 합니다.
5. 매장 설정 수정은 `entity_type = 'shop_settings'` 또는 `customer_page_settings`로 남아야 합니다.
6. 고객 상세/예약 상세에서 해당 고객 또는 예약과 연결된 최근 변경 이력을 조회할 수 있어야 합니다.

## 주의

- 이 SQL은 기존 동작을 바꾸지 않습니다.
- 이 SQL은 자동 알림톡이나 자동 상태 변경을 만들지 않습니다.
- 개인정보 전체를 이벤트 payload에 과하게 복제하지 말고, 필요한 변경 전후 값만 최소로 저장하는 방향을 권장합니다.
