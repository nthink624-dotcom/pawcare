# 2026-05-22 예약 상태 동기화 메타데이터 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 예약 상태 동기화 메타데이터 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_appointment_status_sync_metadata.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. PC웹/모바일웹 상태 변경 API 연결 후 양쪽 화면 동기화를 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'appointments'
  and column_name in (
    'status_changed_at',
    'status_changed_by_user_id',
    'status_action_source',
    'last_status_event_id',
    'last_status_media_asset_id',
    'last_customer_request_id'
  )
order by ordinal_position;
```

```sql
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.appointments'::regclass
  and conname = 'appointments_status_check';
```

```sql
select
  status,
  count(*) as count
from public.appointments
group by status
order by status;
```

## API 연결 후 테스트

1. 예약 거절 상태 `rejected`가 DB 제약에 막히지 않아야 합니다.
2. PC웹에서 상태를 바꾸면 `appointments.status`, `updated_at`, `status_changed_at`, `status_action_source = 'owner_web'`가 갱신되어야 합니다.
3. 모바일웹에서 상태를 바꾸면 같은 예약 row가 갱신되고 `status_action_source = 'owner_mobile'`이 남아야 합니다.
4. 미용 시작/픽업 준비처럼 사진이 필요한 상태 변경은 `last_status_event_id`와 `last_status_media_asset_id`가 연결되어야 합니다.
5. 고객 변경/취소 요청을 처리한 상태 변경은 `last_customer_request_id`와 연결할 수 있어야 합니다.
6. PC웹은 `updated_at` 또는 `status_changed_at` 기준으로 주기 갱신했을 때 모바일 변경을 볼 수 있어야 합니다.

## 주의

- 이 SQL은 자동 상태 변경을 만들지 않습니다.
- 이 SQL은 알림톡 자동 발송을 만들지 않습니다.
- 상태 변경의 실제 검증, 사진 필수 검증, 알림 발송은 API에서 함께 처리해야 합니다.
