# 모바일 웹·앱 실행 구조

이 저장소는 모바일 웹과 Capacitor 하이브리드 앱을 함께 관리합니다.

## 로컬 모바일 웹

- 프로젝트: `D:\petmanager-app`
- 주소: `http://127.0.0.1:3100/owner/mobile`
- 시작: `npm run server:up`
- 종료: `npm run server:down`

모바일 오너 화면은 PC 프로젝트에서 수정하지 않습니다.

## 안드로이드 개발 앱

안드로이드 패키지명은 `kr.petmanager.owner`입니다. USB 디버깅을 허용한 안드로이드 휴대폰 1대를 연결한 뒤 실행합니다.

```powershell
npm run server:up
npm run android:dev
```

`android:dev`는 ADB reverse를 통해 현재 로컬 모바일 화면을 휴대폰에 설치합니다. 개발용이므로 `127.0.0.1:3100` 로컬 서버가 실행 중이어야 합니다.

## 안드로이드 운영 미리보기

운영 미리보기는 로컬 서버가 아니라 배포된 HTTPS 모바일 웹을 사용합니다.

```powershell
npm run android:preview
```

기본 배포 주소는 `https://petmanager-app.vercel.app/login`입니다. 공식 모바일 배포 주소가 바뀐 경우에만 아래처럼 지정합니다.

```powershell
$env:CAPACITOR_PRODUCTION_SERVER_URL = "https://mobile.example.com"
npm run android:preview
Remove-Item Env:\CAPACITOR_PRODUCTION_SERVER_URL
```

운영 미리보기 전에 현재 모바일 웹을 먼저 배포해야 합니다. 배포하지 않으면 설치된 앱에는 이전 배포 화면이 표시됩니다.

## 안드로이드 출시 준비물

1. Firebase에 안드로이드 앱 ID `kr.petmanager.owner`를 등록합니다.
2. 내려받은 `google-services.json`을 `android/app/google-services.json`에 둡니다.
3. `npm run android:setup-signing`을 한 번 실행하고, 생성된 업로드 키와 비밀번호를 안전하게 백업합니다.
4. 이전 출시보다 큰 버전 코드와 사용자에게 표시할 버전명을 정합니다.
5. 배포된 HTTPS 모바일 웹이 출시하려는 화면인지 확인합니다.

Firebase 파일, 서명 설정, 업로드 키, 로컬 환경변수 파일은 Git에 포함되지 않습니다.

## Play 스토어용 번들 빌드

```powershell
$env:PETMANAGER_ANDROID_VERSION_CODE = "1"
$env:PETMANAGER_ANDROID_VERSION_NAME = "1.0.0"
npm run android:release
Remove-Item Env:\PETMANAGER_ANDROID_VERSION_CODE
Remove-Item Env:\PETMANAGER_ANDROID_VERSION_NAME
```

서명된 번들은 `android/app/build/outputs/bundle/release/app-release.aab`에 생성됩니다.

## 프로젝트 역할

- PC 웹·공통 백엔드 기준: `D:\petmanager`
- 모바일 웹·Capacitor 앱: `D:\petmanager-app`
- 모바일 앱의 웹/API 주소: 배포된 모바일 런타임 주소

PC와 모바일은 공통 Supabase 데이터와 API 계약으로 일치시킵니다. UI 렌더링 코드를 서로 복사해 공유하지 않습니다.
