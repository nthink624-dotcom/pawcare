import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const billingClient = await readFile(new URL("../src/lib/billing/owner-billing-client.ts", import.meta.url), "utf8");
const nativeNotice = await readFile(new URL("../src/components/owner/owner-native-billing-notice.tsx", import.meta.url), "utf8");
const ownerShell = await readFile(new URL("../src/components/owner/owner-shell.tsx", import.meta.url), "utf8");
const ownerMobile = await readFile(new URL("../src/app/owner/mobile/page.tsx", import.meta.url), "utf8");
const billingSuccess = await readFile(new URL("../src/app/owner/billing/success/page.tsx", import.meta.url), "utf8");
const billingProcess = await readFile(new URL("../src/app/owner/billing/process/page.tsx", import.meta.url), "utf8");
const androidManifest = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const androidGradle = await readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8");
const capacitorConfig = await readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8");

function functionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("Android keeps current entitlement information without an external-payment prompt", () => {
  assert.match(nativeNotice, /현재 플랜/);
  assert.match(nativeNotice, /이용 상태/);
  assert.match(nativeNotice, /이용 종료일/);
  assert.match(nativeNotice, /현재 이용 상태/);
  assert.match(nativeNotice, /이용 상태 다시 확인/);
  assert.doesNotMatch(nativeNotice, /PC에서|PC 버전|충전|업그레이드|기간 연장|결제는/);
  assert.doesNotMatch(nativeNotice, /href=|window\.open/);
});

test("Android owner entry never redirects or advertises into billing flows", () => {
  assert.match(ownerMobile, /const isAndroidApp = Capacitor\.getPlatform\(\) === "android"/);
  assert.match(ownerMobile, /if \(!isAndroidApp && shouldBlockOwnerAccessBySubscription\(subscription\)\)/);
  assert.match(ownerMobile, /Capacitor\.getPlatform\(\) !== "android"/);

  assert.match(ownerShell, /const isAndroidApp = useSyncExternalStore/);
  assert.match(ownerShell, /return Capacitor\.getPlatform\(\) === "android"/);
  assert.match(ownerShell, /if \(isAndroidApp \|\| !summary \|\| summary\.status !== "past_due"\)/);
  assert.match(ownerShell, /isAndroidApp && summary && \(summary\.status === "expired" \|\| summary\.status === "past_due"\)/);
  assert.match(ownerShell, /<OwnerNativeBillingNotice/);
  assert.match(ownerShell, /\{!isAndroidApp && summary \? <TrialNoticeBanner/);
});

test("every Android billing mutation fails before transport or payment SDK loading", () => {
  assert.doesNotMatch(billingClient, /^import \{ requestIssueBillingKey, requestPayment \}/m);
  assert.match(billingClient, /Capacitor\.getPlatform\(\) === "android"/);
  assert.match(billingClient, /Android 앱에서는 현재 이용 상태만 확인할 수 있습니다/);
  assert.match(billingClient, /export async function fetchOwnerSubscriptionSummary\(\)[\s\S]*?fetchApiJsonWithAuth<OwnerSubscriptionSummary>\("\/api\/subscription"\)/);

  for (const name of [
    "saveOwnerSubscriptionPreferences",
    "retryOwnerSubscriptionPayment",
    "confirmOwnerSubscriptionPayment",
    "requestOwnerOneTimePayment",
    "issueOwnerBillingKey",
  ]) {
    const body = functionBody(billingClient, name);
    const guardIndex = body.indexOf("assertOwnerBillingWriteAllowed();");
    assert.notEqual(guardIndex, -1, `${name} must be guarded`);
    const transportIndexes = [body.indexOf("fetchApiJsonWithAuth"), body.indexOf("@portone/browser-sdk/v2")].filter(
      (index) => index !== -1,
    );
    assert.ok(transportIndexes.every((index) => guardIndex < index), `${name} must guard before transport`);
  }
});

test("legacy payment callback and preview routes fail closed in Android production", () => {
  assert.match(billingSuccess, /const isAndroidApp = useSyncExternalStore/);
  assert.match(billingSuccess, /if \(isAndroidApp\)/);
  assert.match(billingSuccess, /router\.replace\("\/owner\/billing"/);
  assert.match(billingProcess, /process\.env\.NODE_ENV === "production"/);
  assert.match(billingProcess, /notFound\(\)/);
});

test("Android native inventory has no billing SDK, billing permission, or payment deep link", () => {
  assert.doesNotMatch(androidManifest, /com\.android\.vending\.BILLING|BillingClient|portone|payment/i);
  assert.doesNotMatch(androidGradle, /billingclient|com\.android\.billing|portone|payment/i);
  assert.doesNotMatch(capacitorConfig, /billing|portone|payment/i);
  assert.match(capacitorConfig, /appId: "kr\.petmanager\.owner"/);
});
