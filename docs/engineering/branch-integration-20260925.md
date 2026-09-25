# 로컬 master 통합 기록 — 2026-09-25

## 결정과 반영

- 사용자 요청: 현재 작업 브랜치와 다른 브랜치를 검토하여 master에 통합.
- 후속 결정: 과거 마케팅 실험, 신청 데모, 전화 연동 시제품, 고정 자료 기반 출시 점검판은 복원 제외. 원본 브랜치는 보존.
- 현재 작업 브랜치 bbe6b9cb까지 master 전진: 이전 master 대비 38개 커밋 포함.
- 66be63bc: iOS 브랜치 병합. 앱 식별자 일치 및 첫 빌드 번호 처리 반영.
- c7d5755a: 보안/미디어 브랜치 병합. 누락된 권한 복구 SQL과 소스 테스트 추가. 미디어 함수 중복은 제외하고 최신 구현 유지.
- 83c7ab6e: origin/master를 현재 트리를 유지하는 ours 전략으로 병합. 예약·케어리포트 변경은 이미 반영되어 있었으며, 구 웹의 모바일 직접 렌더링 복원은 현재 apps/mobile 분리 구조에 맞지 않아 제외.

후속 배포 승인에 따라 개발 환경만 루프백을 사용하고, 운영 /owner/mobile은 https://app.petmanager.co.kr/owner/mobile로 이동하도록 수정했다. 서버 리다이렉트와 클라이언트 fallback 모두 적용하며 쿼리 문자열을 보존한다.

## 다른 브랜치 검토

- 과거 PC/개인정보/한마디 출시 후보를 통째로 합치면 CORS 상수, 미디어 삭제 검증 함수, 예약 요청사항, 도움 버튼, 요금표 함수, 결제 후 재조회가 중복됨을 확인. 전체 재적용 제외.
- 과거 알림톡 크레딧 화면 접근 차단 후보는 현재 요금제 통합 안내 화면에 다시 적용하지 않음.
- 모바일 R2·인증 후보는 동일하거나 후속 변경된 파일이 섞여 있어 루트 src에 직접 병합하지 않음.

## 후속 승인한 모바일 통합

- 사용자가 두 기능 모두 통합하도록 후속 승인했다. 기존 apps/web, apps/mobile, apps/shared 모노레포 정본과 루트 workspace 설정을 함께 기록한다. 기존 루트 src 미커밋 작업과 복구 자료는 유지한다.
- 3d80b095 / 8378268e의 Play 업데이트 모듈을 apps/mobile에 통합. MainActivity의 즉시 업데이트 코드를 선택형 FLEXIBLE 안내로 교체. 오너·스태프 설정에서 다시 시작할 수 있고 설치 후 이전 버전 캐시는 무효화한다.
- 10ecfa59의 시작·완료 사진 선택 시트를 현재 앱에 연결. 이미 변경된 카메라·사진 저장·상태 API 구현은 유지하고 선택 UI와 연결 핸들러만 통합. 시작 전 확인, 취소 무변경, 사진 저장 후 상태 변경, 사진 없이 완료 후 케어리포트 진입을 유지한다.
- 새 시트와 업데이트 UI는 공통 UI 스킬의 색상·글자·접근성 기준을 적용했다. 업데이트는 native dialog, 시트는 키보드 포커스와 취소 동작을 지원한다.
- 업데이트 테스트 7개, 실제 앱 핸들러 기반 선택 테스트 5개, 기존 사진 관련 회귀 20개 통과. 모바일 typecheck, production build, workspace/shared UI 검사 통과.
- Cordova 생성물이 누락되어 최초 native compile 실패. 기존 패키지로 cap update android 후 오프라인 compileDebugJavaWithJavac 성공. 새 패키지 설치 없음.
- 안전한 가상 입력으로 실제 컴포넌트를 띄워 1440/1024/430/390px, 촬영·직접완료·취소·키보드, 200% 글자/간격 확대 확인. 운영 예약 API나 알림톡을 실행하지 않음. 실제 Play 설치·기기 카메라 E2E는 미검증.
- 기존 모노레포 보고서에 기록된 웹 build의 고객 직접 취소 발송 검사 문제는 이번 두 기능 범위 밖으로 남아 있다. 전체 서비스 배포 가능 판정이 아니다.

## 검증과 보존

- iOS 변경 세 파일의 원본 브랜치 일치, 식별자, 첫 빌드 fallback, 충돌 마커 검사 통과.
- 보안 SQL·미디어 보관·삭제 검증·기존 RLS/deny 소스 검사 총 8개 통과.
- 현재 작업, origin/master, iOS, 보안, 미디어 보관의 다섯 브랜치가 master의 조상임을 확인.
- 실제 DB SQL 실행·권한 조회, iOS 빌드·서명, 실기기 검증은 하지 않음. 소스 검사는 운영 보안 검증을 대신하지 않음.
- 모노레포 정본 소스·설정·문서만 명시적으로 stage. 루트 src와 기타 미추적 작업 보존. stash, 삭제, 의존성 설치 없음.
- 원격 push·배포·브랜치 삭제 없음. 로컬 fixture 서버와 테스트 일반 Chrome만 사용했고 기존 3100 서버는 유지.
- 이전 master는 backup/master-before-integration-20260925 (0e049fa1)에 보존.

## 후속 배포 준비 — 2026-09-25

- 대표가 고객 직접 취소 무발송을 확정하고 운영 경로 수정, 검사 후 push/배포를 승인했다.
- 고객 직접 취소의 mock/Supabase 저장 후 알림 발송 두 곳만 제거했다. 기존 예약 저장·권한·오너 수동 발송 정책은 유지한다.
- 실제 취소 함수를 추출하여 저장 성공/실패와 무발송을 검사: 웹 reliability 135개 통과. 운영/개발 경로 및 서비스/cron 정본 검사 4개, workspace/shared UI, backend typecheck 통과.
- 웹 전체 production build 통과. 로컬 개발 env의 HTTP 릴레이가 production HTTPS 검증에 막혀, 로컬 빌드 프로세스에서만 ALIMTALK_RELAY_URL과 ALIMTALK_RELAY_ADMIN_URL을 빈 값으로 설정했다. 원본 env와 HTTPS 검증은 변경하지 않았다. 실제 운영 env 검증은 Vercel 원격 build가 담당한다.
- 배포 구성: petmanager는 apps/web, petmanager-app은 저장소 루트의 services 구성으로 apps/mobile과 backend를 배포한다. cron 두 개는 apps/web/vercel.json에만 유지한다. 두 프로젝트 production branch는 master로 맞춘다.
- 운영 복구 기준: 웹 dpl_AkC67YZcCrbxPrU9SY5RYgeVNW1b, 모바일 dpl_3AQ9JFZYPukeXskRTcsVEMtFi4hT. 이 절은 배포 전 검증 기록이며 push/배포 성공 증거는 별도로 확인한다.
- 운영 DB SQL 적용, 실제 고객 알림 발송, Play/App Store 제출은 실행하지 않는다.
