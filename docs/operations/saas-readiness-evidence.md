# SaaS 준비도 검증 증거

이 문서는 계획 문서의 상태를 실제 검사 결과와 연결한다. 비밀값, 고객 데이터, 원본 전화번호는 기록하지 않는다.

## 2026-09-29 — 개발 Supabase RLS

- 대상: `petmanager-dev` / `qefxdtmdtvnzgupmjlom`
- 실행 전 대상 확인: `npm run check:supabase-cli-target:dev`
- 실행 명령: `npx supabase --workdir D:\\petmanager db query --linked --file supabase/verification/verify_public_table_rls.sql`
- 결과: 통과
- 확인 내용: `public` 스키마의 일반 테이블 전체가 `rls_enabled: true`로 반환됨
- 운영 영향: 없음. 개발 프로젝트에 대한 읽기 전용 SQL이며 INSERT/UPDATE/DELETE/DDL을 실행하지 않음
- 남은 확인: 운영 Supabase에서도 동일 SQL을 별도 승인 후 실행하고, 결과를 이 문서에 별도 기록해야 함

## 저장소 기준 자동 검사

다음 검사는 비밀값과 운영 데이터를 읽지 않는다.

```powershell
npm run check:saas-readiness
npm run check:owner-tenant-guards
npm run check:data-safety
npm run check:owner-auth-guards
npm run check:media-architecture
npm run check:privacy-operations
npm run check:backup-recovery
```

현재 모든 검사가 통과했지만, 이것만으로 운영 백업/PITR, R2 lifecycle, 결제 웹훅 등록, 오류 알림 수신을 증명하지는 않는다.

## 2026-09-29 — 코드 신뢰성 게이트

- `npm run test:reliability --workspace=@petmanager/web`
- 결과: 166개 통과 (전역 오류 경계 구조화 로깅, 알림 실패 재처리, 관리자 감사 로그 화면과 post-deploy 게이트 계약 포함)
- `npm run test:saas-readiness --workspace=@petmanager/web` 결과: 42개 통과. 교차 매장·shop-less 복구 무변경 계약, policyless RLS 브라우저 ACL 검증, 계정 삭제·provider별 미디어 잔여 확인 계약도 이 게이트에 포함함.
- 포함 범위: 상태·예약·미디어·CatchCall·가격표·테넌트 라우트/DB 무결성 계약·데이터 내보내기·알림톡 신뢰성·redacted observability·health/readiness·PortOne 웹훅 경계
- 타입 검사: `npm run typecheck:web -- --pretty false` 통과
- 모바일 타입 검사와 모바일 readiness 계약 테스트도 통과함 (`npm run typecheck:mobile`, `npm run test:mobile`)
- 운영 경계: PortOne 실제 웹훅 등록·서명 키·재전송 대사는 아직 계정 readback 필요

- `npm run check:backup-recovery` 결과: `PASS`
- 개발용 복구 스크립트의 개발 ref 고정, 운영 ref 차단, Windows PowerShell 호환 AES-CBC + HMAC-SHA256 인증 암호화, 격리 PostgreSQL 복구, 원격 쓰기 0건 조건을 확인함
- `verify-development-encrypted-backup-restore.ps1 -Preflight` 실제 실행 통과: `PMDUMP02` 파일 형식의 AES-CBC + HMAC-SHA256 파일 round trip(`FileRoundtrip=true`), 로컬 도구 확인, 네트워크/DB 쓰기 0건
- 실제 DB dump/복구 리허설: 보호된 개발 DB 비밀번호·CA 파일이 없어 이번 턴에는 실행하지 않음

## 2026-09-29 — 릴리스 빌드 게이트

- `npm run typecheck`: 웹·모바일 통과
- `npm run lint`: 통과
- HTTPS 릴레이 환경변수를 주입한 `npm run build:web`: 통과
- `npm run build:mobile`: 통과
- 기본 로컬 `.env.local`의 개발 릴레이 주소는 HTTP loopback이므로 production build가 의도적으로 거부함. 보안 검증을 완화하지 않고, 배포 환경에서는 HTTPS 릴레이 값을 주입해야 함.

## 2026-09-29 — 운영 환경 인벤토리

- `npm run check:environment-inventory` 결과: `PASS`
- 웹(`petmanager`)·모바일(`petmanager-app`) Vercel 프로젝트와 운영 도메인, 개발·운영 Supabase ref, R2·결제·알림톡 변경 승인 경계를 비밀값 없이 문서화함
- 실제 Vercel 환경변수, R2 lifecycle, PortOne/KCP 웹훅, 알림톡 sender/relay 설정은 계정 readback 전까지 미확인으로 유지함
- Supabase read-only project readback: 개발 `qefxdtmdtvnzgupmjlom`과 운영 `ysxykikqnneuhypybjry` 모두 `ACTIVE_HEALTHY`로 확인함. 운영 DB SQL/RLS·백업 설정은 조회하지 않음.
- Vercel read-only project list: `petmanager`와 `petmanager-app` 두 프로젝트와 프로젝트 ID를 확인함. 도메인 연결·환경변수·최신 production 배포 상태는 별도 readback 필요.
- Vercel deployment readback (latest): 웹 `dpl_D6KvYyZLDPUSZV5BCfQ5SBydiUQ3`와 모바일 `dpl_BwPvBzxo8efeH8j4uhScqJMyrgMo`가 모두 `READY`이고 SHA `b73f1012d0f5e02e57970cc1ea22ea2167651fba`이다. 다만 로컬의 새 health/readiness route는 아직 운영 배포에 포함되지 않아 운영 도메인 `/api/healthz`, `/api/readyz`는 재확인 결과 모두 404임. 배포는 대표의 별도 승인이 필요함.
- 운영 도메인 read-only HEAD 확인: `https://www.petmanager.co.kr/`와 `https://app.petmanager.co.kr/owner/mobile`은 HTTP 200. API health/readiness 404와는 구분되는 결과임.
- 모바일 프로젝트에도 health/readiness route와 계약 테스트를 추가함. 다음 승인된 모바일 배포 후 두 API가 200/503 계약대로 노출되는지 다시 readback해야 함.

## 2026-09-29 — Supabase 로그 readback

- 최근 24시간 소스별 건수만 읽기 전용 집계함: 운영 `edge_logs 18,795`, `auth_logs 1,680`, `postgrest_logs 721`, `postgres_logs 100` 등; 개발 `supavisor_logs 24`, `postgres_logs 7`, `postgrest_logs 1`.
- 로그 수집 자체는 확인했지만 오류 필터·알림 destination·보존기간은 변경 없이 미확인으로 유지함.
- Vercel production runtime read-only 집계(최근 24시간): 웹 `200=291`, `204=290`, `4xx/5xx 없음`; 모바일 `200=6`, `307=1`, `4xx/5xx 없음`. 집계 결과는 현재 배포 상태만 보여주며 새 로컬 변경의 운영 반영을 증명하지 않음.
- Vercel runtime error readback(최근 24시간): 웹·모바일 모두 오류 클러스터 없음. 이는 현재 배포의 관측 결과이며, 로컬 미배포 health/readiness 변경의 반영을 의미하지 않음.
- 로컬 웹·모바일 readiness 계약에 provider hang 방지용 2초 `AbortController` timeout을 추가했고, 양쪽 readiness 계약 테스트와 웹·모바일 타입 검사를 통과함.

## 2026-09-29 — Supabase Advisor readback

- 개발·운영 프로젝트 모두 `auth_leaked_password_protection` 경고 1건(유출 비밀번호 보호 비활성)을 확인함. 인증 보안 설정은 대시보드에서 별도 승인 후 활성화해야 하며, 이번 턴에는 변경하지 않음.
- `rls_enabled_no_policy`: 개발 78건·운영 67건(INFO). 운영 메타데이터에서 정책 없는 RLS 테이블 중 브라우저 ACL이 남은 항목을 확인했고, 해당 ACL을 `anon`/`authenticated`에서 제거하고 `service_role`만 유지하는 migration(`20260929131500_revoke_policyless_browser_grants.sql`)을 정본에 추가함. 승인 전까지 양쪽 DB에는 적용하지 않음.
- `supabase/verification/verify_policyless_rls_acl.sql` read-only 실행 결과: 운영 31건·개발 32건, 모두 `PENDING_MIGRATION`. migration 적용 후 양쪽 결과가 0/PASS인지 재확인해야 함.
- 성능 advisor는 양쪽 모두 중복 인덱스 경고 1건과 다수의 미사용/미인덱스 INFO를 보고함. 중복 제거 migration(`20260929130000_remove_redundant_notification_index.sql`)을 정본에 추가했지만, 승인 없이 운영 인덱스를 삭제·추가하거나 migration을 적용하지 않음.

## 2026-09-29 — Migration drift readback

- 저장소 migration 이름과 원격 history를 read-only 대조함: 운영 원격 121개 중 저장소 미적용 32개, 개발 원격 146개 중 저장소 미적용 8개.
- 원격 version 숫자는 과거 적용 시점에 재기록된 값이 있어 이름 기준으로 대조했으며, drift를 해결했다고 간주하지 않음.
- migration 적용·history 수정은 승인 전까지 하지 않으며, 개발 적용 → 계약/기능 검증 → 운영 승인·readback 순서가 필요함. 상세 목록과 적용 순서는 `docs/operations/migration-drift-readback.md`에 기록함.
- 개발 guarded `supabase:db:reconcile:dev:dry-run`도 원격에만 있는 migration version 5개 때문에 `DbPushMissingLocalError`로 중단됨. CLI가 제안한 `migration repair`/`db pull`은 승인 없이 실행하지 않음.

## 2026-09-29 — 테넌트 격리 계약

- `npm run check:tenant-isolation` 결과: `PASS`
- owner 라우트 가드, 교차 매장 DB 무결성 계약, 개발 전용 foreign-tenant 거부·잔여 데이터 0 픽스처의 존재와 안전 경계를 확인함
- 개발 DB 픽스처 실제 실행은 보호된 자격증명과 임시 쓰기가 필요하므로 이번 턴에는 실행하지 않음

## 2026-09-29 — PR 운영 게이트

- `.github/workflows/owner-auth-guard.yml`에 SaaS readiness, 테넌트 격리, 데이터 안전, 개인정보, 백업 계약, 환경 인벤토리, owner route, 미디어 검사를 PR/master-main push 게이트로 연결함
- 같은 workflow에 `alimtalk-relay-security` 독립 job을 추가해 relay 의존성 설치, typecheck, 보안 테스트를 별도 실행하도록 연결함
- 실제 GitHub 실행 결과는 push/PR 실행 readback 전까지 미확인으로 유지함
- `npm run predeploy:release`는 웹·모바일·공통 계약·환경 가드·백업 fixture·타입/린트·양쪽 빌드를 한 번에 실행한다. 현재 보호된 production 알림톡 env 파일이 없어 `check:alimtalk-env` 단계에서 의도적으로 중단되는 것까지 확인함.

## 2026-09-29 — 알림톡 신뢰성 계약

- `notification-reliability-contract.test.mjs`를 회귀 테스트에 연결해 중복 차단, 예약 큐, 실패 상태, 크레딧 환불, 미디어 전달 결과, provider 로그 비노출을 검사함
- 실제 쏘다/알림톡 계정 발송과 재전송 대사는 승인된 테스트 수신번호 및 계정 readback 전까지 미확인으로 유지함

## 2026-09-29 — 개인정보·데이터 내보내기

- `GET /api/owner/data-export?shopId=...`를 owner 전용·매장 범위·allowlist JSON 계약으로 추가함
- owner별 10분 3회 제한과 `429`/`Retry-After` 응답을 추가함. 고객 예약 링크 복구는 IP·전화번호·매장 단위 제한(각 15분 10회·3회·30회)과 인스턴스 로컬 저장소 상한을 적용하고, 데이터 내보내기 limiter도 key 수 상한을 적용함. 운영 공용 rate-limit primitive readback이 필요함
- 오너 설정의 `내 데이터 다운로드`에서 인증된 응답을 no-store 파일로 저장함
- 미디어 바이너리·인증 비밀값·결제 자격증명·provider token·내부 감사 행은 내보내지 않음
- `observability-contract.md`와 `logOperationalEvent`로 오류 로그의 허용 필드를 제한함

## 2026-09-29 — Production endpoint smoke gate

- `npm run check:production-endpoints -- --report-only` read-only 실행 결과: 웹·모바일 `/api/healthz`, `/api/readyz` 모두 HTTP 404
- 같은 검사를 기본 모드로 실행했을 때 exit code `1`로 배포 누락을 차단함
- 이 결과는 현재 production 배포가 `READY`여도 로컬의 새 route가 아직 포함되지 않았음을 확인하며, 승인된 배포 후 기본 smoke gate가 PASS해야 운영 준비 항목을 갱신할 수 있음

## 2026-09-29 — Alimtalk relay correlation

- 웹·모바일 Alimtalk provider가 발송 단위 `x-request-id`를 생성해 relay로 전달하고, relay가 제한된 값만 echo하도록 보완함
- relay 응답 본문·인증 헤더·provider payload 계약은 유지함
- `backend/alimtalk-relay` typecheck와 보안 테스트 11개, 웹 provider 로그 보안 계약 2개, 모바일 provider 로그 보안 계약 1개, 알림톡 신뢰성 계약 3개 통과
- request ID는 진단용 메타데이터이며 고객 전화번호·메시지 본문·인증정보를 포함하지 않음

## 2026-09-29 — PortOne production environment readback

- `npm run check:payment-env:vercel`를 웹 Vercel 프로젝트에서 read-only로 실행함. 임시 파일에는 값을 저장하지만 비밀값은 출력하지 않고 검사 후 삭제함.
- `PORTONE_API_SECRET`와 store ID는 존재함.
- `PORTONE_WEBHOOK_SECRET`, `BILLING_KEY_ENCRYPTION_SECRET`, billing/payment channel key는 운영 환경에서 누락됨.
- 검사는 의도적으로 non-zero로 종료했으며, 승인된 Vercel 환경변수 변경과 재-readback 전에는 결제·정기결제 운영 준비를 완료로 판단하지 않음.

## 2026-09-29 — Local encrypted backup and isolated restore rerun

- `npm run check:backup-recovery:preflight`: `PM_DEV_ENCRYPTED_BACKUP_PREFLIGHT_PASS` (AES-CBC+HMAC-SHA256, PMDUMP02, 원격 쓰기 0건, 네트워크 없음)
- `npm run check:backup-recovery:local`: `POSTGRES_SIGNUP_REPAIR_BACKUP_RESTORE_ROLLBACK_PASS`
- 검증은 임시 로컬 PostgreSQL 클러스터에서 수행하고 종료·정리했으며, 운영 Supabase의 daily backup/PITR 또는 R2 객체 복구를 증명하는 결과로 해석하지 않음.

## 2026-09-29 — Production Supabase RLS metadata readback

- 운영 Supabase에 읽기 전용 메타데이터 쿼리를 실행한 결과 public 테이블 83개 모두 `relrowsecurity=true`였고 RLS 미활성 테이블은 0개였음.
- 다만 67개 테이블에는 정책이 없었고 `anon`·`authenticated` 브라우저 권한 행이 각각 224개 남아 있었음. 정책이 없는 RLS 테이블은 기본적으로 브라우저 행 접근이 허용되지 않지만, 불필요한 권한은 최소권한 원칙에 맞지 않음.
- `20260929131500_revoke_policyless_browser_grants.sql`을 저장소에 준비했으나 운영 적용·readback은 별도 승인 전까지 수행하지 않음. 따라서 운영 테넌트 격리는 RLS 활성 상태만 확인된 부분 완료로 유지함.

## 2026-09-29 — 관리자 운영 추적 화면

- 관리자 전용 `GET /api/admin/notifications/failures`와 `/admin/notifications`에서 실패 알림을 민감정보 없이 조회·재처리할 수 있다.
- 관리자 전용 `GET /api/admin/audit-events`와 `/admin/audit`에서 최대 100건의 주체·작업·대상·시각을 필터링할 수 있다. payload·사용자 에이전트·메시지 원문은 응답에 포함하지 않는다.
- 관련 계약 테스트와 웹 타입 검사·ESLint·실제 1440/1024/430/390px 화면 확인을 통과했다. 운영 배포 readback 전에는 운영 기능 완료로 표시하지 않는다.

## 2026-09-29 — provider별 미디어 삭제 검증 보강

- R2 객체만 대상으로 하는 삭제 검증에서 Supabase Storage 관리자 조회를 불필요하게 시도하지 않도록 조기 종료 조건을 추가함.
- 계정 삭제·미디어 cleanup·retention 계약 10개와 웹 타입 검사를 통과함. R2/Storage lifecycle 및 실제 복구는 계정 readback 전까지 미확인으로 유지함.
- 웹·모바일 모두 `MEDIA_STORAGE_PROVIDER=supabase` 명시값을 운영 기본 R2 추론보다 우선하도록 고정하고, 양쪽 provider 선택 계약 테스트를 통과함.
- 새 미디어·변형 경로에는 `transient|retained/<provider>/...` 표식을 기록하고, 업로드·조회·삭제·잔여 검증은 경로 provider를 우선 사용함. provider 전환 뒤에도 기존 경로는 legacy fallback으로 계속 읽을 수 있음.

## 2026-09-29 — 배포 후 단일 검증 명령

- `postdeploy:release -- --expected-release <Git SHA>`를 추가해 배포 후 production health/readiness, Vercel 환경 readback, Supabase 보안 readback, 저장된 증거 구조를 한 번에 재검증하도록 고정함.
- SHA가 없거나 40자리 Git SHA가 아니면 즉시 실패하며, 명령은 배포·DB 변경·환경변수 변경을 수행하지 않음.

## 2026-09-29 — Vercel runtime error readback

- 웹 `petmanager`와 모바일 `petmanager-app`의 최근 24시간 runtime error cluster를 read-only로 조회함.
- 두 프로젝트 모두 집계된 runtime error가 없었음. 이는 오류 알림 destination, 보존기간, health/readiness route의 운영 배포까지 완료했다는 뜻은 아니며, 다음 readback 시점의 관측 결과로만 기록함.
