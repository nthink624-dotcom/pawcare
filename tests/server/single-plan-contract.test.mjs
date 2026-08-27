import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { alimtalkCreditProducts } from "../../src/lib/alimtalk-credit-products.ts";
import {
  billableOwnerPlans,
  calculateOwnerBillingAmountBreakdown,
  OWNER_CANONICAL_PLAN_CODE,
  OWNER_SINGLE_PLAN_INCLUDED_COPY,
  OWNER_SINGLE_PLAN_LIMIT_COPY,
  OWNER_SINGLE_PLAN_MONTHLY_PRICE,
  ownerPlanIncludedAlimtalkCredits,
  ownerPlans,
} from "../../src/lib/billing/owner-plans.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("신규 판매 요금제는 월 29,000원 한 건뿐이다", () => {
  assert.equal(billableOwnerPlans.length, 1);
  assert.equal(billableOwnerPlans[0]?.code, OWNER_CANONICAL_PLAN_CODE);
  assert.equal(billableOwnerPlans[0]?.monthlyPrice, OWNER_SINGLE_PLAN_MONTHLY_PRICE);
  assert.equal(billableOwnerPlans[0]?.title, "펫매니저 단일 요금제");
  assert.match(OWNER_SINGLE_PLAN_INCLUDED_COPY, /별도 충전이나 건별 추가 결제는 없습니다/);
  assert.match(OWNER_SINGLE_PLAN_LIMIT_COPY, /비정상·오남용 발송에는 제한될 수 있습니다/);
});

test("local checkout 금액은 매장 수와 무관하게 29,000원이다", () => {
  const plan = billableOwnerPlans[0];
  assert.ok(plan);
  assert.equal(calculateOwnerBillingAmountBreakdown(plan, 1).monthlyTotalAmount, 29_000);
  assert.equal(calculateOwnerBillingAmountBreakdown(plan, 4).monthlyTotalAmount, 29_000);
});

test("legacy plan·credit·add-on 기록 계약은 삭제하거나 재작성하지 않는다", () => {
  assert.deepEqual(
    ownerPlans.map(({ code, monthlyPrice }) => [code, monthlyPrice]),
    [
      ["free", 0],
      ["monthly", 19_000],
      ["quarterly", 29_000],
      ["halfyearly", 29_000],
      ["yearly", 79_000],
    ],
  );
  assert.deepEqual(ownerPlanIncludedAlimtalkCredits, {
    free: 100,
    monthly: 500,
    quarterly: 1500,
    halfyearly: 1500,
    yearly: 5000,
  });
  assert.deepEqual(
    alimtalkCreditProducts.map(({ id, creditCount, price }) => [id, creditCount, price]),
    [
      ["credits_1000", 1000, 11_000],
      ["credits_3000", 3000, 29_700],
      ["credits_10000", 10_000, 77_000],
    ],
  );
});

test("고객 판매 화면에는 폐기된 요금·quota·top-up copy가 없다", async () => {
  const customerFiles = [
    "src/components/landing/landing-page.tsx",
    "src/components/landing/landing-conversion-sections.tsx",
    "src/components/owner/owner-billing-plan-picker.tsx",
    "src/components/owner/owner-billing-screen.tsx",
    "src/components/owner/owner-billing-flow-shared.tsx",
    "src/components/owner/owner-billing-process-preview.tsx",
    "src/components/owner/owner-settings-panel.tsx",
    "src/components/owner/owner-service-expired-screen.tsx",
    "src/components/owner/owner-shell.tsx",
    "src/components/owner-web/owner-web-app-shell.tsx",
    "src/app/owner/alimtalk-credits/page.tsx",
    "src/app/refund/page.tsx",
  ];
  const combined = (await Promise.all(customerFiles.map(source))).join("\n");
  for (const forbidden of [
    "19,000",
    "79,000",
    "월 500건",
    "월 1,500건",
    "월 5,000건",
    "11원/건",
    "추가 이용권 구매",
    "추가 발송 이용권 구매",
    "직원 무제한",
    "다매장 포함",
    "1매장 제한",
  ]) {
    assert.equal(combined.includes(forbidden), false, `${forbidden} 고객 노출 금지`);
  }
});

test("추가 이용권 mutation은 인증 뒤 503으로 fail-closed한다", async () => {
  for (const route of [
    "src/app/api/alimtalk-credits/purchase/registered-card/route.ts",
    "src/app/api/alimtalk-credits/purchase/confirm/route.ts",
  ]) {
    const content = await source(route);
    assert.match(content, /requireOwnerBillingSession\(request\)/);
    assert.match(content, /status: 503/);
    assert.doesNotMatch(content, /purchaseOwnerAlimtalkCreditsWithRegisteredCard|confirmOwnerAlimtalkCreditPurchase/);
  }
});

test("구독 갱신 경로는 included-credit reset을 호출하지 않는다", async () => {
  const ownerBilling = await source("src/server/owner-billing.ts");
  assert.equal(ownerBilling.includes("resetShopAlimtalkIncludedCredits"), false);
});
