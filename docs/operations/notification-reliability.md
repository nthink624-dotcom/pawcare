# 알림톡 신뢰성 운영 계약

알림톡 발송은 `notifications` 행을 먼저 상태로 남기고, 중복·예약 시각·수신 거부·템플릿 미승인·잔여 크레딧 부족을 각각 구분한다.

## 코드 계약

- 예약 건별 중복 발송은 dedupe key와 `skipIfExists`로 차단한다.
- 예약된 발송은 `scheduled_at`과 현재 시각을 비교해 `queued`로 보류한다.
- provider 오류는 `failed`와 제한된 분류 코드로 남기며, 성공 시 `provider_message_id`를 저장한다.
- 발송 전에 차감된 알림톡 크레딧은 provider 실패 시 환불을 시도한다. 환불 자체가 실패하면 운영 로그에서 별도 확인해야 한다.
- 미용 완료 미디어가 연결된 발송은 `notification_delivery_checks`와 미디어 전달 결과를 별도로 기록한다.
- provider 로그에는 수신 전화번호, 메시지 본문, relay secret, API key를 기록하지 않는다.

## 자동 검사

- `npm run test:reliability --workspace=@petmanager/web`의 `notification-reliability-contract.test.mjs`가 위 계약과 관련 migration을 확인한다.
- 웹 `predeploy`와 `predeploy:auth`는 `check:alimtalk-env`를 먼저 실행한다. 이 검사는 `.env.vercel-production.local` 또는 보호된 Vercel production env readback이 있어야 하며, 확인되지 않은 sender·relay·template 설정으로 배포하지 않도록 중단한다.
- 실제 쏘다/알림톡 relay 호출, sender 채널 승인, 웹훅 재전송 대사는 계정 readback과 승인된 테스트 수신번호가 필요하다. 저장소 테스트 통과만으로 운영 발송 성공을 선언하지 않는다.

## 장애 처리

`failed` 알림은 고객에게 자동 재발송하지 않는다. provider 상태와 크레딧 환불 여부를 확인하고, 중복 키와 마지막 provider message id를 기준으로 운영자가 재처리한다. 관리자 전용 `GET/POST /api/admin/notifications/failures`가 실패 목록을 민감정보 없이 조회하고, 선택한 실패 건을 현재 예약·수신자 정보로 재처리하며 `owner_activity_events`에 감사 행을 남긴다. 관리자 화면은 운영자가 사용할 수 있는 상태이며, 공용 작업 큐와 자동화된 대량 재처리는 별도 P1 작업으로 남겨둔다.
