# 예약금 기능 개발 구현·검증 결과 — 2026-10-18

## 결론과 작업 경계

로컬 정본 `D:\petmanager`와 개발 DB `petmanager-dev` (`qefxdtmdtvnzgupmjlom`)에서 예약금 운영 흐름을 구현하고 실제 앱/API와 전용 Chrome으로 검증했다. 분석·SQL 초안으로만 끝낸 상태가 아니다. 운영 DB, 운영 배포, push, 실제 고객 메시지 발송은 진행하지 않았다. 커밋도 하지 않았다. 기존 HEAD는 `5f02f63a441e9def6d5d720ccf11a1ccc8c45479`이다.

기존 미커밋·미추적 작업은 보존했다. 기존 예약·보호자·예약 준비 원본 해시는 최종 검사에서도 변경되지 않았다. 개발·운영 전체 스키마 일치 작업으로 범위를 확장하지 않았다.

## 오너와 고객이 사용할 화면

- **예약 정책 → 예약금**: 전체/첫 방문/기본 미요청, 노쇼 조회 기간·횟수, 입금 신고 기한, 확인 재알림, 금액·계좌, 취소 환불 비율을 설정한다. 고객 취소 기준은 입금 전 고객 예약 화면에도 안내된다.
- **고객 상세**: 매장 정책 따르기/항상 요청/면제, 기존 방문 고객 지정을 저장한다. 면제는 최종 우선이며 예약 차단·승인 규칙은 따로 유지한다.
- **고객 예약**: 시스템이 보호자 이력으로 대상을 판정한다. 비대상은 기존 즉시 확정, 대상은 입금 대기이며 시간은 확보된다. 고객이 임의로 납부 여부를 고르는 선택지는 사용하지 않는다.
- **고객 예약 확인**: 은행·계좌번호·예금주·실제 기한을 확인하고 입금자명으로 신고한다. 확인 전 입금자명 수정 가능. 신고만으로 돈이나 차감액은 생기지 않는다. 취소·환불된 예약도 해당 서명 링크에서 읽을 수 있다.
- **기존 예약 상세**: 오너가 실제 입금 총액을 확인·정정하고 재요청, 면제, 직접 송금 후 환불 완료를 기록한다. 다른 날짜의 미사용 잔액도 같은 상세 안에서 승계하거나 직접 환불한다. 새 환불 메뉴·고객 환불 계좌 저장은 만들지 않았다.
- **일정 변경**: 입금 대기 상태도 변경할 수 있다. 원래 기한은 연장하지 않고 더 이른 시작 시각으로만 앞당긴다. 시간 확보 실패 시 원래 예약·잔액·점유를 보존한다. 고객은 기존 권한·마감·가능 시간 검사 내 당일 시간을 변경하며, 날짜 변경에 따른 금전 승계는 오너에게 요청한다.
- **자동 처리**: 신고 없는 기한 초과는 취소·시간 해제. 유효 신고는 오너 확인 지연만으로 취소하지 않고 재알림하며 시작 시 확정한다. 이때 입금 미확인 경고와 실제 금액 0원은 유지된다.

## 실제 DB 적용

각 SQL은 격리 복원 DB에서 검사한 동일 바이트만 지정 개발 DB에 트랜잭션으로 적용했다. 백업 영수증·적용 전 함수·범위별 원복 파일은 로컬 검증 폴더에 보존했다. 아래 파일 외 과거 마이그레이션 일괄 재생, db push, 초기화, migration repair는 하지 않았다.

| 정본 SQL | 적용 시각 KST | SHA-256 앞 12자리 |
| --- | --- | --- |
| `20261018080122_booking_deposit_ledger_v1.sql` | 17:26:26 | a88b91a11d02 |
| `20261018083529_booking_deposit_transfer_audit_delivery.sql` | 17:40:48 | 882b03e8e0a6 |
| `20261018084833_booking_deposit_receipt_basis.sql` | 17:50:04 | b82f22c672da |
| `20261018085356_booking_deposit_manual_resolution.sql` | 17:56:44 | ca3c9de222ab |

예약금은 `booking_deposit_accounts`, 예약별 배분·소비는 `booking_deposit_links`, 변경 기록은 `booking_deposit_events`, 발송 요청은 `booking_deposit_outbox`가 담당한다. 실제 계좌 확인 총액 `receiptTotal`과 날짜 계정에 남긴 자금 `receivedTotal`도 구분했다. 4만원 중 2만원을 다른 날짜로 옮긴 뒤 총액 4만원을 다시 입력해도 돈이 추가 누적되지 않는다.

같은 날 일부 취소 시 자동 재배분, 전체 취소 시 한 번의 환불 산정, 완료 시 한 번의 차감, 이미 사용·환불·수수료 처리한 돈의 재사용 방지, 합계 제약 및 감사 로그를 적용했다. 입금 신고와 만료 경합은 행 잠금으로 직렬화한다. 실제 담당자 배정 상태에서 발견한 자동 확정 재귀 호출도 수정했다. 겹침 검사 자체는 제거하지 않았다.

기존 예약은 원장으로 일괄 변환하지 않는다. 고객 선택형 미추적 SQL `20261017094826_customer_optional_booking_deposit_flow.sql`도 적용하지 않았다. 기존 다른 마이그레이션 이력 차이는 이번 해결 범위가 아니다.

## 실행한 검증과 근거

검증 기록은 `.codex-work/deposit-implementation-20261018/`에 있다. 아래는 실제 실행 결과이며 과거 실패 기록을 삭제하거나 통과로 바꾸지 않았다.

| 검증 | 결과·근거 |
| --- | --- |
| 실제 개발 Auth + 예약 API | 비대상 확정, 대상 대기, 같은 날 요청 공유, 일정 변경·충돌 시 원복, 신고 0원, 입금 총액 확인, 일부/전체 취소, 환불, 첫 방문 추가 예약 면제, 면제/항상 요청, 타 매장 거부 통과. `development-04a4a788…json`의 개별 통과 기록 |
| 알림 공통 경로 | 전체 OFF에 force를 줘도 차단, 고객 수신 거부 차단, 허용 시 development_mock 통과. `development-7f12b6af…json` |
| 승계·복수 금액 배분 | 실제 총액 분배, 재시도 중복 방지, 타 매장 승계 거부, 취소 후 미환불 잔액 승계, 취소 outbox 통과. `development-60f84870…json`의 개별 통과 기록 |
| 실제 자동 실행 | 앱의 15초 실행 경로가 신고 없는 예약을 취소한 것 확인. `development-3417236c…json`의 해당 통과 기록. 담당자 배정 재귀 수정 후 시작 시 자동 확정·미확인 0원·오너 재알림·신고/만료 동시 연결 검증 통과. `development-db6c3fd3…json` |
| 나머지 실제 API | 필수 동의서 fail-closed, 노쇼 대상, 면제 우선, 노쇼 정정 후 신규 판단·기존 요청 보존, 이름/전화 수정 후 ID·이력 유지, 기존 방문 지정, 날짜 변경 미승계/원래 잔액 환불, 승계 뒤 총액 재입력 통과. `development-95acfda9…json` |
| 미용 완료·최종 정산 API | 실제 시작 → 픽업 준비 → 완료 API, 최종 요금 2만5천원에 확인 예약금 3만원을 적용해 2만5천원 한 번 차감·5천원 초과 환불, 완료 API 재호출 시 이중 차감 없음, 실제 미용 기록 1건·요금 2만5천원 유지, 직접 초과 환불 기록 통과. `development-91b34ce3…json` |
| 실제 브라우저 | 고객 신고, 고객 당일 시간 변경·날짜 승계의 오너 판단, 오너 입금 확인·확정, 고객 확인, 상세의 직접 환불 버튼, 신규 고객 4단계 예약 → 입금 대기, 고객 취소의 50% 테스트 스냅샷 산정, 취소 후 환불 내역 표시 통과. `development-1490b97d…json` 및 `resume-browser.mjs` |
| 화면 크기 | 정책과 고객 예약 확인을 1440/1024/430/390에서 확인. 새 입력창 계산상 최소 44px, 실측 약 43.995px. 고객 확인 화면 가로 넘침 없음. 32px 확대 글자 검사도 실행. 화면 캡처는 같은 폴더의 `ui-*.png` |
| SQL 회귀 | `supabase/tests/booking-deposit-ledger.sql` 5개 묶음 통과: 금액/대상, 시간/권한, 승계/감사/재예약, 담당자 배정 자동 처리/기존 잔액 환불, 면제가 예약 차단·승인을 해제하지 않음. `local-results.json` |
| 코드 검사 | 웹·모바일 타입 검사, workspace/shared UI 53개, 관련 집중 테스트 31개 통과. 전체 저장소의 모든 테스트·정식 배포 빌드·실기기 테스트를 했다는 뜻은 아님 |

중간 발견 사항도 실제 수정했다. 대기 예약을 ‘확정’으로 바꾸던 달력 표시, 고객 확인 화면의 confirmed-only 필터, 고객 취소가 예약금 환불 규정을 우회하던 경로, 기존 40px CSS 우선순위, 담당자 겹침 트리거를 통한 자동 확정 재귀가 이에 해당한다. 금전 작업의 버전 충돌은 자동 재실행하지 않고 최신 상태를 불러와 다시 확인하게 했다.

브라우저 검사 도중 테스트 코드의 버튼 이름 오류와 미처리 대기 Promise로 도구 프로세스가 종료된 건은 별도 재개 스크립트로 남은 실제 화면 검사를 수행했다. 테스트 탭을 닫고 임시 데이터를 삭제했으며 원래 로그인은 그대로 남아 있던 쿠키에서 복구해 실제 오너 화면 접근까지 확인했다. 다만 종료 전에 메모리에만 보관했던 원래 브라우저 로컬 환경설정 전체의 정확한 복구는 검증하지 못했다. 테스트가 만든 예약 프로필·임시 인증 키는 정리했다.

## 최종 안전 확인

`final-verification.json` 확인 결과:

- 기존 보호자·예약·예약 준비 해시 동일, 기존 예약 준비 6건 유지.
- 이번 모든 실행 ID 기준 테스트 매장·예약·원장·보호자·반려동물·Auth 사용자 잔여 0건.
- 예약금 테이블 전부 RLS 활성, 브라우저 직접 테이블 접근 및 새 RPC 실행 권한 없음. 실제 사용자 타 매장 접근도 거부됨.
- 지정 개발 DB의 함수 해시가 검증한 정본 SQL과 일치. 영향 테이블의 직접 외부 발송 트리거 검출 0건.
- 새로 시작한 임시 Postgres·검사 Node·브라우저 탭 종료 확인. 원래 사용자 소유 Chrome PID 11572와 3000 서버 PID 24064는 종료하지 않음.

보안 점검은 신규 테이블의 의도된 서버 전용 RLS 구조를 INFO로 표시했다([RLS 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). 기존 개발 Auth의 유출 비밀번호 보호 비활성 WARN 1건은 이번 범위 밖으로 유지했다([설명](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). 다른 기능의 정책·권한을 일괄 수정하지 않았다.

## 미검증·운영 반영 전 별도 확인

- 실제 쏘다 승인 템플릿 상태·실발송은 미검증이다. 개발은 모두 모의/차단이며 승인 확인 없는 신규 취소·만료·환불 템플릿은 실발송을 전제하지 않는다. `force`는 전체 OFF나 고객 거부를 우회하지 못한다.
- 개발 자동 실행은 기존 장기 실행 Next 프로세스에서 검증했다. 프로세스가 꺼지거나 유휴인 서버리스 환경까지 보장하는 운영 스케줄러를 설치·활성화한 것은 아니다. 운영 전 지속 실행 경로를 별도로 설정·검증해야 한다.
- 환불 규정의 적법성·운영 고지 검토, 실제 계좌 이체, 모바일 네이티브 앱/실기기, 운영 전체 스키마 및 기존 마이그레이션 이력 정리는 미검증이다. 고객 환불 계좌는 수집하지 않았다.
- hosted 전체 복원·다른 PC 복구는 여전히 미검증이다. 기존 검증된 개발 백업과 이번 대상별 원복 정의를 보존했으며 전체 DB 덮어쓰기 복원은 하지 않았다.

## 변경 파일

- 공통: `apps/shared/contracts/booking-deposit-ledger.ts`, `booking-preparation.ts`, `docs/shared/data-contracts.md`.
- DB: 위 4개 `supabase/migrations` 정본과 `supabase/tests/booking-deposit-ledger.sql`.
- 서버: `apps/web/src/server/booking-deposit-ledger.ts`, `booking-preparation.ts`, `customer-booking-consents.ts`, `customer-bookings.ts`, `owner-mutations.ts`, `schemas.ts`, `notification-dispatch.ts`.
- API: `apps/web/src/app/api/owner/booking-deposits/route.ts`, `appointments/route.ts`, `customer-booking-consent/route.ts`, `customer-booking-preparation/route.ts`, `customer-lookup/route.ts`, `cron/booking-deposit-expiry/route.ts`.
- 예약 UI: `apps/web/src/components/booking/booking-deposit-{policy-fields,customer-preference,ledger-panel,carry,alerts}.tsx`, `booking-preparation-panel.tsx`, `booking-policy-notice.tsx`.
- 고객 UI: `apps/web/src/components/customer/customer-booking-{page,manage-page,manage-panel}.tsx`, `customer-first-visit-claude-flow.tsx`.
- 오너 UI: `apps/web/src/components/owner-web/{booking-policy-panel,customer-detail-panel,owner-web-preview,customer-management-screen,calendar-management-screen,calendar-daily-schedule-grid}.tsx` 및 `apps/web/src/app/globals.css`의 예약금 한정 규칙.
- 연계/테스트: `apps/web/src/lib/{appointment-write-errors,notification-registry}.ts`, `apps/web/src/types/domain.ts`, `apps/web/tests/server/{booking-deposit-notification,appointment-pending-status-contract,appointment-write-errors}.test.mjs`.

사용한 UI 규칙은 기존 화면 재사용, 본문/입력 16px와 터치 영역 유지에 반영했다. 공유 계약을 쓰며 화면별 별도 원장이나 환불 메뉴를 추가하지 않았다.
