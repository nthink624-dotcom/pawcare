# REUSED_PHONE_SINGLE_TRIAL_SIGNUP v0.1

## 판정

로컬 구현 및 격리 PostgreSQL 검증 완료. Development/Production 미적용이며 가입 보안 gate는 닫힌 상태다.

## 실제 중복 오류 원인

- main `POST /api/auth/signup`이 이메일 검사 후 CI/DI, 그리고 `이름+생년월일+전화번호`로 기존 `owner_profiles`를 검색해 409 generic duplicate를 반환했다.
- DB `complete_owner_signup_v1`도 CI/DI 중복을 거부했고 `owner_profiles_ci_hash_unique`, `owner_profiles_di_hash_unique`가 같은 본인확인 신원의 두 번째 가입을 막았다.
- 모든 Auth metadata가 가입 전부터 14일 trial로 고정되어 번호별 1회 판정이 없었다.

## 변경 계약

- `010-1234-5678`, `01012345678`, `+82 10-1234-5678`은 서버에서 `01012345678`로 정규화된다.
- 서버 전용 `owner-trial-phone:v1` HMAC identity만 unique ledger에 저장한다. 원문 휴대폰·이메일·user/shop ID·CI/DI는 ledger, receipt, error에 저장하지 않는다.
- CI/DI unique index를 non-unique lookup index로 교체한다. 이메일/Auth uniqueness와 KCP token consume은 유지한다.
- `complete_owner_signup_v4`에서 계정 DB 원장, 서비스·가격, current+previous HMAC alias 체험 claim, `single_monthly_v1` / `2026-08-v1` / 월 29,000원 KRW price snapshot, idempotency 결과를 한 transaction으로 저장한다. legacy `monthly` 19,000원·크레딧형 상품은 역사 조회용으로만 유지한다.
- 첫 claim은 14일 trial, 후속 claim은 0일/`expired`/결제 필요다. Auth metadata는 trial을 선결정하지 않는다.
- 가입 RPC는 알림톡 credit balance/event를 생성하거나 reset하지 않는다. 발송 가능 여부는 활성 subscription entitlement 계약을 따른다.
- 추가 발송 이용권 신규 판매는 API 410, 구매 CTA 0, client 결제 SDK 호출 0으로 fail-closed한다. PortOne webhook은 `2026-08-27 00:00 KST` 이전 PAID 역사 결제만 기존 이용권 원장에 reconcile할 수 있다.
- `owner_subscriptions`는 current/featured/auto-renew 중 하나라도 신규 code이면 exact version/price/currency snapshot을 요구한다. `owner_payment_ledger`도 같은 snapshot columns/CHECK를 가지며 한 번 기록된 snapshot 변경은 trigger가 차단한다.
- 탈퇴 시 계정과 연결되지 않은 비식별 claim receipt를 남긴다. 법률·개인정보 lifecycle 검수 없이 보존기간이나 삭제 정책을 임의 변경하지 않는다.
- HMAC rotation은 current+모든 lookup-required previous alias를 원자 판정한다. 새 alias coverage가 모든 claim에 채워지고 retirement status가 missing 0일 때만 별도 migration으로 이전 key를 retire한다.

## Backfill

`backfill_owner_trial_identity_claim_v2`는 raw phone을 받지 않는다. 승인된 서버 job이 기존 성공 가입을 canonical phone별로 묶고 가장 이른 성공 시각을 선택한 뒤 current+previous HMAC aliases, operation UUID, 시각만 전달한다. 기존 subscription/payment/trial rows는 수정하지 않는다.

## Rollback

`supabase/rollback/20260827064926_reused_phone_single_trial_signup.rollback.sql`은 claim이 한 건이라도 있거나 중복 CI/DI, `single_monthly_v1` subscription/payment가 존재하면 중단한다. anti-abuse receipt나 신규 상품 이력을 지우는 파괴적 rollback은 제공하지 않는다.

## 검증

- Node contract/HMAC/product/cutover contract 포함 표적 suite: 15/15 PASS.
- PostgreSQL 18 isolated: 같은 HMAC 전화번호로 20개 동시 가입 모두 성공, trial winner 1, 후속 19건 0일/결제 필요. v1 claim에 v2 current+v1 previous를 제시한 가입은 winner 0이고 두 alias가 같은 claim에 연결됨.
- 신규 가입 subscription 20건과 rotation fixture 모두 `single_monthly_v1` / `2026-08-v1` / `29000 KRW` snapshot 일치. 갱신·재결제 서버는 snapshot 불일치 또는 결제 응답 금액 불일치를 409로 중단한다.
- 신규 결제 선택 UI는 단일 29,000원 상품만 노출하며, legacy 상품 코드는 기존 subscription 해석을 위해 catalog에 숨김 상태로 보존한다.
- 추가 이용권 registered-card/confirm API는 인증·body parse 이전 410, CTA 0, 새 PortOne client initiation 0. cutoff 이후 webhook grant 0이며 과거 PAID 결제만 내부 historical flag로 reconcile한다.
- SQL fixture는 featured-only 신규 code의 snapshot 누락, payment snapshot 누락, payment snapshot mutation을 모두 차단한다.
- 실패 주입: transaction 실패 후 claim 0, 동일 요청 재시도 14일 획득.
- idempotency: 완료 요청 재시도 결과 불변.
- signup credit balance/event 0, authenticated direct ledger read/claim 거부, rollback clean fixture PASS.
- backfill은 더 늦은 성공 후 더 이른 성공 입력 시 earliest receipt로 교정됨.

## 미적용 경계

Development/Production DB, 실제 사용자, 외부 KCP/결제/Vision 호출은 모두 0이다. 기존 pending migration/backup gate 및 보안팀 재검수 전에는 Development 적용 또는 F gate 활성화를 금지한다.
