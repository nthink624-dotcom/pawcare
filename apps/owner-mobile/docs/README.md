# Petmanager Owner Mobile

오너용 모바일 앱 작업 공간입니다.

이 앱은 기존 오너 웹 URL을 띄우는 WebView 앱이 아니라, React Native와 Expo로 만드는 별도 화면 기반 하이브리드 앱입니다.

## 현재 범위

- 앱 프로젝트 뼈대 생성
- 1차 화면 라우팅 구조 생성
- 로그인, 홈, 예약, 예약 상세, 고객, 고객 상세, 설정 화면 자리 생성
- Supabase/API 연결 지점만 준비
- 푸시 알림 확장 폴더만 준비

## 실행

처음 한 번 의존성을 설치합니다.

```powershell
cd D:\petmanager-app\apps\owner-mobile
npm install
```

개발 서버를 실행합니다.

```powershell
npm run start
```

Android 에뮬레이터 또는 기기로 실행합니다.

```powershell
npm run android
```

iOS 시뮬레이터는 macOS 환경에서 실행합니다.

```powershell
npm run ios
```

## 아직 연결하지 않은 것

- 실제 로그인
- Supabase 세션 공유
- 기존 서버 API 호출
- 예약/고객 데이터 조회
- 예약 상태 변경
- 알림톡 발송 액션
- 푸시 알림 등록
- 앱 빌드/배포 설정
