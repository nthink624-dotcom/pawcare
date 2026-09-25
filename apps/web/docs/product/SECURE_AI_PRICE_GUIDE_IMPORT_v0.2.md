# SECURE_AI_PRICE_GUIDE_IMPORT v0.2

## 판정

- 보안팀이 지정한 세 P0 차단의 코드·migration 초안·테스트 대응은 완료했다.
- Development migration은 **적용하지 않았다**. 읽기 전용 대조와 `--include-all --dry-run`까지만 통과했다.
- 실제 Vision key가 없어 fixture만 검증했다. AI 판독 완료 또는 출시 가능으로 판정하지 않는다.
- Production 배포, Production DB/Storage, 운영 데이터, 실사용 사진은 건드리지 않았다.

## 1. migration 이력 불일치 대조

### 대상

- Development: `petmanager-dev` (`qefxdtmdtvnzgupmjlom`)
- 원격 기록: `20260826130954_marketing_work_ledger`
- Git 원본: commit `f1ffa09a303daa6867229f646b5320432330f4d1`, `supabase/migrations/20260826110517_marketing_work_ledger.sql`
- Git 원본 브랜치: `codex/realtime-agent-control-plane-poc`
- 현재 source-of-truth 복원 파일: `supabase/migrations/20260826130954_marketing_work_ledger.sql`

### 증거

- 원격 `supabase_migrations.schema_migrations.statements[1]` canonical 길이: `8849`
- Git 원본 canonical 길이: `8849`
- 현재 복원 파일 canonical 길이: `8849`
- 공백/줄바꿈 정규화 SHA-256, 세 위치 모두:
  `862d9e47e078e74cf2ca85f104ca97b53aa9340ed00ec0df5325ad45dd64d9d9`
- 객체 순서도 동일하다: 5개 `marketing_work_*` table → RLS/revoke → 4개 index → realtime publication → `ingest_marketing_work_event` RPC → function revoke/grant.
- 결론: 동일 SQL이 원격 도구 적용 시점 `13:09:54`로 기록되고, Git migration은 생성 시점 `11:05:17`을 사용해 생긴 timestamp 불일치다.
- 수행하지 않은 작업: `migration repair`, 원격 row 삭제, rename, `db push`, schema write.

### Development dry-run

일반 `db push --dry-run`은 원격 마지막 migration보다 앞선 로컬 미적용 2개가 있어 안전하게 중단됐다.

- `20260826034028_secure_owner_shop_memberships.sql`
- `20260826111854_lock_product_booking_defaults.sql`

저장소의 Development 검증 스크립트로 `--include-all --dry-run`을 실행했고 실제 적용 없이 다음 순서를 확인했다.

1. `20260826034028_secure_owner_shop_memberships.sql`
2. `20260826111854_lock_product_booking_defaults.sql`
3. `202608270001_atomic_owner_signup_draft.sql`
4. `20260827020524_secure_signup_ai_price_guide.sql`

CLI 결과: `dryRun: true`, 대상 검증: `petmanager-dev (qefxdtmdtvnzgupmjlom)`. Production 대상 명령은 실행하지 않았다.

## 2. pre-parse 업로드 hard limit

### 구현

- 새 모듈: `src/server/signup-price-guide-multipart.ts`
- multipart 전체 한도: `8MB 이미지 + 512KB envelope = 8.5MB`
- 실제 이미지 정책: 기존 8MB를 별도로 재검증한다.
- 유효한 `Content-Length`가 8.5MB를 넘으면 stream reader를 만들기 전에 413을 반환한다.
- header가 없거나 작게 위조되거나 chunked여도 `ReadableStream`을 chunk 단위로 합산하고 8.5MB를 넘는 즉시 cancel/413 한다.
- 전체 body deadline 15초를 적용하고 timeout 시 reader를 cancel하며 이미 받은 chunk를 zeroize 한다.
- bounded body가 완성된 뒤에만 `Response.formData()`를 호출한다. Route Handler에서 `request.formData()` 직접 호출은 제거했다.

### 테스트

- 큰 Content-Length의 body read 0회 및 413.
- Content-Length 없음/chunked 초과 요청은 세 번째 chunk를 읽기 전에 413.
- 거짓 Content-Length 초과 요청도 같은 bounded stream에서 413.
- slow upload는 deadline에서 408 및 stream cancel.
- truncated/MIME 위장/polyglot/초대형 dimension 기존 decoder 테스트 유지.
- 격리 Next 서버 실제 요청: Content-Length 초과 413, chunked 초과 413.

## 3. cache/hash purge 및 rollback

### lifecycle

- 명시 purge: `DELETE /api/auth/signup/price-guide-preview?reason=`.
- 허용 사유: `confirmed`, `cancelled`, `retake`, `manual`, `abandoned`.
- provider 실패/timeout은 POST catch 경로에서 서버가 직접 purge한다.
- UI는 새 촬영, 직접 입력, 이전, 확정 전에 purge 성공을 기다린다. 실패하면 다음 단계로 진행하지 않고 token을 유지해 재시도할 수 있다.
- `pagehide`에는 `keepalive` cleanup을 요청한다. 전송이 실패해도 DB TTL cleanup이 남는다.

### DB tombstone

- `purge_signup_price_guide_analysis_v1`은 즉시 `tombstoned`로 바꾸고 `ip_hash`, `session_hash`, `device_hash`, `file_hash`, `cache_source_jti`, `cache_ciphertext`, `cache_expires_at`을 null 처리한다.
- `cleanup_signup_price_guide_analysis_v1`은 각 claim 시작에 실행된다.
- cache TTL 5분, processing TTL 2분, 절대 trace TTL 24시간, 비식별 tombstone 삭제 대기 1시간이다.
- cleanup/purge RPC 오류는 일반 성공으로 숨기지 않고 `PURGE_FAILED` 503 + `Retry-After: 15`로 fail-closed 한다.
- fixture도 purge 뒤 같은 일회성 token을 재사용할 수 없다.

### rollback

- 파일: `supabase/rollback/20260827020524_secure_signup_ai_price_guide.rollback.sql`
- active `claimed/auth_created` signup이 있으면 rollback을 중단한다.
- v0.2 RPC의 PUBLIC/anon/authenticated/service_role 권한을 revoke한 뒤 함수를 drop한다.
- analysis table drop으로 encrypted cache, hash dedupe, rate state, token trace, tombstone을 함께 제거한다.
- signup status constraint를 v1 상태 집합으로 복원한다.
- 이 rollback은 검토용이며 Development에도 실행하지 않았다.

## 검증 결과

- P0 테스트: `24/24 PASS`
- TypeScript: `PASS`
- 대상 ESLint: `PASS`
- reliability regression: `86/86 PASS`
- media architecture: `PASS`
- Next production build: `PASS`
- 실제 격리 Route Handler: Content-Length 413, chunked 413, fixture confirm purge 200.
- 화면 증거: `artifacts/secure-ai-price-guide-import-v0.2/mobile-confirmed-after-purge.png`
- Development migration: `--include-all --dry-run PASS`, 실제 적용 0.

## 변경 파일

- `src/server/signup-price-guide-multipart.ts`
- `src/server/signup-price-guide-analysis-guard.ts`
- `src/app/api/auth/signup/price-guide-preview/route.ts`
- `src/components/auth/signup-service-pricing-step.tsx`
- `supabase/migrations/20260826130954_marketing_work_ledger.sql`
- `supabase/migrations/20260827020524_secure_signup_ai_price_guide.sql`
- `supabase/rollback/20260827020524_secure_signup_ai_price_guide.rollback.sql`
- `tests/server/signup-price-guide-security.test.mjs`
- `tests/server/signup-secure-p0-contract.test.mjs`
- `scripts/verify-secure-price-guide-p0-v02.cjs`
- `D:/petmanager-shared/docs/data-contracts.md`

## 잔여 차단

1. 보안팀 재검수 전 Development 실제 migration 적용 금지.
2. 실제 Development Vision secret 부재. fixture는 외부 Vision 호출이 아니며 화면에 이를 표시한다.
3. 보안팀 승인 뒤에만 Development migration 적용 및 실제 Vision E2E 1건을 수행한다.
4. Production은 별도 승인·별도 migration 검수 전 계속 금지한다.

## commit / rollback 상태

- commit/PR 없음. 공유 dirty worktree의 기존 변경을 섞지 않았다.
- 실제 DB 변경이 없으므로 현재 DB rollback은 필요 없다.
- 코드 rollback은 위 변경 파일만 선택적으로 되돌린다.
