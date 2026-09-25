# Mobile Owner/Staff Push Notification Contract

이 문서는 모바일 웹·Capacitor 앱의 푸시 수신 계약입니다. 현재 앱 등록 범위는 오너 계정이며, 실제 새 예약 푸시 발송과 직원 계정 권한 확장은 PC/backend 프로젝트가 이 계약에 맞춰 구현해야 합니다.

## 알림 구분

- `앱 알림`: 오너·직원 휴대폰으로 보내는 새 예약 푸시입니다.
- `알림톡 설정`: 고객에게 보내는 카카오 알림톡입니다.
- 두 설정과 발송 경로를 서로 섞지 않습니다.

## 앱 런타임

- 하이브리드 앱: Capacitor Push Notifications
- Android 토큰과 발송 경로: FCM
- iOS 토큰과 발송 경로: APNs
- 모바일 웹에서는 네이티브 푸시 권한을 요청하거나 기기 토큰을 등록하지 않습니다.

## 앱 설정

설정의 `앱 알림` 화면에서 아래 값을 기기별로 자동 저장합니다.

- 앱 알림 받기
- 새 예약 접수
- 알림 방식: 소리, 진동, 무음

휴대폰의 무음 모드, 방해금지, 운영체제 알림 채널 설정은 앱 설정보다 우선할 수 있습니다.

## 기기 토큰 등록

로그인한 앱에서 사용자가 알림을 켜고 권한을 허용하면 기기 토큰을 등록합니다. 토큰은 화면이나 로그, 로컬 저장소에 기록하지 않습니다.

```http
POST /api/owner/push-tokens
Authorization: Bearer <owner-access-token>
Content-Type: application/json
```

```json
{
  "shopId": "shop-id",
  "staffMemberId": null,
  "provider": "fcm",
  "platform": "android",
  "pushToken": "<device-token>",
  "deviceId": "<local-device-id>",
  "appId": "kr.petmanager.owner",
  "locale": "ko-KR",
  "timezone": "Asia/Seoul",
  "metadata": {
    "appRole": "owner",
    "bookingRequestedEnabled": true,
    "alertMode": "sound",
    "androidChannelId": "owner-bookings-sound-v1"
  }
}
```

알림을 끄거나 로그아웃하면 기기 ID를 기준으로 토큰을 비활성화하고 네이티브 등록을 해제합니다.

```http
DELETE /api/owner/push-tokens
Authorization: Bearer <owner-access-token>
Content-Type: application/json
```

```json
{
  "shopId": "shop-id",
  "deviceId": "<local-device-id>"
}
```

## Android 알림 채널

앱은 다음 채널을 생성하고 토큰 메타데이터에 선택 채널을 기록합니다.

- `owner-bookings-sound-v1`: 소리와 진동
- `owner-bookings-vibrate-v1`: 진동
- `owner-bookings-silent-v1`: 무음

PC/backend 발송부는 등록 토큰의 `androidChannelId`를 FCM Android notification channel ID로 사용해야 합니다.

## 새 예약 푸시 데이터

고객이 새 예약을 접수했을 때 PC/backend 발송부는 아래 데이터를 전송합니다.

```json
{
  "kind": "owner_booking_requested",
  "notificationId": "notification-id",
  "shopId": "shop-id",
  "appointmentId": "appointment-id",
  "guardianId": "guardian-id",
  "petId": "pet-id",
  "serviceId": "service-id",
  "staffId": "staff-id-or-null",
  "title": "새 예약이 접수되었습니다.",
  "body": "반려동물 · 보호자 / 예약 날짜와 시간 · 서비스",
  "route": {
    "tab": "Reservations",
    "screen": "ReservationDetail",
    "params": {
      "reservationId": "appointment-id"
    }
  }
}
```

앱 수신 동작:

- 앱 사용 중 수신: 예약 데이터를 새로 읽고 상단 안내를 표시합니다.
- 알림 선택: `예약조회`로 이동하고 appointmentId가 있으면 해당 예약 상세를 엽니다.
- appointmentId가 없거나 찾을 수 없으면 예약조회 목록까지만 이동합니다.

## 네이티브 빌드 필수 설정

Android:

- Firebase Android 앱의 `google-services.json`을 `android/app/google-services.json`에 둡니다.
- 파일은 저장소에 커밋하기 전에 팀의 비밀·설정 파일 정책을 확인합니다.
- `npx cap sync android` 후 실제 기기에서 권한, 토큰 등록, 수신을 확인합니다.

iOS:

- Xcode Target에서 Push Notifications capability를 활성화합니다.
- APNs 인증 키와 앱 번들 ID를 발송 서버에 연결합니다.
- 실제 기기에서 권한, 토큰 등록, 수신을 확인합니다.

## PC/backend 후속 구현

현재 모바일 앱은 오너 계정의 권한 요청, 토큰 등록, 수신, 예약 화면 이동까지 담당합니다. 고객 예약 생성 시 등록된 오너 토큰을 조회해 FCM/APNs로 보내는 발송부와 직원 계정의 매장 접근 권한 처리는 `D:\petmanager`에서 별도 구현해야 합니다.

발송부 필수 조건:

1. 고객 예약 생성이 성공한 뒤 한 번만 `owner_booking_requested`를 발송합니다.
2. 해당 매장의 활성 토큰만 사용합니다.
3. `bookingRequestedEnabled`가 `false`인 토큰은 제외합니다.
4. Android는 저장된 `androidChannelId`를 사용합니다.
5. 비활성·만료 토큰은 재시도 정책에 따라 정리합니다.
6. 토큰, Authorization 헤더, 전체 세션을 로그에 남기지 않습니다.
7. 예약 생성 자체의 성공 여부가 푸시 발송 실패에 의해 되돌아가지 않게 처리합니다.
8. 직원 알림을 열기 전 직원 세션이 자신의 매장 토큰만 등록·해제할 수 있는 권한 검증을 추가합니다.

## 출시 전 확인

- Android Firebase 설정 파일 존재
- iOS Push Notifications capability와 APNs 연결
- 오너 계정과 직원 계정의 토큰 등록 권한
- 새 예약 1건당 푸시 1회
- 소리·진동·무음 각각 실제 기기 확인
- 앱 종료, 백그라운드, 포그라운드 수신 확인
- 알림 선택 시 예약 상세 이동 확인
- 알림 끄기와 로그아웃 후 추가 수신 없음 확인
- 민감값 로그 미노출 확인
