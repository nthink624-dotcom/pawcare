# Android Play 출시 체크리스트

## 앱 기준

- 앱 이름: `넘친데이 펫매니저`
- 패키지명: `kr.petmanager.owner`
- 첫 출시 버전: `1.0.0` (`versionCode 1`)
- 운영 앱 주소: `https://app.petmanager.co.kr`
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
- 개발 중에는 변경 범위 focused test와 `npm run typecheck`, 필요한 native compile만 수행한다.
- 현재 SHA와 일치하는 Production web build 증거가 있으면 `PETMANAGER_WEB_BUILD_EVIDENCE_SHA`로 전달하고 전체 web build를 반복하지 않는다. 증거가 없거나 SHA가 다르면 릴리스 스크립트가 `npm run build`를 1회 수행한다.
- 최종 후보에서만 `npm run android:release`를 실행한다. 이 명령은 Capacitor sync 1회와 Gradle `bundleRelease` 1회만 실행하며 별도 compile, clean, 의존성 재설치를 수행하지 않는다.
- 릴리스 스크립트는 생성된 동일 AAB에서 package/version, jarsigner exit code, 인증서 SHA256, 파일 SHA256, `server.url=https://app.petmanager.co.kr`, 실제 local/dev/preview endpoint 0건을 readback한다.
- 결과 JSON의 `stageSeconds`에서 web build, server probe, sync, bundle, verify, total 시간을 보존한다.

### 빠른 경로 실행

```powershell
$env:PETMANAGER_ANDROID_VERSION_CODE = "<Play 최고 code보다 큰 값>"
$env:PETMANAGER_ANDROID_VERSION_NAME = "<x.y.z>"
$env:PETMANAGER_WEB_BUILD_EVIDENCE_SHA = git rev-parse HEAD
npm run android:release
```

- Production web build 증거가 현재 SHA와 일치할 때만 마지막 환경 변수를 설정한다.
- 스크립트는 `node_modules`, Gradle wrapper/cache, `.gradle`, `.next`를 그대로 재사용한다.
- 이전 `app-release.aab`는 빌드 동안 별도 보관되며, 새 bundle 또는 검증 실패 시 복구된다. 검증을 통과한 후보만 `artifacts/android-release`에 보존한다.

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
