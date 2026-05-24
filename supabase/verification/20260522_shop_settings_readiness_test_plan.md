# 2026-05-22 설정 페이지 저장 스키마 보강

## Supabase SQL Editor 제목

`2026-05-22 설정 페이지 저장 스키마 보강`

## 적용 순서

1. 개발 Supabase에서 `20260522_shop_settings_readiness.sql`을 실행합니다.
2. 아래 DB 확인 쿼리를 실행합니다.
3. 운영 Supabase에도 같은 SQL을 실행합니다.

## DB 확인

```sql
select
  id,
  name,
  phone,
  address,
  profile_image_url,
  approval_mode,
  booking_slot_interval_minutes,
  booking_slot_offset_minutes,
  owner_alert_settings,
  reservation_policy_settings,
  notification_settings,
  customer_page_settings
from public.shops
limit 5;
```

## 설정 페이지 연결 후 테스트

아직 프론트/API 연결은 하지 않았으므로 이 SQL만 적용해도 설정 화면 저장 방식은 바로 바뀌지 않습니다.

프론트 연결을 허용한 다음에는 아래를 확인합니다.

1. 매장명, 연락처, 주소를 수정하고 새로고침해도 유지되어야 합니다.
2. 매장 프로필 이미지를 등록하면 `profile_image_url`에 URL이 저장되어야 합니다.
3. 운영시간, 정기 휴무일, 예약 가능 간격을 바꾸면 고객 예약 가능 시간이 함께 바뀌어야 합니다.
4. 승인 방식을 바꾸면 고객 예약 접수/확정 흐름이 동일하게 바뀌어야 합니다.
5. 취소 허용 시간은 `reservation_policy_settings.cancel_window` 기준으로 저장되어야 합니다.
6. 알림톡 전체 사용, 재방문 안내, 오너 알림 채널은 새로고침 후 유지되어야 합니다.
7. 결제 설정은 `owner_subscriptions`와 결제 원장 테이블에서 읽어야 하며, 설정 화면 임의 JSON에 따로 저장하지 않습니다.
8. 사용자 관리는 `staff_members`와 오너 계정 정보를 기준으로 읽어야 하며, 설정 화면 임의 숫자에 따로 저장하지 않습니다.

## 주의

- 이 SQL은 기존 매장, 고객, 예약 데이터를 삭제하지 않습니다.
- 결제/사용자 관리는 별도 도메인 테이블이 있으므로 `shops`에 중복 저장하지 않습니다.
- 설정 화면은 현재 일부 값이 `localStorage` 기반입니다. 이 스키마는 다음 단계인 API/프론트 연결을 위한 선행 작업입니다.
