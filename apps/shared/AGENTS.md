# 웹·모바일 공통 코드 작업 규칙

- 이 폴더는 독립 실행 앱이나 DB가 아니다. 웹·모바일이 사용하는 공통 소스다.
- components는 화면 표현, contracts는 공통 규격, lib는 공통 도우미를 담당한다.
- 웹/모바일 전용 경로(`@/`, apps/web, apps/mobile)에 역으로 의존하지 않는다.
- 코드 추출 시 API·인증·결제·예약·알림 발송 로직을 함께 변경하지 않는다.
- 서로 다른 글자 크기/터치 영역은 명시적인 스타일 선택으로 보존한다.
- 공통 UI 수정 후 루트에서 npm run test:workspace, npm run typecheck를 실행한다.
- Next.js/RSC 경계를 유지하며 앱별 globals.css에서 공통 components를 스타일 생성 범위에 포함한다.
