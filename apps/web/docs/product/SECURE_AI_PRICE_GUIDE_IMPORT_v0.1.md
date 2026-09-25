# SECURE_AI_PRICE_GUIDE_IMPORT v0.1

## 판정

- 실제 동작 화면: 완료. 격리 로컬 `http://127.0.0.1:3107/dev/secure-ai-price-guide-preview`에서 사진 선택 → 안전 처리 → fixture 구조화 → 행 수정/삭제/추가 → 확정 → 다음 가입 단계 전달을 검증했다. 검증 후 서버와 브라우저는 종료했다.
- 실제 Development Vision E2E: **차단**. 현재 환경에 서버 전용 `OPENAI_API_KEY`가 없다. 화면과 응답은 `Development fixture · 외부 Vision 호출 없음`으로 표시한다.
- Development DB 적용: **차단**. `supabase:db:push:dev:dry-run`에서 원격 migration `20260826130954`가 로컬 이력에 없어 안전하게 중단됐다. migration 이력을 먼저 대조하기 전에는 적용하지 않는다.
- Production: 배포, DB migration, Storage 접근, 실사용자 생성 모두 수행하지 않았다.

## 실제 화면 증거

- `artifacts/secure-ai-price-guide-import-v0.1/01-mobile-fixture-analyzed.png`
- `artifacts/secure-ai-price-guide-import-v0.1/02-mobile-edited.png`
- `artifacts/secure-ai-price-guide-import-v0.1/03-mobile-confirmed.png`
- `artifacts/secure-ai-price-guide-import-v0.1/04-mobile-next-step.png`
- `artifacts/secure-ai-price-guide-import-v0.1/05-pc-fixture-analyzed.png`
- 비식별 구조화 예시: `artifacts/secure-ai-price-guide-import-v0.1/fixture-structured-result.json`

## 구현된 보안 경계

1. 가입 세션/IP/device fingerprint에 묶인 5분짜리 HMAC 일회성 분석 토큰을 발급한다. 세션은 HttpOnly/SameSite=Lax 쿠키다.
2. JPEG/PNG/WebP만 허용하고 MIME와 magic bytes를 일치 검사한다.
3. 실제 Sharp decoder로 검증하고 8MB, 8,000×8,000, 4천만 pixel, 단일 frame, 12초 timeout을 적용한다.
4. 3,200px 이하 JPEG로 서버 재인코딩해 EXIF/GPS와 비표준 꼬리 데이터를 제거한다.
5. 원본과 재인코딩 buffer는 success/failure 경로의 `finally`에서 zeroize한다. 임시 파일/Storage를 만들지 않는다.
6. 분산 DB gate 초안은 IP 10회/10분, 세션 6회/일, device 8회/일, 세션 동시 2회, 같은 hash 동시 1회, 일일 비용 한도, 5분 안 provider 실패 5회의 circuit breaker를 포함한다. 제한 응답은 429와 `Retry-After`를 사용한다.
7. SHA-256 hash dedupe 결과는 AES-256-GCM 암호문으로만 짧게 보관하며 원본 이미지와 provider 원시 응답은 보관하지 않는다.
8. AI 응답은 서버 schema/정규화를 거쳐 음수 가격·비정상 값·중복 행을 제거한 구조화 행만 UI에 전달한다.
9. Vision 불가/실패 시 같은 화면의 직접 입력으로 전환하며 선택한 사진 미리보기는 브라우저 상태에 남는다.
10. 사용자가 `이 내용으로 등록`을 누른 구조화 행만 최종 가입 payload에 포함한다.

## 회원가입 원자 처리

- `claim_owner_signup_v2`가 같은 idempotency key의 단일 실행자만 Auth 생성으로 진행시킨다.
- `complete_owner_signup_v2` transaction 안에서 KCP identity consume, canonical shop/profile/membership/service/staff 저장, 가입 포함 Alimtalk Credit 적립을 함께 처리한다.
- 실패 시 생성된 Auth 사용자를 보상 삭제하고, 보상 삭제 실패는 `compensation_pending`으로 명시한다.
- 서비스 가격은 별도 온보딩 복사본이 아니라 canonical 상세 요금 원장으로만 저장한다.

## 검증 결과

- P0 대상 테스트: 16/16 통과.
  - 정상 PNG decoder/재인코딩/EXIF 제거
  - MIME 위장, truncated, polyglot, 초대형 폭 차단
  - token session/IP/device 바인딩 및 재사용 차단
  - 암호화 cache 평문 미포함
  - 동일 key 20개 동시 요청의 Auth 생성 1회
  - 응답 유실 후 완료 결과 재사용
  - KCP/Credit 원자 저장 실패 시 Auth 보상
  - migration의 rate/cost/dedupe/circuit/revoke 계약
- `npm run typecheck`: 통과.
- `npm run build`: 통과. 기존 reliability 86/86, media architecture check, Next production build까지 통과.
- 실제 UI: 모바일/PC 사진 선택 및 fixture 분석, 행 수정·삭제·추가·확정·다음 단계 이동 통과.
- 실제 외부 Vision: 미검증. 키 부재 상태에서 fixture를 실제 AI처럼 표시하지 않았다.
- 회전·어두운 사진·손글씨 혼합·provider 4xx/5xx/timeout의 실제 Vision 품질 시험은 secret 연결 후 Development에서 수행해야 한다.

## Development 연결에 필요한 서버 전용 환경값

- `OPENAI_API_KEY`: Development 서버에서 이미지 입력 가능한 Responses API 호출에만 사용. `NEXT_PUBLIC_` 금지, 값은 채팅/로그 출력 금지.
- `OPENAI_VISION_MODEL`: 허용한 Vision 모델 이름. 서버 전용.
- `SIGNUP_PRICE_GUIDE_TOKEN_SECRET`: 최소 32자, 분석 토큰/세션 HMAC 전용.
- `SIGNUP_PRICE_GUIDE_CACHE_SECRET`: 최소 32자, 짧은 TTL 구조화 결과 암호화 전용.
- `SIGNUP_PRICE_GUIDE_MAX_DAILY_COST_MICRO_USD`: Development 일일 비용 상한.

## 변경 및 rollback

- API/UI/server/test/migration 초안과 `sharp@0.35.3` 의존성을 추가했다.
- migration은 Development/Production 어느 곳에도 적용하지 않았다. DB rollback은 현재 필요 없다.
- 코드 rollback은 이 문서의 변경 파일만 선택적으로 되돌리면 된다. 공유 worktree에 기존 변경이 많아 임의 commit은 만들지 않았다.
- Development 적용 전 다음 순서가 필수다: 누락된 원격 migration `20260826130954` 출처 확인 → 로컬 migration source-of-truth와 안전하게 일치 → dry-run 재통과 → Development에만 적용 → fixture가 아닌 실제 Vision E2E 1건 → DB/Storage/로그 영구 저장 0 재검증.
