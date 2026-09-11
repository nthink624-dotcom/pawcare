# 오너 예약 푸시 알림

고객 예약이 생성되면 서버는 `owner_booking_requested` 인앱 이벤트를 저장한 뒤, 활성 상태의 오너 Android FCM 토큰으로 같은 예약 알림을 발송한다. 앱이 열려 있으면 기존 인앱 배너가 보이고, 백그라운드나 잠금 화면에서는 Android 시스템 알림이 표시된다. 알림을 누르면 해당 예약 상세를 연다.

예약 접수 푸시는 기기별 `예약 접수` 스위치와 소리·진동·무음 채널 설정을 따른다. 전원이 꺼졌거나 네트워크가 끊긴 기기는 FCM이 최대 24시간 동안 전달을 시도하며, 그보다 늦게 연결되더라도 앱의 서버 동기화로 예약은 확인할 수 있다.

## 필요한 Firebase 서버 환경변수

다음 두 방식 중 하나만 사용한다. 값은 절대 `NEXT_PUBLIC_` 접두사를 사용하지 않는다.

1. `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase 서비스 계정 JSON 전체를 한 줄 JSON 문자열로 저장한다.
2. `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: 서비스 계정 JSON의 세 값을 각각 저장한다. `FIREBASE_PRIVATE_KEY`의 줄바꿈은 `\n`으로 저장할 수 있다.

Firebase 프로젝트에서 FCM HTTP v1 API를 사용 가능하게 하고, 서비스 계정에 Firebase Cloud Messaging API Admin 권한을 부여한다.

## 배포 절차

1. 개발 값은 `D:\petmanager-shared\env\petmanager-app.env.local`에 추가하고 `D:\petmanager-shared\sync-env.ps1`로 앱 루트에 동기화한다.
2. 같은 값을 Vercel Production 환경변수에 추가한 뒤 재배포한다.
3. Android 기기에서 오너로 로그인해 `설정 > 앱 알림 > 앱 알림 받기`를 켠다. Android 13 이상에서는 시스템 알림 권한도 허용한다.
4. 고객 예약을 생성해 잠금 화면, 다른 앱 사용 중, 앱 실행 중 각각에서 수신과 예약 상세 이동을 확인한다.

유효하지 않거나 해지된 FCM 토큰은 발송 실패 시 자동 비활성화한다. 서비스 계정 비밀값과 기기 토큰은 로그에 기록하지 않는다.
