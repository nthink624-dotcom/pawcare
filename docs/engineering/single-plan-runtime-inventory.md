# 단일 요금제 전환 런타임 인벤토리

## 이번 로컬 변경의 경계

- 신규 고객 노출 계약은 `펫매니저 단일 요금제` 월 29,000원 한 건이다.
- 알림톡은 요금제에 포함되며 별도 충전·건별 추가 결제·추가 이용권 신규 판매를 노출하지 않는다.
- 카드 없이 14일 체험하며 체험 종료만으로 자동 결제되지 않는다.
- 부가세, 직원 수, 매장 수 범위는 미확정이므로 고객 화면에서 주장하지 않는다.
- 이 변경은 로컬 제품 코드와 fixture 검증만 포함한다. Development/Production DB migration, 실제 결제, 실제 발송은 수행하지 않는다.

## 역사값 보존

아래 코드는 기존 구독·원장·영수증을 읽기 위한 호환 계약이므로 삭제하거나 과거 행을 다시 쓰지 않는다.

- `src/lib/billing/owner-plans.ts`: legacy plan code와 과거 금액/포함 크레딧
- `src/lib/alimtalk-credit-products.ts`: 과거 추가 이용권 상품 식별자와 금액
- `src/server/alimtalk-credit-service.ts`: 기존 included/purchased balance와 ledger projection
- `src/server/owner-alimtalk-credit-purchase.ts`: 과거 결제·환불·receipt 확인용 서버 계약

신규 고객 판매 경로는 `billableOwnerPlans`의 canonical plan 한 건만 사용하며, 추가 이용권 POST API는 인증 후 503으로 fail-closed한다.

## 크레딧 초기화·부여 호출 인벤토리

| 경로 | 현재 역할 | 전환 시 필요한 결정 |
| --- | --- | --- |
| `src/server/owner-default-setup.ts` | 가입/기본 설정 시 included credit 초기화 | canonical product migration 및 보안 승인 뒤 제거 또는 내부 발송 한도 원장으로 분리 |
| `src/app/api/dev/create-owner/route.ts` | 개발용 오너 fixture 생성 시 초기화 | 개발 fixture 계약을 단일 플랜 정책과 함께 갱신 |
| `src/app/api/admin/alimtalk/credits/route.ts` | 관리자 내부 조정/초기화 | 고객 판매 UX와 분리하고 최소 권한·감사 원장을 유지 |
| `src/server/owner-billing.ts` | 갱신/결제 | included-credit reset 직접 호출 없음. 향후에도 결제 성공을 고객용 quota 충전으로 해석하지 않음 |

기존 잔여 included/purchased credit와 구매 기록은 삭제하지 않는다.

## 후속 보안 게이트가 필요한 런타임 후보

- `ownerPlanAllowsAutomaticVisitReminder`: legacy plan code별 기능 조건을 canonical entitlement로 대체할 후보
- `getOwnerPlanIncludedAlimtalkCredits`: 고객 quota가 아닌 내부 provider 비용·rate limit·오남용 방지 원장으로 의미를 분리할 후보
- `owner-default-setup` 및 dev/admin reset: 신규 가입 시 자동 credit 부여를 중단할 additive migration/API 계약 필요
- subscription record의 legacy `current_plan_code`/`auto_renew_plan_code`: 과거 행 보존과 신규 canonical product version을 분리하는 additive migration 필요

위 후보는 이번 변경에서 Production 활성화하지 않는다.
