import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertDepositNotificationValues } from "../../src/server/deposit-notification-validation.ts";

const valid = () => ({ policy: { bankName: "테스트은행", bankAccount: "123-456", bankHolder: "테스트매장" }, deposit: { amount: 20000 } });
test("complete saved deposit values pass", () => assert.doesNotThrow(() => assertDepositNotificationValues(valid())));
test("every missing account field blocks dispatch", () => {
  for (const key of ["bankName", "bankAccount", "bankHolder"]) {
    for (const value of [undefined, null, "", "  ", "#{미입력}", "[은행 미설정]"]) {
      const data = valid(); data.policy[key] = value;
      assert.throws(() => assertDepositNotificationValues(data), /등록해 주세요/);
    }
  }
});
test("invalid amounts and absent snapshots fail closed", () => {
  for (const amount of [undefined, null, 0, -1, NaN, Infinity, 1.5, "20000"]) {
    const data = valid(); data.deposit.amount = amount;
    assert.throws(() => assertDepositNotificationValues(data), /예약금액/);
  }
  for (const data of [null, undefined, {}, { deposit: {} }]) assert.throws(() => assertDepositNotificationValues(data), /등록해 주세요/);
});
test("production dispatcher validates before template lookup and delivery", () => {
  const source = readFileSync(new URL("../../src/server/notification-dispatch.ts", import.meta.url), "utf8");
  const guard = source.indexOf("assertDepositNotificationValues(data);");
  assert.ok(guard > 0);
  assert.ok(guard < source.indexOf("const connectedTemplate = await getApprovedSsodaaNotificationTemplate", guard));
});
