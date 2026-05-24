# 2026-05-22 미용 기록 사진/알림 연결 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 미용 기록 사진/알림 연결 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_grooming_record_media_links.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 미용 시작/픽업 준비/미용 완료 API 연결 후 사진과 알림 연결을 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'grooming_records'
  and column_name in (
    'staff_id',
    'started_status_event_id',
    'pickup_ready_status_event_id',
    'completed_status_event_id',
    'before_media_asset_id',
    'after_media_asset_id',
    'customer_notification_id',
    'shared_with_customer_at',
    'completed_by_user_id'
  )
order by ordinal_position;
```

## API 연결 후 테스트

1. 미용 시작 시 촬영한 사진은 `media_assets.media_kind = 'grooming_before'`로 저장되어야 합니다.
2. 미용 시작 상태 이벤트는 `appointment_status_events.to_status = 'in_progress'`로 남고, 해당 사진과 연결되어야 합니다.
3. 픽업 준비 또는 미용 완료 시 촬영한 사진은 `media_assets.media_kind = 'grooming_after'` 또는 `grooming_result`로 저장되어야 합니다.
4. 완료된 미용 기록은 `grooming_records.before_media_asset_id`, `after_media_asset_id`로 대표 사진을 따라갈 수 있어야 합니다.
5. 고객에게 미용 완료 알림톡을 보낸 경우 `customer_notification_id`와 `shared_with_customer_at`이 채워져야 합니다.
6. 고객 상세의 미용 기록에서는 `grooming_records`에서 담당자, 시작 사진, 완료 사진, 발송 알림을 한 번에 따라갈 수 있어야 합니다.

## 주의

- 이 SQL은 매출 기능을 추가하지 않습니다.
- 이 SQL은 알림톡 자동 발송을 만들지 않습니다.
- 사진 촬영 없이 미용 시작/픽업 준비 상태로 넘어가지 않는 원칙은 `appointment_status_events` 쪽 검증과 API에서 같이 지켜야 합니다.
