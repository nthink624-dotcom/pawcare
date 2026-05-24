# 2026-05-22 고객 예약 변경/취소 요청 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 고객 예약 변경/취소 요청 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_appointment_customer_requests.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 고객 예약 변경/취소 API 연결 후 요청 이력이 남는지 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.appointment_customer_requests') as appointment_customer_requests_table;
```

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'appointment_customer_requests'
order by ordinal_position;
```

## API 연결 후 테스트

1. 고객이 예약 취소를 요청하면 `request_type = 'cancel'` 이력이 생성되어야 합니다.
2. 고객이 예약 변경을 요청하면 기존 날짜/시간과 요청 날짜/시간이 함께 저장되어야 합니다.
3. 오너가 요청을 승인하거나 적용하면 `request_status`가 `approved` 또는 `applied`로 바뀌어야 합니다.
4. 오너가 거절하면 `request_status = 'rejected'`와 `owner_memo`가 남아야 합니다.
5. 고객 상세과 캘린더 우측 패널에서 해당 예약의 요청 이력을 조회할 수 있어야 합니다.
6. 요청 이력은 `appointments`의 최종 상태와 별개로 남아야 합니다.

## 주의

- 이 SQL은 예약을 자동 변경하지 않습니다.
- 이 SQL은 알림톡 자동 발송을 만들지 않습니다.
- 고객 전화번호 전체를 중복 저장하지 않고 `requester_phone_tail`에 일부만 저장하는 방향을 권장합니다.
