import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("owner billing navigation paints the matching cached shop before access refresh", async () => {
  const page = await source("src/app/owner/billing/page.tsx");

  const cacheRead = page.indexOf("const cachedSummary = readOwnerBillingSummaryCache()");
  const cachePaint = page.indexOf("setSummary(cachedSummary)", cacheRead);
  const accessRefresh = page.indexOf('fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops"', cachePaint);

  assert.ok(cacheRead >= 0);
  assert.ok(cachePaint > cacheRead);
  assert.ok(accessRefresh > cachePaint);
  assert.match(page, /cachedSummary && isSummaryForActiveShop\(cachedSummary, storedShopId\)/);
  assert.match(page, /setSummary\(null\);\s*setMessage\("현재 매장의 결제 권한을 확인하지 못했습니다\."\)/);
  assert.match(page, /<Suspense fallback=\{<OwnerBillingRouteFallback \/>\}>/);
  assert.match(page, /aria-labelledby="owner-billing-loading-title"/);
  assert.doesNotMatch(page, />\s*구독 정보를 불러오는 중입니다\.\s*</);
});

test("owner recurring billing uses direct card API without a hosted certificate flow", async () => {
  const [client, api, issue, route] = await Promise.all([
    source("src/lib/billing/owner-billing-client.ts"),
    source("src/api/billing.ts"),
    source("src/server/owner-billing-key-issue.ts"),
    source("src/app/api/subscription/payment-method/issue/route.ts"),
  ]);

  assert.doesNotMatch(client, /@portone\/browser-sdk|requestIssueBillingKey|billingKeyMethod/);
  assert.match(client, /subscriptionPath\("\/api\/subscription\/payment-method\/issue", shopId\)/);
  assert.match(api, /registerOwnerBillingCard = issueOwnerBillingKeyByApi/);
  assert.match(issue, /fetch\("https:\/\/api\.portone\.io\/billing-keys"/);
  assert.match(issue, /channelKey: serverEnv\.portoneBillingChannelKey/);
  assert.match(issue, /method:\s*\{\s*card:\s*\{\s*credential:/);
  assert.match(route, /cardNumber:[\s\S]*expiryMonth:[\s\S]*birthOrBusinessRegistrationNumber:[\s\S]*passwordTwoDigits:/);
  assert.doesNotMatch(`${client}\n${api}\n${issue}\n${route}`, /공인인증|공동인증/);
});

test("every successful monthly charge schedules the next charge once", async () => {
  const billing = await source("src/server/owner-billing.ts");

  assert.match(billing, /`\/payments\/\$\{encodeURIComponent\(paymentId\)\}\/schedule`/);
  assert.match(billing, /function hasUpcomingScheduledCharge/);
  assert.match(billing, /async function ensureUpcomingChargeScheduled/);
  assert.match(billing, /readRecordedPaymentStatus\(paymentId\)/);
  assert.match(billing, /payment\.status === "PAID" && recordedStatus === "PAID"/);

  const retryStart = billing.indexOf("export async function retryOwnerSubscriptionCharge");
  const syncStart = billing.indexOf("export async function syncOwnerSubscriptionFromPayment");
  const resetStart = billing.indexOf("export async function resetOwnerPaymentMethod");
  const retryBlock = billing.slice(retryStart, syncStart);
  const syncBlock = billing.slice(syncStart, resetStart);

  assert.match(retryBlock, /payment\.status === "PAID"[\s\S]*ensureUpcomingChargeScheduled/);
  assert.match(syncBlock, /payment\.status === "PAID"[\s\S]*ensureUpcomingChargeScheduled/);
  assert.match(retryBlock, /hasUpcomingScheduledCharge\(currentRecord\)/);
});
