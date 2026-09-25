# DEVELOPMENT_SCHEMA_AND_ATOMIC_SIGNUP_REPAIR v0.1

판정: **보안팀 FINAL GATE v3 적합 / 제한된 Development 적용 검증 진행 가능**. 승인은 Development `qefxdtmdtvnzgupmjlom`의 검토된 pending 5개, 사전 backup/PITR 확인, 합성 계정·합성 이미지, F gate 기본 off 범위에 한정됩니다. Production, Development migration apply, 외부 Vision, 실제 회원·고객 데이터 변경은 이번 작업에서 모두 0입니다.

## 현재 완료

- 원격 migration history에는 `202605190005_multi_shop_foundation`이 있으나 Development schema에는 `owner_shop_memberships` relation이 없는 상태를 read-only로 대조했습니다.
- pending 첫 migration이 canonical membership schema를 재구성하고, 필수 컬럼·PK·role constraint를 검증한 뒤 RLS와 명시적 grant/revoke를 적용하도록 수정했습니다.
- 첫 3개 pending migration에 역순 rollback을 추가했습니다. membership은 건수와 전체 행의 결정적 SHA-256 fingerprint를 모두 비교하므로 동일 건수의 role/ID/timestamp 변경도 삭제하지 않고 오류로 차단합니다. atomic signup request가 존재해도 fail-closed입니다.
- 예약 기본값 변경 전 값은 service-role 전용 migration backup table에 보존해 rollback 때 정확히 복원합니다.
- Vision 비용은 요청당 `$0.0012` 고정 계상을 제거했습니다. 분석 전 `13,000 micro-USD`를 보수 예약하고, `gpt-4o-mini` 응답 usage가 있으면 input `$0.15/1M` + output `$0.60/1M`으로 실제 계상합니다. usage 또는 모델 가격이 불명확하면 `13,000 micro-USD`를 계상하는 fail-closed 계약입니다.
- PC·모바일 공용 원자 가입 계약을 `SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1.md`로 고정했습니다.
- main `POST /api/auth/signup`은 contract header 확인 직후, 환경·Auth·본인인증 provider·DB 접근 전에 JSON 본문을 64KiB로 제한합니다. Content-Length 선차단과 bounded streaming을 함께 사용하며, 누락·거짓·chunked 길이도 우회할 수 없습니다. 압축 JSON은 415로 차단합니다.

## Pending migration 순서와 checksum

| 순서 | Migration | SHA-256 | 의존성 |
|---:|---|---|---|
| 1 | `20260826034028_secure_owner_shop_memberships.sql` | `84b3fce7ec2f4877089df15c2ba0e39fbfed7a8996e540234259d621c79f5617` | `auth.users`, `shops`, `owner_profiles`, `extensions.pgcrypto` |
| 2 | `20260826111854_lock_product_booking_defaults.sql` | `28f216ed45f95fde4f037e7f9c2a2ddcf6b3dccc7b2f8688121351b0a2e4b18b` | `shops` 예약 설정 컬럼 |
| 3 | `202608270001_atomic_owner_signup_draft.sql` | `e0393ed60397778fc80c772d5fbc0e2451ebbedc1b7856f1e636bf38c2c0f22e` | 1의 membership, canonical services/staff |
| 4 | `20260827020524_secure_signup_ai_price_guide.sql` | `5f8c4e0f600e41c2d84effd387ea53549a562e7fa561b87855b30cfa6fdcaa14` | 3의 v1/idempotency, KCP/Credit tables |
| 5 | `20260827031414_secure_signup_ai_price_guide_metering.sql` | `ef83c86f924439ff38725664cfe1dc6d6ee00d50d28cbc737236deb5de64bb93` | 4의 analysis request/RPC |

Supabase CLI `--include-all --dry-run`은 Development `petmanager-dev (qefxdtmdtvnzgupmjlom)`에 위 5개를 정확히 같은 순서로 표시했습니다. `apply=false`입니다.

## 예정 schema diff

- 복구: `owner_shop_memberships`, primary owner unique index, shop index.
- 내부 복구 상태: `migration_20260826034028_reconciliation_state`.
- rollback용 설정 snapshot: `migration_20260826111854_booking_defaults_backup`.
- 원자 가입: `signup_idempotency_requests`, `complete_owner_signup_v1`, 이후 v2 state machine.
- AI 분석 보안: analysis request, 비식별 HMAC meter bucket, 관련 service-role RPC.
- 모든 신규 내부 relation은 RLS enabled이며 `public`, `anon`, `authenticated` direct privilege를 제거합니다.

## Backup·restore·rollback 증거

격리 PostgreSQL 18 임시 cluster에서 다음을 실제 실행했습니다.

1. 합성 Auth user/shop/profile 생성.
2. pending 1→2→3 forward 적용.
3. membership backfill, RLS/grant, 예약 기본값 snapshot, atomic RPC assertion 통과.
4. `pg_dump -Fc` 후 두 번째 빈 DB에 `pg_restore --exit-on-error`.
5. restore DB에서 동일 forward assertion 통과.
6. restore DB의 membership 1행을 `owner→manager`로 바꿔 row count가 같은 mutation을 만들고 rollback 실행. `PM_MEMBERSHIP_ROLLBACK_BLOCKED_CONTENT_CHANGED`로 차단되며 relation이 유지되는지 확인.
7. 원본 fixture DB에서 rollback 3→2→1 적용.
8. atomic relation/RPC 제거, 예약값 원복, membership 안전 제거 assertion 통과.
9. 임시 PostgreSQL 종료 및 temp cluster 삭제 확인.

재현 명령: `powershell -ExecutionPolicy Bypass -File .\scripts\verify-development-signup-repair-postgres.ps1`

최종 표식: `POSTGRES_SIGNUP_REPAIR_BACKUP_RESTORE_ROLLBACK_PASS`.

## 테스트 결과

- 기존 targeted Node tests: 36/36 pass. 보안 수정 후 membership contract suite: 10/10 pass.
- TypeScript: `tsc --noEmit` pass.
- migration/contract checksum verifier: pass, failures 0.
- Development CLI dry-run: pass, 정확히 5개 pending, apply 0.
- 격리 PostgreSQL backup/restore/rollback: pass.
- 임시 PostgreSQL listener: stopped.
- FINAL GATE v3 targeted security tests: 22/22 pass. exact 64KiB, 다중 chunk, malformed JSON, early disconnect, declared-small actual-oversize, missing/chunked length, unsupported compression, F를 우회한 main 직접 oversized 413를 포함합니다.
- main 직접 oversized fixture에서 body 사용과 signup dependency 호출이 모두 0임을 확인했습니다.

## 변경 파일

- `supabase/migrations/20260826034028_secure_owner_shop_memberships.sql`
- `supabase/migrations/20260826111854_lock_product_booking_defaults.sql`
- `supabase/rollback/20260826034028_secure_owner_shop_memberships.rollback.sql`
- `supabase/rollback/20260826111854_lock_product_booking_defaults.rollback.sql`
- `supabase/rollback/202608270001_atomic_owner_signup_draft.rollback.sql`
- `src/server/price-guide-photo-import.ts`
- `src/server/signup-json-body.ts`
- `src/app/api/auth/signup/route.ts`
- `src/lib/auth/atomic-signup-contract.ts`
- `src/app/api/auth/signup/price-guide-preview/route.ts`
- `docs/product/SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1.md`
- `scripts/verify-development-schema-and-atomic-signup-repair.cjs`
- `scripts/development-signup-repair-dry-run.ps1`
- `scripts/verify-development-signup-repair-postgres.ps1`
- `tests/sql/development-signup-repair-*.sql`
- `tests/server/price-guide-photo-import.test.mjs`
- `tests/server/signup-secure-p0-contract.test.mjs`
- `tests/server/atomic-signup-contract.test.mjs`
- `tests/server/signup-json-body.test.mjs`
- `tests/server/signup-main-boundary.test.mjs`

## Development 제한 적용 승인 경계

보안팀 FINAL GATE v3는 `적합 — 제한된 Development 적용 검증 진행 가능`으로 판정했습니다. 승인 범위는 **Development `qefxdtmdtvnzgupmjlom`에 위 전체 SHA-256 checksum의 pending 5개를 사전 backup/PITR 확인 후 적용하고 합성 계정·합성 이미지만으로 RLS/원자가입/rollback을 검증하는 것**에 한정됩니다. F gate는 기본 off를 유지하고 축약 checksum은 실행 근거로 사용하지 않습니다.

이번 작업에서는 migration push와 실제 적용을 실행하지 않았습니다. 계속 금지: 운영 데이터 사용, 실제 고객 이미지, Vision secret 연결/호출, Production 접근. 대표 제품 결정은 없습니다.

## F shared POST-only completion evidence

- Contract: `SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1`.
- Header: `x-petmanager-signup-contract-version`.
- F route는 main `POST /api/auth/signup`만 서버 간 전달하며 main 연결·gate 미준비 시 `503 ATOMIC_SIGNUP_MIGRATION_REQUIRED`로 fail-closed합니다.
- F route에서 `signUp|createUser|deleteUser|\.from\(` 검색 결과 0건. 기존 Auth/shop/profile 순차 fallback은 제거됐습니다.
- 최종 payload는 단일 operation ID인 `signupRequestId`, 검토 완료 `servicePrices`, `identityVerificationToken`을 함께 전송합니다.
- 동일 ID·동일 payload 재시도 유지, 다른 payload 409에서만 새 ID로 명시 재시도, 성공 전 로그인/완료 이동 금지.
- F fixture contract tests 10/10 pass, typecheck pass, build pass.
- 환경 변수 이름: `ATOMIC_OWNER_SIGNUP_ENABLED`, `PETMANAGER_MAIN_APP_ORIGIN`. 값과 실제 연결은 설정하지 않았습니다.
- Proxy request body: 64KiB Content-Length 선검사와 bounded stream. 누락·거짓·chunked도 같은 상한이며 초과는 413.
- Upstream: 8초 deadline, `AbortController`, client disconnect 취소. redirect, 5xx, 비 JSON, 초과 응답은 generic fail-closed입니다.
- Origin: Production 공식 HTTPS exact host만 허용하며 userinfo/path/query/임의 redirect를 허용하지 않습니다. Development의 `127.0.0.1:3000`은 명시 local fixture에서만 허용합니다.
- Contract header는 proxy가 고정하며 사용자 입력으로 override할 수 없습니다. main은 `SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1` exact-match만 body/PII parse 전에 수락하고 missing/wrong/case/duplicate/oversized는 426으로 차단합니다.
- main은 올바른 header 뒤에도 64KiB bounded JSON parser를 먼저 거치며, Content-Length 초과는 body pull 전 413, 누락·거짓·chunked 실제 초과는 stream 취소 후 413, gzip/br 등은 body pull 전 415로 fail-closed합니다. body·비밀번호·본인인증 token·서비스 값은 오류 응답과 로그에 포함하지 않습니다.
- Hardened F fixture tests 10/10, main FINAL GATE v3 targeted tests 22/22, 양쪽 typecheck/build pass.
- 변경 파일:
  - `D:\petmanager-app\src\app\api\auth\signup\route.ts`
  - `D:\petmanager-app\src\lib\auth\atomic-signup-proxy.ts`
  - `D:\petmanager-app\src\components\auth\signup-form.tsx`
  - `D:\petmanager-app\tests\atomic-signup-proxy-contract.test.mjs`

## 후속 큐 — 이번 변경에 미포함

- `PAYMENT_NOTIFICATION_P0_IMPLEMENTATION`: signup/schema P0 후 최우선 별도 변경.
- `ACCOUNT_DELETION_PURGE_IMPLEMENTATION`: 별도 migration/rollback 단위.
- `ACTIVATION_MEASUREMENT_LEDGER`: 위 P0 이후 사전 견적·영향·계약 테스트 제출부터 시작.
