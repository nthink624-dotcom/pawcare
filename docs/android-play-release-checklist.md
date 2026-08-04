# Android Play 출시 체크리스트

## 앱 기준

- 앱 이름: `넘친데이 펫매니저`
- 패키지명: `kr.petmanager.owner`
- 첫 출시 버전: `1.0.0` (`versionCode 1`)
- 운영 앱 주소: `https://petmanager-app.vercel.app/login`
- 개인정보처리방침: `https://www.petmanager.co.kr/privacy`
- 고객지원 이메일: `nthink624@gmail.com`
- 고객지원 전화: `041-557-5529`

## 결제 정책

- Android 네이티브 앱에서는 플랜과 이용 기간만 확인한다.
- 플랜 추가·변경과 알림톡 충전은 PC에서 진행한다는 안내만 제공한다.
- Android 앱 안에는 PortOne 결제 버튼이나 외부 결제 링크를 노출하지 않는다.
- Google Play Billing 또는 한국 대체결제 프로그램을 도입하기 전까지 consumption-only 앱으로 운영한다.

## 빌드 전 확인

- Vercel Production이 운영 Supabase 프로젝트를 가리키는지 확인한다.
- `android/app/google-services.json`이 존재하고 Git에서 제외됐는지 확인한다.
- `.local-secrets/android/petmanager-upload.jks`와 `android/keystore.properties`가 존재하고 Git에서 제외됐는지 확인한다.
- 업로드 키와 비밀번호 파일을 별도 안전한 위치에 백업한다.
- `npm run lint`, `npm run typecheck`, `npm run build`를 통과한다.
- `npx cap sync android`를 통과한다.

## Play Console 입력

- 앱 또는 게임: 앱
- 카테고리: 비즈니스
- 앱 액세스: 심사용 오너 계정과 로그인 절차를 비공개 입력란에 제공한다.
- 개인정보처리방침 URL: `https://www.petmanager.co.kr/privacy`
- 광고 포함 여부와 데이터 보안 설문은 실제 SDK 및 수집 데이터 기준으로 작성한다.
- 카메라 권한은 미용 시작·픽업 준비 사진 촬영 용도로 설명한다.
- 알림 권한은 예약 및 업무 알림 용도로 설명한다.

## 테스트 트랙

- 첫 AAB는 내부 테스트에 올려 실제 기기 설치와 로그인, 사진, 알림, 로그아웃을 확인한다.
- 신규 개인 개발자 계정이면 비공개 테스트 참여자 요건을 Play Console 안내에 따라 충족한다.
- 운영 출시 전 ANR, 비정상 종료, WebView 네트워크 오류를 확인한다.
