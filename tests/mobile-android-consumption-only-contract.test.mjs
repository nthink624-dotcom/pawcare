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

function ifStatementContaining(source, marker, fromIndex = 0) {
  const markerIndex = source.indexOf(marker, fromIndex);
  assert.notEqual(markerIndex, -1, `${marker} must exist`);
  const ifStart = source.lastIndexOf("if (", markerIndex);
  assert.notEqual(ifStart, -1, `${marker} must be guarded by an if statement`);

  const conditionStart = source.indexOf("(", ifStart);
  let conditionEnd = -1;
  let parenthesisDepth = 0;
  for (let index = conditionStart; index < source.length; index += 1) {
    if (source[index] === "(") parenthesisDepth += 1;
    if (source[index] === ")") parenthesisDepth -= 1;
    if (parenthesisDepth === 0) {
      conditionEnd = index;
      break;
    }
  }
  assert.notEqual(conditionEnd, -1, `${marker} condition must close`);

  const bodyStart = source.indexOf("{", conditionEnd);
  assert.notEqual(bodyStart, -1, `${marker} guard body must open`);
  let bodyEnd = -1;
  let braceDepth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") braceDepth += 1;
    if (source[index] === "}") braceDepth -= 1;
    if (braceDepth === 0) {
      bodyEnd = index;
      break;
    }
  }
  assert.notEqual(bodyEnd, -1, `${marker} guard body must close`);

  return {
    condition: source.slice(conditionStart + 1, conditionEnd),
    body: source.slice(bodyStart + 1, bodyEnd),
  };
}

function evaluateCondition(condition, scope) {
  const names = Object.keys(scope);
  const values = names.map((name) => scope[name]);
  return Function(...names, `"use strict"; return Boolean(${condition});`)(...values);
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

  const initialGate = ifStatementContaining(
    ownerMobile,
    "shouldBlockOwnerAccessBySubscription(subscription)",
  );
  const initialErrorGate = ifStatementContaining(
    ownerMobile,
    'nextMessage.includes("서비스 이용 기간이 만료")',
  );
  const switchStart = ownerMobile.indexOf("async function handleSwitchShop");
  const switchGate = ifStatementContaining(
    ownerMobile,
    "shouldBlockOwnerAccessBySubscription(nextSubscription)",
    switchStart,
  );
  const shouldBlockOwnerAccessBySubscription = (summary) =>
    summary.status === "expired" || summary.status === "past_due";
  const expired = { status: "expired" };
  const pastDue = { status: "past_due" };
  const active = { status: "active" };

  for (const subscription of [expired, pastDue]) {
    assert.equal(evaluateCondition(initialGate.condition, {
      subscription,
      isAndroidApp: true,
      shouldBlockOwnerAccessBySubscription,
    }), false);
    assert.equal(evaluateCondition(initialGate.condition, {
      subscription,
      isAndroidApp: false,
      shouldBlockOwnerAccessBySubscription,
    }), true);
    assert.equal(evaluateCondition(switchGate.condition, {
      nextSubscription: subscription,
      Capacitor: { getPlatform: () => "android" },
      shouldBlockOwnerAccessBySubscription,
    }), false);
    assert.equal(evaluateCondition(switchGate.condition, {
      nextSubscription: subscription,
      Capacitor: { getPlatform: () => "web" },
      shouldBlockOwnerAccessBySubscription,
    }), true);
  }
  assert.equal(evaluateCondition(initialGate.condition, {
    subscription: active,
    isAndroidApp: false,
    shouldBlockOwnerAccessBySubscription,
  }), false);
  assert.equal(evaluateCondition(switchGate.condition, {
    nextSubscription: active,
    Capacitor: { getPlatform: () => "web" },
    shouldBlockOwnerAccessBySubscription,
  }), false);

  let nullableGuardCalls = 0;
  const countingBlockCheck = () => {
    nullableGuardCalls += 1;
    return true;
  };
  assert.equal(evaluateCondition(initialGate.condition, {
    subscription: null,
    isAndroidApp: false,
    shouldBlockOwnerAccessBySubscription: countingBlockCheck,
  }), false);
  assert.equal(evaluateCondition(switchGate.condition, {
    nextSubscription: null,
    Capacitor: { getPlatform: () => "web" },
    shouldBlockOwnerAccessBySubscription: countingBlockCheck,
  }), false);
  assert.equal(nullableGuardCalls, 0);

  const expiredMessage = "서비스 이용 기간이 만료되었습니다.";
  assert.equal(evaluateCondition(initialErrorGate.condition, {
    Capacitor: { getPlatform: () => "android" },
    nextMessage: expiredMessage,
  }), false);
  assert.equal(evaluateCondition(initialErrorGate.condition, {
    Capacitor: { getPlatform: () => "web" },
    nextMessage: expiredMessage,
  }), true);
  assert.equal(evaluateCondition(initialErrorGate.condition, {
    Capacitor: { getPlatform: () => "web" },
    nextMessage: "일시적인 네트워크 오류",
  }), false);

  for (const gate of [initialGate, initialErrorGate, switchGate]) {
    assert.match(gate.body, /router\.replace\([^\n]*\/owner\/billing\?compare=1/);
  }
  assert.equal((ownerMobile.match(/router\.replace\([^\n]*\/owner\/billing\?compare=1/g) ?? []).length, 3);

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
