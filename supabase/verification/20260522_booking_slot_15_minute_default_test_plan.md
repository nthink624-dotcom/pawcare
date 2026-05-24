# 2026-05-22 예약 계산 기본 단위 15분 전환

## Supabase SQL Editor 제목

`2026-05-22 예약 계산 기본 단위 15분 전환`

## 적용 순서

1. 개발 Supabase에서 `20260522_booking_slot_15_minute_default.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 예약 가능 시간 API가 15분 단위로 반환되는지 확인합니다.
4. 고객 예약 화면 정리 작업 후 UI가 복잡하지 않은지 확인합니다.
5. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select
  id,
  name,
  booking_slot_interval_minutes,
  booking_slot_offset_minutes
from public.shops
order by created_at desc;
```

```sql
select
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'shops'
  and column_name = 'booking_slot_interval_minutes';
```

```sql
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.shops'::regclass
  and conname in (
    'shops_booking_slot_interval_minutes_check',
    'shops_booking_slot_offset_minutes_check'
  )
order by conname;
```

## API 연결 후 테스트

1. 신규 매장은 기본 `booking_slot_interval_minutes = 15`로 생성되어야 합니다.
2. 기존에 기본값 30분을 쓰던 매장은 15분으로 전환되어야 합니다.
3. 기존에 10분, 20분, 60분처럼 명시적으로 다른 간격을 쓰던 매장은 그대로 유지되어야 합니다.
4. `14:00` 예약이 있고 서비스 소요시간이 60분이면 `13:00` 시작은 가능해야 합니다.
5. `14:00` 예약이 있고 서비스 소요시간이 75분이면 `13:00` 시작은 불가능해야 합니다.
6. 고객 화면에는 15분 슬롯을 그대로 길게 나열하지 말고, 별도 UI 작업으로 `오전/오후/저녁 + 더 보기` 구조를 적용해야 합니다.

## 주의

- 이 SQL은 고객 예약 화면을 바꾸지 않습니다.
- 이 SQL은 담당자 시간 겹침 방지 트리거보다 먼저 적용하는 것을 권장합니다.
- 담당자 겹침 방지 SQL을 올리기 전에는 `appointment_staff_overlap_conflicts` 조회로 기존 겹침을 먼저 확인해야 합니다.
