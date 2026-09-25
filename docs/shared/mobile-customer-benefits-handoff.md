# Mobile Customer Benefits Handoff

PC/backend source of truth: `D:\petmanager`

Required contract: `D:\petmanager-shared\docs\data-contracts.md` > `Customer Discount Coupon Contract`

## Mobile implementation prompt

`D:\petmanager-app`에서 고객 예약 혜택을 PC/backend 공통 계약에 연결해주세요.

필수 원칙:

- 모바일에서 첫 방문/재방문 여부나 할인액을 자체 계산하지 않습니다.
- 모바일 로컬 저장값이나 선택한 반려동물 이력으로 방문 유형을 판정하지 않습니다.
- `guardians`, `appointments`, `shops.customer_page_settings`에 직접 Supabase write를 만들지 않습니다.
- PC/backend의 `POST /api/customer-benefits/quote`를 공통 원본으로 사용합니다.

견적 요청:

```json
{
  "shopId": "shop-id",
  "guardianName": "보호자명",
  "phone": "01012345678",
  "serviceId": "source-service-id",
  "customerServiceOptionId": "customer-service-option-id",
  "appointmentDate": "YYYY-MM-DD"
}
```

최종 확인 화면:

- `visitType`을 `첫 방문` 또는 `재방문`으로 표시합니다.
- `appliedCoupons`만 적용 혜택으로 표시합니다.
- `originalAmount`, `discountAmount`, `finalAmount`를 서버 응답 그대로 표시합니다.
- 견적 로딩 중이거나 견적 오류 상태에서는 예약/결제 버튼을 비활성화합니다.

예약/결제:

- 예약 생성 시 `expectedFinalAmount`에 견적의 `finalAmount`를 전달합니다.
- 서버가 금액 변경 오류를 반환하면 최신 견적을 다시 불러와 고객에게 재확인을 요청합니다.
- 결제 금액은 반드시 견적의 `finalAmount`를 사용합니다.
- 예약 완료 후에는 예약 응답의 `discountQuote`와 appointment snapshot 필드를 표시합니다.

금지 사항:

- 첫 방문 쿠폰과 재방문 쿠폰을 동시에 노출하거나 적용하지 않습니다.
- `exclusive`/`stackable` 조합 계산을 모바일에 복제하지 않습니다.
- 쿠폰 금액을 클라이언트에서 신뢰하거나 임의로 덮어쓰지 않습니다.

검증 항목:

1. 신규 보호자는 첫 방문 혜택만 표시됩니다.
2. 기존 보호자는 재방문 혜택만 표시됩니다.
3. 같은 보호자의 다른 반려동물 예약 이력도 재방문 판정에 포함됩니다.
4. 취소/거절/노쇼 예약만 있는 보호자는 첫 방문으로 판정됩니다.
5. 서비스 범위와 기간이 맞지 않는 혜택은 표시되지 않습니다.
6. 서버가 선택한 최대 할인 조합과 모바일 표시 금액이 일치합니다.
7. 예약 완료 후 PC와 모바일 appointment 할인 스냅샷이 동일합니다.
