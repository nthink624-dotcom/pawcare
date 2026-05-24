# 2026-05-22 알림 발송 결과 이력 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 알림 발송 결과 이력 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_notification_delivery_audit.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 알림톡 발송/API 연결 작업 후 발송 이력이 남는지 확인합니다.
4. 문제가 없으면 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select to_regclass('public.notification_delivery_checks') as notification_delivery_checks_table;
```

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'notifications'
  and column_name in (
    'provider_delivery_status',
    'provider_delivery_error',
    'provider_delivery_found',
    'provider_delivery_checked_at',
    'credit_consume_event_id',
    'credit_refund_event_id',
    'sent_by_user_id',
    'action_source'
  )
order by ordinal_position;
```

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'notification_delivery_checks'
order by ordinal_position;
```

## API 연결 후 테스트

1. 오너가 알림톡을 직접 보내면 `notifications`에 발송 기록이 남아야 합니다.
2. 성공 발송이면 `notifications.status`, `provider_message_id`, `sent_at`이 채워져야 합니다.
3. 알림톡 1건 차감 이력은 `shop_alimtalk_credit_events`에 남고, `notifications.credit_consume_event_id`와 연결되어야 합니다.
4. 공급자 발송 실패로 환불되면 `notifications.credit_refund_event_id`가 연결되어야 합니다.
5. 쏘다 발송 내역 조회를 실행하면 `notification_delivery_checks`에 조회 이력이 쌓여야 합니다.
6. 마지막 조회 결과는 `notifications.provider_delivery_status`, `provider_delivery_error`, `provider_delivery_checked_at`에 반영되어야 합니다.
7. 고객 상세/예약 상세에서는 `notifications`와 `notification_delivery_checks`를 통해 “보냈는지, 실패했는지, 쏘다에서 확인됐는지”를 보여줄 수 있어야 합니다.

## 주의

- 이 SQL은 알림톡 자동 발송을 만들지 않습니다.
- 발송은 기존 원칙대로 오너가 직접 누른 액션에서만 일어나야 합니다.
- `recipient_phone_tail`에는 전체 전화번호가 아니라 끝자리 일부만 저장해도 됩니다. 전체 수신 번호는 기존 `notifications.recipient_phone` 기준으로 제한적으로 관리합니다.
