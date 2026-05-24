# 2026-05-22 예약 상태 변경 이력 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 예약 상태 변경 이력 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_appointment_status_events.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.appointment_status_events') as appointment_status_events_table;
```

```sql
select to_regclass('public.appointment_status_event_media') as appointment_status_event_media_table;
```

```sql
select
  id,
  shop_id,
  appointment_id,
  from_status,
  to_status,
  notification_type,
  primary_media_asset_id,
  action_source,
  created_at
from public.appointment_status_events
limit 5;
```

## API 연결 후 테스트

아직 프론트/API 연결은 하지 않았으므로 이 SQL만 적용해도 상태 변경 이력이 자동으로 쌓이지는 않습니다.

프론트/API 연결을 허용한 다음에는 아래를 확인합니다.

1. 예약 확정을 누르면 `appointments.status`가 `confirmed`가 되고 `appointment_status_events`에 `to_status = confirmed` 이력이 생겨야 합니다.
2. 예약 거절/취소도 각각 `rejected`, `cancelled` 이력으로 남아야 합니다.
3. 미용 시작은 사진 없이 저장되면 안 됩니다.
4. 미용 시작 사진을 첨부하면 `to_status = in_progress`, `notification_type = grooming_started`, `primary_media_asset_id`가 함께 저장되어야 합니다.
5. 픽업 준비도 사진 없이 저장되면 안 됩니다.
6. 픽업 준비 사진을 첨부하면 `to_status = almost_done`, `notification_type = grooming_almost_done`, `primary_media_asset_id`가 함께 저장되어야 합니다.
7. PC 웹에서 상태를 바꾸면 모바일 웹도 같은 현재 상태를 보여야 합니다.
8. 모바일 웹에서 상태를 바꾸면 PC 웹도 같은 현재 상태를 보여야 합니다.
9. 알림톡 발송이 성공하면 해당 `notification_id`가 상태 변경 이력과 연결되어야 합니다.

## 주의

- 이 SQL은 기존 예약, 고객, 사진, 알림톡 데이터를 삭제하지 않습니다.
- 현재 상태는 계속 `appointments.status`가 기준입니다.
- `appointment_status_events`는 현재 상태를 대체하지 않고, 누가 어떤 흐름으로 상태를 바꿨는지 추적하는 이력 테이블입니다.
