# PetManager 저장소 통합 작업 기록

## 최신 구조 변경

- 대표의 후속 요청에 따라 공통 소스 위치를 apps/shared로 변경했다. 아래 초기 기록의 packages/contracts는 초기 이관 단계의 경로다.
- apps/shared/components에 일반 버튼, 입력창, 입력 항목, 뒤로가기 버튼을 추출했고 웹/모바일 차이는 유지했다.
- 알림톡 계약은 apps/shared/contracts/alimtalk.ts에 있으며 내용은 바꾸지 않았다.
- 상세 결과는 shared-ui-extraction.md 참고. 검사 53개, 웹/모바일 typecheck, 모바일 build 통과. 기존 서버와 취소 발송 처리에는 손대지 않았다.

## 목표와 승인 범위

- 2026-09-25 대표 승인: D:\petmanager를 통합 소스 루트로 사용하고 웹, 모바일, 공유 계약을 구분한다.
- 계획 구조: apps/web, apps/mobile, packages/contracts. 공유 backend와 supabase는 루트에 유지한다.
- DB 데이터 이전, 운영 환경 변경, 원격 push/배포, 기존 원본 삭제는 실행하지 않는다.
- 현재 작업 작성자는 주담당 1명이다. 기존 미커밋 변경을 보존한다.

## 확인한 기준선

- 웹: bbe6b9cb738f401419c7218b140f2ab58368fcaa, codex/marketing-war-room-poc.
- 모바일: a9c29ae9924df55031b78a0d0054af15321de69c, owner-mobile-shell.
- 모바일 원격 추적 브랜치와 로컬에는 서로 다른 커밋이 있다. 원격 내용으로 로컬을 덮어쓰지 않는다.
- 모바일 runtime-finish 작업 폴더에는 수정 파일 14개와 미추적 파일이 있다. 오래된 폴더라는 이유로 삭제하거나 최신본에 섞지 않는다.
- 웹과 모바일의 packages/alimtalk-contract/index.ts는 내용은 같지만 실제로는 별도 파일이다.
- 웹/모바일 개발 서버 및 알림톡 relay가 기존 경로에서 실행 중이다. 이 작업이 시작한 프로세스가 아니다.

## 진행과 다음 단계

1. 읽기 전용 구조 및 Git 상태 조사 완료.
2. 웹 1,082개, 모바일 549개 파일을 복사하고 SHA256 일치 검증. 원본은 유지.
3. apps/web 및 apps/mobile이 packages/contracts/index.ts를 직접 사용하도록 변경.
4. npm workspaces와 단일 lockfile 구성. 기존 버전을 보존했고 새 모바일 의존성은 오프라인 잠금 파일 기준으로 설치. 원래 서버는 유지.
5. 웹·모바일·backend·relay typecheck 4개 모두 통과. 공유 구조 검사 5개, PC 로컬 안전 검사 9개, 모바일 요금표 검사 32개 통과.
6. 모바일 예약/고객 정합성 검사 16개 통과, 실제 DB 검사 1개 미실행(skip). Android endpoint 검사 2개도 통과.
7. 모바일 정식 build 통과. 웹 reliability 133개 중 132개 통과, 고객 직접 취소 무발송 검사 1개 실패. 웹 build는 이 사전검사에서 중단되며 우회하지 않았다.
8. 제품 소스·자산·네이티브 파일 1,148개 재검증: 원본 보존, 알림톡 계약 import 2곳 외 제품 소스 변경 없음.
9. npm ci 오프라인 dry-run 통과. 앱별 중복 잠금 파일은 복구 영역으로 옮겼으며 루트 잠금 파일을 사용한다.
7. root package.json은 workspace 명령으로 전환했지만 구 src/설정/서버는 아직 보존 중. 정본 전환 완료 아님.
8. 검증 결과에 따라 정본 전환. 미검증 항목은 완료로 보고하지 않는다.
9. 배포/복구 폴더는 상태 목록과 보존 위치를 기록하고, Git 연결 관계를 확인한 뒤에만 이동한다.

## 복구 자료와 현재 남은 작업

- .migration-backup/20260925/stage-manifest.json: 소스별 경로, 브랜치/HEAD, 파일별 SHA256.
- 같은 폴더의 web/mobile: 기존 설정 파일과 미커밋 diff, 테스트 로그. Git 제외 대상이다.
- 모바일 Git 로컬 및 원격 추적 이력을 refs/archive/mobile 아래에 보존했다. 기존 브랜치/커밋, 원격 저장소는 변경하지 않았다.
- Git worktree 10개, 배포 산출물 폴더 1개, 스키마 비교 폴더 1개를 archive에 이동. Git HEAD와 미커밋/미추적 상태를 이동 전후 비교했다. 기록은 archive-moves.json에 있다.
- 독립된 account-delete-r17 저장소 1개도 archive/legacy에 이동. HEAD d7e0cade4b930e822119e73d0b3498cbc451dad1 및 작업 상태 동일 확인.
- 위 13개 폴더는 삭제가 아니라 보관 위치 변경이다. 기존 D:\PetManagerArchive의 빈 부모 폴더는 삭제하지 않았다.
- 기존 D:\petmanager-app, D:\petmanager-shared, 루트 src와 기존 서버는 유지 중. 최종 정본 전환/기존 소스 철거는 아직 실행하지 않았다.
- 이 작업이 시작한 개발 서버/브라우저 없음. 통합본 build/typecheck 하위 프로세스가 남아 있지 않음을 확인했다.
- 커밋/push/배포/DB 쓰기/고객 알림톡 발송 없음. 실제 브라우저·Android 기기 검증은 미실행이다.

## 실제 발견된 기존 문제와 사용자 확인 요청

- apps/web/src/server/customer-bookings.ts의 고객 직접 취소 분기에서 여전히 booking_cancelled를 호출한다(연습/실제 저장 분기 각각 1곳).
- 원래 테스트는 고객 취소/변경 알림 4곳을 기대해서 원본에서도 실패했다. 이전 대표 결정에 맞는 무발송 검사로 바꾸니 남아 있는 취소 발송 2곳이 드러났다.
- 삭제된 예약 관리 링크 재발급/예약 변경 알림을 요구하던 오래된 테스트 기대값은 현재 계약에 맞췄다. 실제 제품 동작은 바꾸지 않았다.
- 대표에게 이 고객 취소 발송 제거까지 이번에 함께 적용할지 질문한 상태다. 응답 없이 제품 동작을 추가로 수정하지 않는다.
- 다음 단계: 답변에 따라 취소 발송 처리 → 웹 build 재확인 → 기존 서버 소유권 및 소스 재확인 → 정본 전환. Vercel/Codemagic 운영 연결 변경은 별도 승인 필요.

## 작업 분류

work_id: petmanager-monorepo-20260925
risk_tier: NORMAL
write_scope: apps/web, apps/mobile, packages/contracts, 루트 실행 설정, 이관 도구/문서
acceptance_route: /owner, /admin, /owner/mobile
required_widths: 구조 이관은 화면 변경 없음; 화면 검증 시 기존 경로 계약 적용
focused_check: 파일 보존 해시, 공유 계약 단일 소스, 웹/모바일 typecheck 및 기존 집중 테스트
budget_class: NORMAL
