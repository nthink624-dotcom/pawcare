# DEVELOPMENT_AI_PRICE_GUIDE_E2E_PREFLIGHT v0.1

작성일: 2026-08-27  
표준 업무명: **회원가입 중 서비스·가격 최초 등록**  
수행 범위: Development 원격 상태·migration dry-run·환경 변수 존재 여부·비식별 fixture·실행/복구 계약의 읽기 전용 점검  
수행하지 않음: migration apply, Vision 호출, 회원 생성, 실제 매장/고객 사진 사용, Production 접근·변경

## 0. 실행 판정

**현재 Development migration + Vision E2E 실행은 차단한다.**

선행 차단:

1. 원격 migration 이력에는 `202605190005_multi_shop_foundation`이 적용됐지만, 그 migration이 만든 `public.owner_shop_memberships`가 Development catalog에 없다. 첫 pending migration의 `REVOKE ... ON TABLE public.owner_shop_memberships`가 실패하므로 source-of-truth drift를 먼저 복구해야 한다.
2. Vision provider secret `OPENAI_API_KEY`가 로컬 Development process, `.env.local`, canonical shared env 모두에 없다. 실제 provider 호출 권한은 **부재** 상태다.
3. `SIGNUP_PRICE_GUIDE_METERING_SECRET`도 부재해 실제 분석 gate가 fail-closed다. 토큰·cache secret은 기존 `AUTH_FLOW_SECRET` fallback이 있으나, meter secret은 별도 값이 필요하다.
4. 코드의 요청당 예약/기록 비용은 `$0.0012`인데, 현재 모델·이미지·출력 상한을 보수적으로 계산한 요청당 최대 예산은 약 `$0.013`이다. 실제 사용량 계측 또는 보수적 예약액 상향 전에는 일일 비용 상한이 실제 비용을 충분히 막지 못한다.
5. pending 5개 중 rollback 파일은 마지막 2개에만 있다. 첫 3개와 `shops` 값 변경을 복원할 검토된 recovery가 준비되기 전에는 apply하지 않는다.

## 1. 대상 Development와 pending migration

- Supabase project: `petmanager-dev`
- project ref: `qefxdtmdtvnzgupmjlom`
- region: `ap-southeast-2`
- PostgreSQL: `17.6.1.105`
- CLI link: Development ref와 일치
- Production ref `ysxykikqnneuhypybjry`: 명령 대상 아님
- CLI: `2.116.0`
- 확인 명령: `npm run supabase:db:reconcile:dev:dry-run`
- 결과: `dryRun: true`, 실제 적용 0

`db push --linked --include-all --dry-run`이 반환한 정확한 순서와 raw file SHA-256:

| 순서 | migration | SHA-256 |
|---:|---|---|
| 1 | `20260826034028_secure_owner_shop_memberships.sql` | `73487a0ff426a050e0124952f8efff3c336fa07966ebcddbd2b0c1cc6f1eef07` |
| 2 | `20260826111854_lock_product_booking_defaults.sql` | `b5d8759869a8a63d99ea2e297fd7898320a72f9487bf7aa79a51795123f943c4` |
| 3 | `202608270001_atomic_owner_signup_draft.sql` | `e0393ed60397778fc80c772d5fbc0e2451ebbedc1b7856f1e636bf38c2c0f22e` |
| 4 | `20260827020524_secure_signup_ai_price_guide.sql` | `5f8c4e0f600e41c2d84effd387ea53549a562e7fa561b87855b30cfa6fdcaa14` |
| 5 | `20260827031414_secure_signup_ai_price_guide_metering.sql` | `ef83c86f924439ff38725664cfe1dc6d6ee00d50d28cbc737236deb5de64bb93` |

원격에는 이 5개가 모두 미적용이다. `20260826130954_marketing_work_ledger`는 이미 적용돼 있어 `--include-all`이 필요하다. Supabase migration history는 version/name/statements를 저장하지만 로컬 파일 checksum을 원격 row와 함께 관리하지 않으므로, 위 checksum은 실행 직전 다시 계산하고 이 문서 값과 비교한다.

### 발견된 기존 schema drift

- 원격 history `202605190005_multi_shop_foundation`: 적용 기록 있음.
- 원격 기록 속 statement: `owner_shop_memberships` 생성 구문 포함.
- 현재 Development catalog: `public.owner_shop_memberships` 없음.
- 저장소 migration에서 이후 해당 테이블을 drop하는 migration: 없음.
- 결론: migration history와 실제 schema가 불일치한다. 임의 `migration repair`, history row 변경, Production 복사는 금지한다.

## 2. RLS·grant·revoke 영향

| migration | RLS/권한 영향 | 데이터·기타 영향 |
|---|---|---|
| `20260826034028` | `owner_shop_memberships` RLS 활성화, `anon`·`authenticated` table 권한 전부 revoke | 현재 대상 table이 없어 apply 실패 예상 |
| `20260826111854` | 없음 | 모든 `shops`의 예약 기본값을 자동확정·동시 1건·15분 간격·2시간 변경/취소 기준으로 갱신하고 column default 고정 |
| `202608270001` | `signup_idempotency_requests` RLS 활성화; `PUBLIC`·`anon`·`authenticated` revoke; `service_role` select/insert/update grant. `complete_owner_signup_v1` execute는 `service_role`만 grant | 계정·매장·서비스·기본 직원 원자 저장 초안 추가 |
| `20260827020524` | 분석 요청 table RLS 활성화; 브라우저 역할 revoke; `service_role` DML grant. owner signup v2·분석 v1 RPC를 브라우저 역할에서 revoke하고 `service_role`에만 execute grant | KCP consume·Credit 포함 가입 상태 머신, 임시 분석/cache·purge v1 추가 |
| `20260827031414` | security meter table RLS 활성화; 브라우저 역할 revoke; `service_role` DML grant. v1 RPC의 `service_role` 권한까지 revoke 후 drop; v2/cleanup RPC는 `service_role`만 execute | purge와 분리된 비식별 rate/cost meter, 동시성 lock, TTL cleanup 추가 |

모든 privileged 신규 RPC는 `SECURITY DEFINER`와 빈 `search_path`를 사용한다. apply 후에는 table RLS 여부뿐 아니라 함수별 `anon/authenticated=false`, `service_role=true`를 catalog query로 다시 검증한다.

## 3. Vision provider 준비 상태

| 항목 | 상태 |
|---|---|
| provider | OpenAI Responses API (`POST /v1/responses`) |
| provider secret | `OPENAI_API_KEY`: **부재** |
| model | `OPENAI_VISION_MODEL`, 미설정 시 `gpt-4o-mini` |
| model capability | image input + text output + Structured Outputs 지원 |
| 요청 이미지 | 회원가입 route 기준 1장 |
| 업로드 입력 | JPEG/PNG/WebP, 실제 이미지 최대 8 MiB |
| decoder 한도 | 최대 8,000×8,000, 40MP, 1 frame, 12초 |
| provider 전송 전 결과 | EXIF/GPS 제거 JPEG, 최대 3,200px, 최대 6 MiB |
| provider timeout | 20초 |
| 출력 상한 | 8,000 tokens |
| 코드상 예약/기록 비용 | `$0.0012`/call |
| 보수적 최대 예산 | 약 `$0.013`/call |

비용 근거:

- `gpt-4o-mini`: input `$0.15`/1M tokens, output `$0.60`/1M tokens.
- `detail: high`: base 2,833 + tile당 5,667 tokens.
- 현재 3,200px 전처리 범위의 극단 종횡비에서 최대 8 tiles로 약 48,169 image input tokens, 약 `$0.00723`.
- 출력 8,000 tokens 상한은 `$0.0048`; prompt·JSON schema input 여유를 합쳐 요청당 `$0.013`을 실행 예산 상한으로 잡는다.
- 실제 provider usage를 읽어 meter에 기록하거나 예약액을 이 상한 이상으로 조정하기 전에는 비용 gate를 합격으로 보지 않는다.

참고:

- OpenAI model: `https://developers.openai.com/api/docs/models/gpt-4o-mini`
- OpenAI image token rules: `https://developers.openai.com/api/docs/guides/images-vision`

## 4. 비식별 fixture와 E2E 성공 기준

Fixture:

- 파일: `D:\petmanager\artifacts\secure-ai-price-guide-import-v0.1\korean-price-guide-fixture.png`
- 크기: `760×1040`, `47,689 bytes`
- SHA-256: `9f47a16ca1f09dcbdab3da5fcfb30e9657c6944cfd228917b8f75b53c8d90af4`
- 합성 매장명·합성 요금만 포함. 인물, 전화번호, 주소, 고객, 실제 매장 식별자 없음.

성공 기준:

1. `source=vision`으로 반환되고 fixture/mock/cache로 표시되지 않는다.
2. 최소 `전체 미용 80,000원`, `목욕 35,000원`, `부분 미용 30,000원`의 서비스명·가격이 구조화된다. 읽힌 소요시간은 각각 120/60/45분과 비교하고 불일치는 사용자가 수정할 수 있어야 한다.
3. 사용자가 행 단위 수정·삭제·추가 후 `이 내용으로 등록`을 누른다.
4. 확인 전에는 canonical `services` 저장 0, 원본·재인코딩 이미지·AI 원시 응답 영구 저장 0이다.
5. 최종 가입 성공 transaction에서 synthetic 계정·매장·확정 서비스만 함께 저장된다.
6. 동일 idempotency key 재시도는 중복 매장/서비스를 만들지 않는다.
7. 재로그인·서비스 화면 재진입 시 canonical 서비스·가격이 동일하게 보인다.
8. confirm purge 후 analysis row에는 binding/file/cache/meter reference가 남지 않고, 비식별 rate/cost meter만 정책 TTL까지 유지된다.

실패·fallback 기준:

- provider 4xx/5xx, schema parse 실패, 가격 행 0건: 성공으로 표시하지 않고 같은 화면의 `직접 입력` 제공.
- 20초 timeout: provider timeout으로 purge·meter 처리 후 원본 buffer zeroize, 직접 입력 제공.
- secret 부재/권한 불충분: `VISION_UNAVAILABLE` 또는 provider 오류로 명확히 실패하고 fixture를 실제 AI처럼 표시하지 않음.
- manual fallback: 사진 초안을 canonical DB에 저장하지 않고, 사용자가 직접 입력한 확정 구조화 행만 최종 가입 요청에 포함.
- 중간 실패: synthetic Auth 사용자가 생성됐다면 상태 머신의 compensation이 완료돼 고아 매장·서비스 0이어야 함.

## 5. apply 전 backup·rollback·recovery 패킷

### 5.1 실행 전 무조건 재검증

```powershell
node scripts/verify-supabase-cli-target.cjs --target dev
npx.cmd supabase migration list --linked
npm.cmd run supabase:db:reconcile:dev:dry-run
```

다음 조건 중 하나라도 실패하면 중단한다.

- link/ref/name이 `petmanager-dev (qefxdtmdtvnzgupmjlom)`와 다름.
- pending 순서 또는 checksum이 이 문서와 다름.
- `owner_shop_memberships` drift 미해결.
- Development에 실제 고객/실매장 데이터가 존재함.
- provider·meter secret 부재.
- 요청당 비용 meter 상한 불일치 미해결.

### 5.2 backup 명령 초안 — 지금 실행하지 않음

Development가 비식별 seed/demo 데이터만 가진 것으로 별도 확인된 뒤에만 실행한다. dump 파일은 secret manager가 관리하는 암호화 작업 디렉터리에 저장하고 로그/Notion/채팅에 내용을 출력하지 않는다.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $env:PETMANAGER_SECURE_BACKUP_ROOT "signup-price-guide-$stamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null
node scripts/verify-supabase-cli-target.cjs --target dev
npx.cmd supabase db dump --linked --schema public,auth --file (Join-Path $backupDir 'schema.sql')
npx.cmd supabase db dump --linked --data-only --use-copy --schema public --file (Join-Path $backupDir 'data.sql')
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $backupDir 'schema.sql'),(Join-Path $backupDir 'data.sql')
```

`PETMANAGER_SECURE_BACKUP_ROOT`는 repo·동기화 폴더 밖의 접근 제한 경로여야 한다. 실제 고객/실매장 데이터가 발견되면 위 logical data dump를 실행하지 않고, Supabase managed backup/PITR 가용성을 확인한 뒤 별도 승인으로 recovery 방식을 바꾼다.

### 5.3 rollback 순서 — 지금 실행하지 않음

부분 apply 뒤 rollback은 역순이다.

1. `20260827031414_secure_signup_ai_price_guide_metering.rollback.sql`
2. `20260827020524_secure_signup_ai_price_guide.rollback.sql`
3. `202608270001`, `20260826111854`, `20260826034028`은 전용 rollback 파일이 없으므로 현재 부분 rollback 금지.

마지막 두 rollback은 active analysis/signup이 있으면 fail-closed로 중단한다.

```powershell
node scripts/verify-supabase-cli-target.cjs --target dev
psql.exe $env:PETMANAGER_DEV_DB_URL -v ON_ERROR_STOP=1 -f supabase/rollback/20260827031414_secure_signup_ai_price_guide_metering.rollback.sql
psql.exe $env:PETMANAGER_DEV_DB_URL -v ON_ERROR_STOP=1 -f supabase/rollback/20260827020524_secure_signup_ai_price_guide.rollback.sql
```

`PETMANAGER_DEV_DB_URL`은 Development 전용 단기 자격정보로 process에만 주입하고 출력하지 않는다. 첫 3개 migration까지 적용됐다면 검토된 전용 rollback을 먼저 작성하거나 pre-apply managed/logical backup 전체 restore로 복구한다. `db reset --linked`, `migration repair`, remote history row 수동 변경은 이 패킷에서 금지한다.

### 5.4 apply 후 검증 query — 지금 실행하지 않음

```sql
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('owner_shop_memberships','signup_idempotency_requests','signup_price_guide_analysis_requests','signup_price_guide_security_meter_buckets');

select p.proname, p.prosecdef,
       has_function_privilege('anon',p.oid,'execute') as anon_execute,
       has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'execute') as service_role_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('claim_owner_signup_v2','mark_owner_signup_auth_created_v2','complete_owner_signup_v2','claim_signup_price_guide_analysis_v2','complete_signup_price_guide_analysis_v2','purge_signup_price_guide_analysis_v2','cleanup_signup_price_guide_analysis_v2','cleanup_signup_price_guide_security_meter_v1');
```

합격값: 대상 4 table RLS `true`; 모든 대상 RPC `anon_execute=false`, `authenticated_execute=false`, `service_role_execute=true`. 이어서 synthetic signup request ID로 계정·매장·서비스 원자 저장/중복 0/고아 0과 분석 artifact purge를 검증한다.

## 6. 다음 실행 순서

1. `owner_shop_memberships` history/schema drift의 원인을 읽기 전용으로 확정하고 reviewed reconciliation migration을 만든다.
2. 첫 3개 pending migration의 rollback 또는 managed backup restore runbook을 완성한다.
3. 비용 meter를 실제 provider usage 또는 `$0.013` 이상 보수적 예약액에 맞춘다.
4. Development secret manager에 `OPENAI_API_KEY`와 `SIGNUP_PRICE_GUIDE_METERING_SECRET`을 최소 권한으로 연결한다. 값은 채팅·문서·로그에 남기지 않는다.
5. 전체 checksum/dry-run 재검증 뒤 별도 승인으로 Development migration apply.
6. 이 문서의 합성 fixture 1장으로 Vision 외부 호출 1회와 가입 E2E를 실행한다.
7. RLS/RPC, purge, meter, 재진입, rollback/recovery를 확인하고 synthetic 계정을 정리한다.

## 7. 대표 결정

**대표 결정 필요 — 현재 자격정보에는 Vision secret이 없으므로, Development secret manager에 `OPENAI_API_KEY`와 `SIGNUP_PRICE_GUIDE_METERING_SECRET`을 연결하고 비식별 fixture로 외부 Vision 1회(보수적 최대 약 `$0.013`)를 호출하는 비용·외부 전송 승인이 있어야 다음 E2E를 실행할 수 있다.**

이 승인은 Development 한정이다. Production, 실제 고객 사진, 실제 매장 데이터, 운영 DB/Storage에는 효력이 없다.
