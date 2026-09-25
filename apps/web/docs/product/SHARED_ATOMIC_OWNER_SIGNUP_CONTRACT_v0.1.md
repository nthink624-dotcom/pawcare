# Shared Atomic Owner Signup Contract v0.1

표준 업무명은 `회원가입 중 서비스·가격 최초 등록`입니다. 가입 첫 단계에서 서비스명과 가격을 입력하고, 가입 완료 시 매장 계정에 저장합니다.

## 단일 서버 경계

- PC와 모바일은 모두 PetManager main 서버의 `POST /api/auth/signup`만 호출합니다.
- 모든 caller는 `x-petmanager-signup-contract-version: SHARED_ATOMIC_OWNER_SIGNUP_CONTRACT_v0.1`을 exact-match로 전송합니다. missing, unknown, case mismatch, duplicate/comma-joined, 128자를 넘는 값은 main이 body·PII parse와 Auth/provider 호출 전에 HTTP 426 `SIGNUP_CONTRACT_VERSION_UNSUPPORTED`로 거부합니다.
- main은 header 검사 직후 JSON request body를 64KiB로 제한합니다. 큰 Content-Length는 stream pull 전에 413으로 거부하고, 길이가 없거나 거짓이거나 chunked여도 bounded stream 누적값이 상한을 넘으면 즉시 취소합니다. `request.json()` 무제한 경로는 허용하지 않습니다.
- 압축 JSON은 허용하지 않습니다. `Content-Encoding`이 없거나 `identity`인 요청만 받고 gzip/br 등은 body pull 전에 415로 차단해 압축 해제 폭탄 경로를 만들지 않습니다. contract-version header는 호환성 검사일 뿐 인증이나 DoS 방어 수단이 아닙니다.
- 모바일에서 Supabase Auth, `shops`, `owner_profiles`, `owner_shop_memberships`, `services`, `staff_members`를 순차 또는 직접 쓰기 금지합니다.
- 모바일이 별도 원자 가입 로직이나 별도 서비스·가격 원장을 만들지 않습니다.
- 사진 원본과 AI 원시 응답은 이 요청에 포함하지 않습니다. 오너가 검토 완료한 `servicePrices` 구조화 행만 포함합니다.

## 요청

필수 필드는 `signupRequestId`, `email`, `password`, `passwordConfirm`, `name`, `birthDate`, `phoneNumber`, `identityVerificationToken`, `shopName`, `shopPhone`, `shopAddress`, `agreements`, `servicePrices`입니다.

`servicePrices` 각 행은 `id`, `name`, `detailName`, `price`, `durationMinutes`, `species`, `breedGroup`, `weightBand`를 사용합니다. 최소 1행, 최대 80행이며 서버가 Zod로 다시 검증하고 중복 행을 정규화합니다.

## 상태 머신과 원자성

1. `claim_owner_signup_v4(signupRequestId, payloadHash)`가 최초 요청을 `claimed`로 고정하고, 완료된 재시도에는 저장된 체험 판정을 그대로 반환합니다.
2. 동일 key·동일 payload의 완료 요청은 기존 결과를 반환합니다. 동일 key·다른 payload는 HTTP 409 `SIGNUP_PAYLOAD_MISMATCH`입니다.
3. KCP 검증 결과를 서버가 조회한 뒤 Supabase Auth 사용자를 생성하고 `mark_owner_signup_auth_created_v2`로 `auth_created`를 기록합니다.
4. `complete_owner_signup_v4` 한 PostgreSQL transaction 안에서 KCP token consume, shop, owner profile, primary membership, canonical service/price, owner staff, 무료 체험 claim, canonical `owner_subscriptions`, idempotency completion을 처리합니다. 가입 RPC는 알림톡 credit balance/event를 만들거나 reset하지 않습니다.
5. DB 단계가 실패하면 Auth 사용자를 보상 삭제합니다. 삭제 실패는 `compensation_pending`이며 가입 성공으로 표시하지 않습니다.

## 재사용 휴대폰과 무료 체험

- 서로 다른 정규화 이메일은 동일한 본인확인 휴대폰 번호로 각각 가입할 수 있습니다. 휴대폰, CI, DI 중복만으로 가입을 차단하지 않으며 이메일 고유성은 유지합니다.
- 서버는 본인확인 결과의 휴대폰을 canonical 국내 digits로 정규화한 뒤, 현재 및 lookup-required 이전 버전 secret 각각으로 purpose-scoped HMAC-SHA-256 alias를 생성합니다. 클라이언트는 `trialEligible`, `trialDays`를 보내거나 결정하지 않습니다.
- `owner_trial_identity_claims`에는 최소 claim receipt만, `owner_trial_identity_aliases`에는 HMAC alias와 version만 저장합니다. raw phone, email, user/shop ID, CI/DI는 저장하지 않습니다.
- DB key policy의 current version과 모든 lookup-required previous version이 요청에 없으면 fail-closed입니다. 모든 alias를 정렬해 transaction advisory lock한 뒤 하나의 claim에 연결하므로 v1 claim 이후 v2 current+v1 previous 판정은 체험 winner 0입니다.
- key rotation은 새 version을 current로 지정하되 이전 version을 lookup-required로 유지합니다. 모든 과거 claim에 새 alias가 연결되고 `owner_trial_identity_key_retirement_status_v1`이 missing 0을 증명한 별도 migration 이후에만 이전 secret/policy를 retire합니다.
- 해당 key의 최초 성공 가입만 `trialDays: 14`, `subscription_status: trialing`입니다. 이후 가입은 성공하지만 `trialDays: 0`, `billingRequired: true`, `subscription_status: expired`로 저장되어 결제 화면으로 이동합니다.
- unique claim insert와 가입 저장은 같은 transaction입니다. 실패·중단·보상된 가입은 claim을 소모하지 않고, 동시 요청의 trial winner는 한 건뿐입니다.
- claim에는 계정/매장 외래키가 없습니다. 탈퇴 purge 이후에도 비식별 anti-abuse receipt를 보존해 재가입 체험 재획득을 막습니다. 이 receipt의 정책 변경이나 HMAC key rotation은 별도 개인정보 lifecycle 검수 없이는 수행하지 않습니다.
- 과거 성공 가입 backfill은 서버가 earliest successful signup을 선택해 `backfill_owner_trial_identity_claim_v2`에 current+previous HMAC aliases만 전달합니다. 기존 trial/subscription/payment 이력은 수정하지 않습니다.
- canonical 신규 판매 계약은 `single_monthly_v1` / product version `2026-08-v1` / 월 29,000원(`KRW`) 단일 subscription entitlement입니다. 가입 시 이 코드와 가격 snapshot을 함께 저장하며, legacy `monthly`(19,000원·월 500건) 역사값은 변경하지 않습니다. 알림톡 plan credit/reset/추가 충전 원장은 만들지 않습니다.

## 응답 계약

- 성공: HTTP 200, `success: true`, session 또는 재로그인 안내, 서버 판정 `trial: { eligible, days }`, `billingRequired`, `nextAction`.
- 동일 번호의 체험 사용 이력이 있으면 가입 성공 후 `이 번호로 무료 체험을 이미 사용했습니다. 계속 이용하려면 결제를 진행해 주세요.`를 안내하고 `/owner/billing`로 이동합니다.
- 이메일 중복은 전화번호 오류가 아니라 HTTP 409 `이미 사용 중인 이메일입니다.`로 표시합니다.
- 동일 요청 처리 중: HTTP 409 `SIGNUP_IN_PROGRESS`.
- key/payload 불일치: HTTP 409 `SIGNUP_PAYLOAD_MISMATCH`.
- 보상 대기: HTTP 409 `SIGNUP_COMPENSATION_PENDING`.
- pending migration/RPC 없음: HTTP 503 `ATOMIC_SIGNUP_MIGRATION_REQUIRED`.

## 서비스·가격 검토 문구

- 제목: `AI가 읽은 임시 목록`
- 설명: `틀린 내용을 고친 뒤 저장하세요. 저장 전에는 공개되지 않습니다.`
- 사용자 화면에서 `Draft`를 사용하지 않습니다.

## 저장 경계

- 최종 가입 요청 전: 서비스·가격은 브라우저/앱 메모리에만 존재하고 공개되지 않습니다.
- 최종 가입 성공: 검토 확정된 구조화 행만 canonical `services.price_guide` 원장에 저장됩니다.
- 최종 가입 실패: shop/profile/membership/service/price/credit 고아 행은 0이어야 합니다.
- 가입 후 초기 설정은 `영업시간·휴무일 → 직원·근무표`만 제공하고 서비스·가격을 다시 묻지 않습니다.

## 현재 실행 상태

계약과 main API orchestration, additive migration 초안은 존재하지만 Development migration은 적용하지 않았으며 가입 보안 gate는 계속 닫혀 있습니다. Production, 실제 회원, 외부 Vision 호출은 이 계약 검증 범위에 포함되지 않습니다.
