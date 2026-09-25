# 넘친Day Android 하이브리드 앱

## 기본 방향
- 앱 표시 이름: `넘친Day`
- Android 패키지 ID: `com.neomchinday.app`
- 방식: Capacitor WebView가 운영 웹앱의 모바일 오너 화면을 여는 하이브리드 앱
- 개발 기본 URL: `http://10.0.2.2:3000`
- 운영 URL은 빌드/동기화 시 `CAPACITOR_SERVER_URL` 환경변수로 지정

## 로컬 Android 확인
1. Next 개발 서버 실행
   - `npm run dev:local`
2. Android 프로젝트 동기화
   - `npm run android:sync`
3. Android Studio 열기
   - `npm run android:open`

에뮬레이터에서는 `10.0.2.2`가 PC의 `127.0.0.1`을 가리킵니다.

## 운영 URL로 동기화
운영 도메인이 예를 들어 `https://app.example.com`이라면:

```powershell
$env:CAPACITOR_SERVER_URL="https://app.example.com"
npm run android:sync
```

스토어용 빌드 전에는 반드시 실제 운영 URL로 `android:sync`를 다시 실행해야 합니다.

## 다음 체크리스트
- Google Play Console 개발자 계정 생성
- Android 앱 아이콘/스플래시 이미지 적용
- 카메라/사진 권한 문구 확인
- 실제 기기에서 로그인, 예약, 고객관리, 사진 촬영 테스트
- release keystore 생성
- AAB 빌드 후 내부 테스트 등록
