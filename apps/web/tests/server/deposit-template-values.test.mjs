import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BOOKING_POLICY } from "@petmanager/shared/contracts/booking-preparation";
import { APPROVED_ALIMTALK_CONTRACTS } from "@petmanager/shared/contracts/alimtalk";
import { buildDepositTemplateValues } from "@petmanager/shared/lib/deposit-template-values";
import { fillNotificationTemplate } from "../../src/lib/notification-registry.ts";

const policy = { ...DEFAULT_BOOKING_POLICY, bankName: "테스트은행", bankAccount: "TEST-123", bankHolder: "테스트매장" };
test("custom deadline preview and legacy default agree", () => {
  assert.match(buildDepositTemplateValues({ ...policy, depositHoldMinutes: 60 }).납부기한, /60분/);
  assert.match(buildDepositTemplateValues({ ...policy, depositHoldMinutes: undefined }).납부기한, /20분/);
});
test("deposit preview uses saved account values and explicitly labels a sample deadline", () => {
  const values = buildDepositTemplateValues(policy);
  const body = fillNotificationTemplate(APPROVED_ALIMTALK_CONTRACTS.booking_deposit_request.body, { ...values, 매장명: "테스트매장", 보호자명: "예시", 반려동물명: "예시", 예약일시: "예시" });
  for (const expected of ["테스트은행 TEST-123", "예금주: 테스트매장", "20,000원", "20분", "예시"]) assert.ok(body.includes(expected));
  assert.ok(!body.includes("#{"));
});
test("actual dispatch keeps the requested amount, policy snapshot and exact deadline", () => {
  const deposit = { amount: 15000, dueAt: "2026-10-12T01:20:00Z", releaseIfUnreported: true };
  const values = buildDepositTemplateValues(policy, deposit);
  assert.equal(values.예약금액, "15,000");
  assert.equal(values.입금계좌, "TEST-123");
  assert.ok(!values.납부기한.includes("예시"));
  assert.ok(values.기한안내.includes("입금 신고 후에는 매장 확인"));
});
test("unconfigured preview never invents a payable account", () => {
  const values = buildDepositTemplateValues(DEFAULT_BOOKING_POLICY);
  assert.equal(values.은행명, "[은행 미설정]");
  assert.equal(values.입금계좌, "[계좌번호 미설정]");
  assert.equal(values.예금주, "[예금주 미설정]");
});
