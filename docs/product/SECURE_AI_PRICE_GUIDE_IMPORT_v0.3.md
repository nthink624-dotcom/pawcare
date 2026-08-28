# SECURE_AI_PRICE_GUIDE_IMPORT v0.3

작성일: 2026-08-27  
범위: 보안팀 v0.2 재검수에서 남은 `purge 후 rate limit·일일 비용 상한 우회` 차단만 수정  
상태: **보안팀 독립 재검수 `적합` / Development 적용 전 코드·격리 PostgreSQL 보안 게이트 통과**  
주의: Production 출시 승인이 아니며 실제 Development schema·Vision E2E는 아직 미검증

## 1. 결론

분석 요청 행과 보안 계량 원장을 분리했다.

- 원본 이미지, 재인코딩 buffer, AI 원시 응답, 암호화 cache, file hash, IP/session/device binding hash는 기존처럼 즉시 purge한다.
- purge와 무관하게 유지돼야 하는 요청 횟수와 provider 비용은 `signup_price_guide_security_meter_buckets`에 별도 보관한다.
- 계량 원장에는 원문 IP/session/device, static binding hash, token JTI, file hash, 이미지, AI 응답, 고객정보를 저장하지 않는다.
- 새 토큰을 반복 발급하고 매번 purge해도 같은 기간의 6/8/10회 제한과 UTC 일일 비용 상한을 우회할 수 없다.
- Production, 운영 데이터, 실제 Vision 호출, Development migration 적용은 수행하지 않았다.

## 2. 저장 데이터 분리

| 구분 | 저장 위치 | 보관 | purge 동작 |
|---|---|---|---|
| 원본/재인코딩 이미지 buffer | 요청 메모리 | 요청 중에만 | `finally`에서 zeroize |
| AI 원시 응답 | 저장 금지 | 0 | 저장하지 않음 |
| cache·file hash·binding hash | `signup_price_guide_analysis_requests` | 최대 요청/짧은 cache TTL | confirm/cancel/retake/manual/abandon/failure/timeout/retention에서 즉시 null |
| IP 10분 요청 횟수 | security meter | 기간 종료 + 1시간 | 분석 purge 영향 없음 |
| session/device UTC 일일 요청 횟수 | security meter | UTC 일 종료 + 1시간 | 분석 purge 영향 없음 |
| provider UTC 일일 비용 | security meter | UTC 일 종료 + 35일 | 실제 비용은 purge로 감소하지 않음 |
| provider 5분 실패 수 | security meter | 기간 종료 + 1시간 | provider 실패/timeout 후 유지 |

분석 취소처럼 provider가 호출되지 않은 경로는 예약 비용만 해제한다. Provider 실패·timeout은 비용을 과소계상하지 않도록 예약 추정액을 실제 비용으로 보수적으로 확정한다.

## 3. 비식별 HMAC 회전 버킷

서버 전용 `SIGNUP_PRICE_GUIDE_METERING_SECRET`이 없으면 실제 분석 gate는 503 fail-closed다.

1. 토큰의 기존 static binding HMAC를 입력으로 사용한다.
2. `HMAC(secret, signup-price-meter-rotation:YYYY-MM)`로 월별 회전 key를 파생한다.
3. `kind + UTC period start + subject binding`을 다시 HMAC-SHA256한다.
4. DB에는 최종 64자리 meter HMAC와 `rotation_id=YYYY-MM`만 전달한다.

월 경계는 UTC 일 경계와 일치하므로 session/device/provider 일일 bucket이 이전 회전 key와 섞이지 않는다. IP 10분 및 circuit 5분 bucket도 UTC epoch 기준 고정 구간이다.

## 4. PostgreSQL 원자성

`claim_signup_price_guide_analysis_v2`는 다음 meter key를 정렬한 뒤 transaction advisory lock을 건다.

- IP 10분
- signup session UTC 일
- device UTC 일
- provider UTC 일
- provider circuit 5분

같은 bucket의 동시 요청은 하나씩 제한 확인과 증가를 수행한다. 허용된 요청만 request count를 증가시키며, 비용은 claim 시 `reserved_cost_microusd`, 완료 시 `actual_cost_microusd`로 원자 이동한다.

제한값:

- IP: 10회 / 10분 bucket
- signup session: 6회 / UTC 일
- device: 8회 / UTC 일
- provider: `reserved + actual + 신규 예약 <= SIGNUP_PRICE_GUIDE_MAX_DAILY_COST_MICRO_USD`
- circuit: provider failure 5회 / 5분 bucket

v0.2의 `claim...v1`, `purge...v1`, `cleanup...v1` service-role 경로는 제거했다. v1을 통한 우회는 허용하지 않는다.

## 5. purge·cleanup

`purge_signup_price_guide_analysis_v2`:

- 분석 행을 lock한다.
- 미사용 provider 비용 예약을 해제하거나 provider 실패 비용을 실제 비용으로 확정한다.
- provider 실패면 circuit meter를 증가시킨다.
- 분석 행의 binding/file/cache/meter reference를 모두 null 처리하고 tombstone으로 만든다.
- security meter의 request count와 actual provider cost는 수정·삭제하지 않는다.

`cleanup_signup_price_guide_analysis_v2`는 expired cache, 2분 이상 processing, failed, 24시간 retention 만료를 같은 purge v2 경로로 처리한다. `cleanup_signup_price_guide_security_meter_v1`은 각 meter의 `expires_at`이 지난 행만 batch 삭제한다.

## 6. RLS·권한

- `signup_price_guide_security_meter_buckets`: RLS enabled.
- table 권한: `public`, `anon`, `authenticated` 전부 revoke.
- RPC 권한: `public`, `anon`, `authenticated` 전부 revoke.
- table 접근과 v2/cleanup RPC execute는 `service_role`만 grant.
- 모든 privileged RPC는 `SECURITY DEFINER`, `search_path=''`, schema-qualified object를 사용한다.

## 7. 실제 PostgreSQL 동시성 검증

실행:

```powershell
scripts\verify-signup-price-guide-metering-postgres.ps1
```

환경:

- 로컬 PostgreSQL 18.4 임시 cluster.
- 각 시나리오 `pgbench -c 20 -j 4 -t 1`.
- 테스트 후 rollback 적용 및 임시 cluster 종료·삭제.
- Development/Production 연결 없음.

결과:

| 시나리오 | 허용 | 차단 | 기대 |
|---|---:|---:|---:|
| purge → 새 token 20회, 같은 session | 6 | 14 | 6회 제한 |
| purge → 새 token 20회, 같은 device | 8 | 12 | 8회 제한 |
| purge → 새 token 20회, 같은 IP | 10 | 10 | 10회 제한 |
| 완료·purge 반복, 400µUSD × 20 / cap 1,000 | 2 | 18 | actual 800 유지 |

추가 검증:

- 모든 pgbench transaction 80/80 처리, failed transaction 0.
- tombstoned 분석 행의 binding/file/cache/meter reference 잔존 0.
- purge 후 security meter 존재 확인.
- expired meter cleanup 확인.
- rollback 후 meter table/RPC/analysis row 잔존 0.
- rollback 후 insecure v1 claim 복원 0.
- 최종 표식: `POSTGRES_METERING_P0_V03_PASS`.

재현 SQL:

- `tests/sql/signup-price-guide-metering-fixture.sql`
- `tests/sql/signup-price-guide-metering-attack-functions.sql`
- `tests/sql/signup-price-guide-metering-pgbench.sql`
- `tests/sql/signup-price-guide-metering-assertions.sql`
- `tests/sql/signup-price-guide-metering-rollback-assertions.sql`

## 8. Migration·rollback

Migration:

- `supabase/migrations/20260827031414_secure_signup_ai_price_guide_metering.sql`

Rollback:

- `supabase/rollback/20260827031414_secure_signup_ai_price_guide_metering.rollback.sql`
- processing 분석이 있으면 rollback을 차단한다.
- 남은 분석 artifact를 purge하고 분석 행·meter table·v2 RPC를 제거한다.
- v1 gate는 복원하지 않아 rollback 후 분석 API가 fail-closed 상태가 된다.

Development target 확인:

- project: `petmanager-dev`
- ref: `qefxdtmdtvnzgupmjlom`
- `npm run supabase:db:reconcile:dev:dry-run`: PASS.
- 예정 migration 목록에 `20260827031414_secure_signup_ai_price_guide_metering.sql` 포함.
- 실제 migration 적용: 0.

## 9. 코드·테스트 검증

- 보안 단위/계약 테스트: 23/23 PASS.
- v0.3 추가 unit: HMAC 월 회전, purge→새 token 20회, 비용 유지, completion v2 RPC.
- TypeScript typecheck: PASS.
- 대상 ESLint: PASS.
- 로컬 PostgreSQL concurrency/cleanup/rollback: PASS.

## 10. 변경 파일

- `src/server/signup-price-guide-analysis-guard.ts`
- `src/app/api/auth/signup/price-guide-preview/route.ts`
- `src/lib/server-env.ts`
- `supabase/migrations/20260827031414_secure_signup_ai_price_guide_metering.sql`
- `supabase/rollback/20260827031414_secure_signup_ai_price_guide_metering.rollback.sql`
- `scripts/verify-signup-price-guide-metering-postgres.ps1`
- `tests/server/signup-price-guide-security.test.mjs`
- `tests/server/signup-secure-p0-contract.test.mjs`
- `tests/sql/signup-price-guide-metering-*.sql`
- `D:\petmanager-shared\docs\data-contracts.md`

## 11. 보안팀 독립 재검수

판정: **적합**

- 보안팀이 migration, runtime, 23개 보안·계약 테스트와 임시 PostgreSQL 80개 동시 transaction을 독립 재현했다.
- purge 후 meter 보존, 비용 800µUSD 유지, RLS/revoke/grant, v1 제거, cleanup, rollback을 확인했다.
- 코드·Development/Production DB·Vision·운영 데이터 변경 없이 검수했다.

## 12. 남은 출시 차단

1. 승인된 Development migration 적용 및 실제 DB RLS/RPC 확인.
2. 실제 Development Vision secret 연결 후 비식별 합성 이미지 E2E 1건.
3. Vision 성공/timeout → purge → meter 보존 → rollback drill 통합 검증.

실제 Vision secret은 현재 없으며 fixture를 실제 AI 판독으로 주장하지 않는다. Production 배포·운영 DB/Storage·실사용 사진은 별도 승인 전 금지한다.
