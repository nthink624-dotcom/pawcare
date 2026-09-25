# 모바일·Android·Play 릴리스 상세 규칙

이 파일은 `D:\petmanager\apps\mobile`의 3100 서버, Capacitor, Android Studio, APK/AAB, 실기기 또는 Play Console 작업을 다룰 때만 읽는다. 실행 승인 경계는 공통 규칙이 우선한다.

## 모바일 정본과 로컬 실행

- 모바일 웹·하이브리드 앱 정본은 현재 `D:\petmanager\apps\mobile` checkout이다. PC 저장소나 오래된 worktree의 모바일 파일로 릴리스 후보를 만들지 않는다.
- 로컬 모바일 origin은 `http://127.0.0.1:3100`이다. 기기 연결 전에 서버 listener, 앱 endpoint와 필요한 Android port reverse가 모두 3100을 가리키는지 확인한다.
- Capacitor 동기화 전 최신 모바일 웹 산출물과 native target을 확인하고, 생성된 Android 결과가 현재 원본을 포함하는지 검증한다.
- 작업이 시작한 3100 서버, adb 연결, emulator, Android Studio 보조 프로세스, 자동 browser만 소유권을 확인해 정리한다. 다른 작업이나 개인 프로세스는 종료하지 않는다.

## AAB와 Play

- web build, Capacitor sync, Android compile, signed AAB, 실기기 검증, Play upload, 심사 제출, production 공개는 각각 독립 단계다.
- AAB 작업 전 application/package ID, versionCode/versionName, signing 대상과 비밀 취급, production HTTPS API endpoint를 확인한다. 서명키와 암호를 채팅·명령·로그에 노출하지 않는다.
- 릴리스 준비는 개인정보처리방침, Data Safety, 실제 수집·공유·보관·삭제 동작, 권한 선언과 앱 동작이 맞는지 별도 증거로 확인한다.
- 빌드 또는 서명 AAB가 있어도 실기기 검증이나 Play 준비 완료로 간주하지 않는다.
- Play Console에서는 대표가 승인한 선언·트랙·artifact만 변경한다. 좁은 저장 요청은 저장 후 읽어 확인하고, 별도 승인 없이 제출·출시·production 공개로 넘어가지 않는다.

