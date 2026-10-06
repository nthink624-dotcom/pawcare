# 예약 준비 구현 진행 기록

## 2026-10-06 개발 DB 적용 및 검증 갱신

대표가 다음 개발 단계 진행을 승인했다. petmanager-dev(qefxdtmdtvnzgupmjlom)에 예약 정책/예약 준비/고객 예약 조건 테이블과 관련 함수를 적용했다. 첫 시도에서 JSON 괄호 오류를 수정했고 실패분이 롤백된 것을 조회했다. 재시도 성공 후 RLS 및 브라우저 역할 접근 금지, service_role 접근을 확인했다. 운영은 미적용이다.

Hosted 도구가 기록한 실제 버전은 20261006011111이다. CLI로 생성한 파일을 supabase/migrations/20261006011111_booking_preparation_policies.sql로 맞췄다. 기존 다른 이력은 변경하지 않았다. 회귀 SQL은 scripts/qa/booking-preparation-regression.sql에 보존했다.

롤백 SQL 검증 통과: 미납 대기, 대기 예약 겹침 차단, 신고와 확인 분리, 입금 확인 후 확정, 필수 동의서 전 미용 시작 차단, 서명 원본 변경 금지, 오래된 버전 충돌, 동일 버전 서명 재사용, 미래 예약 노쇼 금지, 고객 온라인 예약 차단, 요청 수신 설정, 예약 취소, anon 읽기 및 authenticated RPC 거부. 동시 두 연결의 예약 경쟁 검증은 아직 아니다.

localhost:3000 고객 HTTP API 검증 통과: 정상 조회, 내부 필드 제거, 고객의 입금 확인 권한 거부, 입금 신고 저장, 오래된 버전 409, 고객 서명 저장, 재서명 거부, 요청 수신 거부 저장, 다른 보호자/예약 접근 403, 변조 토큰 401, 미인증 오너 401. 실제 개발 DB를 사용했고 실제 알림 발송은 없었다. SQL로 고객 HTTP 저장 결과 및 입금 확인 RPC의 확정을 확인했다. 로그인한 오너 화면/API의 전체 검증은 아니다.

이번 테스트 예약 삭제 후 서명본 보존을 확인하고, 정확한 테스트 매장을 삭제해 테스트 매장/서명 잔여 행 수 각각 0을 조회했다. 기존 데이터는 변경하지 않았다. 기존 삭제 감사 기능이 테스트 삭제의 비식별 감사 행을 남길 수 있다.

현재 남은 작업: 로그인한 오너의 정책 저장/입금 확인 화면, 고객 실제 터치 서명, 동시 예약 경쟁, 환불/노쇼 정정 경계, 독립 고위험 QA, 고객 계정 탈퇴/보관 정책 연동, 새 요청 알림톡 템플릿 승인·연결. PG 예약금/자동 환불은 미구현이며 현재 계좌이체 확인 및 수동 환불 기록 방식이다. 커밋/머지/배포/운영 DB/Auth 쓰기/실결제/외부 발송은 하지 않았다.

이번 단계는 새 브라우저/서버/탭을 만들지 않았고 기존 3000 서버와 전용 Chrome을 보존했다. API 확인 Node 명령은 종료됐다. 비밀키와 테스트 토큰은 출력/문서에 남기지 않았다.

## 이전 로컬 구현 단계 기록

목표: 승인된 예약금·서명 동의서·노쇼/취소 기획을 정본 D:\petmanager에서 구현한다.

결정: 계좌이체 신고와 실제 입금 확인 분리, 서명 원본 불변, 요청 상태와 발송 결과 분리, 미승인 템플릿 발송 차단, 기존 미커밋 작업 보존. 원격 DB 쓰기·템플릿 등록·운영 배포 미실행.

변경 파일: apps/shared/contracts/booking-preparation.ts, apps/shared/components/booking-signature-pad.tsx, apps/web/src/server/booking-preparation.ts, apps/web/src/app/api/{owner/booking-policy,owner/booking-preparation,customer-booking-preparation}/route.ts, apps/web/src/components/owner-web/booking-policy-panel.tsx, apps/web/src/components/booking/booking-preparation-panel.tsx, 설정/예약 상세/고객 예약 관리 연결 파일, owner-mutations.ts, customer-bookings.ts, appointment-write-errors.ts, supabase/migrations/20261006001541_booking_preparation_policies.sql.

확인 결과: 타입 검사에서 발견한 shop 선택값, 오류 분기 타입, OwnerApiError import 문제 수정. 전용 Chrome에서 샘플 화면 1440/1024/390 너비를 열어 설정 화면 배치·가로 넘침 없음 확인. 샘플 세션은 로그인이 없어 저장 비활성 상태이며 실제 저장 검증이 아니다. 기능 테스트는 요청되지 않아 추가·실행하지 않았다. 검수 DB를 읽기 조회하여 새 테이블 세 개 미적용 확인. 실제 저장·서명·입금 처리 및 RLS 실행 확인은 미완료.

환경: 정본과 node_modules 실제 경로 D:\petmanager, OneDrive 밖. 기존 사용자 서버 3000/PID15640, 승인된 전용 Chrome CDP5171/PID12800을 보존. 이 작업에서 서버·브라우저 프로세스 시작하지 않음. 확인용 탭 30C7FE613BB336935791A2A69BA87772만 생성 후 닫았고 재조회에서 종료 확인.

추가 구현: 예약 전 정책 확인·버전 검사, 보관된 서명본 조회, 예약별 문서 선택, 고객 요청 알림 수신 설정, 기존 취소 마감 정책 연동, 예약금 확인/면제 후 확정 알림 연동. 서명 이력은 예약/반려동물 삭제와 분리하여 보관하며 보호자/매장 삭제 시 제거한다.

다음 작업: 검수용 DB petmanager-dev(qefxdtmdtvnzgupmjlom)에 새 마이그레이션 적용 승인 후 저장 흐름 확인. DB 동시 예약·접근 권한·서명 원본·입금/환불·탈퇴 연동은 실행 확인 전이다. PG 예약금·자동 환불 및 새 알림톡 템플릿은 아직 연결되지 않음. 운영 배포·커밋 미실행.

최종 로컬 확인: TypeScript `--noEmit --incremental false` exit 0, 변경한 추적 파일의 diff whitespace 검사 exit 0. 확인용 탭 종료 재조회 true. 입금 오확인 정정·정책 버전 고정·별도 요청 수신 거부 필드를 추가했다. 웹 공통 알림 설정 소비자의 optional boolean 처리를 한 줄 조정했으며 Android/iOS 제품 파일은 수정하지 않았다. 아직 승인된 저장소 적용/실제 결제/서명/발송 성공을 의미하지 않는다.
